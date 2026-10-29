import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import { cancelAllNotifications, rescheduleReminders } from "./notify";
import { supabase } from "./supabase";
import { DEFAULT_PREFS, type ActiveSession, type Prefs, type StudyRecord, type WrongAnswer } from "./types";

/** none: 아직 시작 전(첫 화면) · guest: 로그인 없이 둘러보기 · user: 회원 */
export type Mode = "none" | "guest" | "user";

const K = {
  mode: "pg.mode",
  prefs: "pg.prefs",
  onboarded: "pg.onboarded",
  records: "pg.records",
  active: "pg.active",
  gears: "pg.gears",
};

/** 처음 시작할 때 주는 톱니바퀴 (유료 재화). 결제는 아직 없음 */
export const STARTER_GEARS = 30;

type NewRecord = Omit<StudyRecord, "id" | "synced" | "studiedAt">;

interface AppStateValue {
  ready: boolean;
  mode: Mode;
  email: string | null;
  serverEnabled: boolean;
  prefs: Prefs;
  onboarded: boolean;
  records: StudyRecord[];
  active: ActiveSession | null;
  /** 톱니바퀴 잔액 */
  gears: number;
  /** 톱니바퀴를 n개 씁니다. 모자라면 false */
  spendGears(n: number): boolean;
  startGuest(): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirm: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  updatePrefs(p: Partial<Prefs>, opts?: { finishOnboarding?: boolean }): Promise<void>;
  setActive(a: ActiveSession | null | ((prev: ActiveSession | null) => ActiveSession | null)): void;
  addRecord(r: NewRecord): Promise<StudyRecord>;
  removeRecord(id: string): Promise<void>;
}

const Ctx = createContext<AppStateValue | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

// ───────── 저장 도우미 ─────────
async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
const writeJSON = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

// ───────── 서버 행 ↔ 앱 객체 변환 ─────────
type RecordRow = {
  id: string; topic_id: string; topic_ko: string; domain: string; category: string; level: string;
  memo: string; score: number; quiz_total: number; rp: number; wrong: WrongAnswer[] | null;
  study_sec: number; quiz_source: string; studied_at: string;
};
const toRow = (r: StudyRecord, userId: string) => ({
  id: r.id, user_id: userId, topic_id: r.topicId, topic_ko: r.topicKo, domain: r.domain, category: r.category, level: r.level,
  memo: r.memo.slice(0, 5000), score: r.score, quiz_total: r.total, rp: r.rp, wrong: r.wrong.slice(0, 10),
  study_sec: r.studySec, quiz_source: r.quizSource, studied_at: r.studiedAt,
});
const fromRow = (x: RecordRow): StudyRecord => ({
  id: x.id, topicId: x.topic_id, topicKo: x.topic_ko, domain: x.domain, category: x.category, level: x.level,
  memo: x.memo, score: x.score, total: x.quiz_total, rp: x.rp, wrong: x.wrong ?? [], studySec: x.study_sec,
  quizSource: (["bank", "ai", "offline"].includes(x.quiz_source) ? x.quiz_source : "ai") as StudyRecord["quizSource"], studiedAt: x.studied_at, synced: true,
});

/** 이전 버전(별점 방식) 기록을 새 형식으로 바꿉니다. */
const normalizeRecord = (r: Partial<StudyRecord> & { rating?: number }): StudyRecord => ({
  id: r.id ?? "", topicId: r.topicId ?? "", topicKo: r.topicKo ?? "", domain: r.domain ?? "it",
  category: r.category ?? "", level: r.level ?? "", memo: r.memo ?? "",
  score: typeof r.score === "number" ? r.score : Math.round((r.rating ?? 0) * 2),
  total: typeof r.total === "number" ? r.total : 10,
  rp: typeof r.rp === "number" ? r.rp : 0,
  wrong: Array.isArray(r.wrong) ? r.wrong : [],
  studySec: r.studySec ?? 0,
  quizSource: r.quizSource === "offline" || r.quizSource === "bank" ? r.quizSource : "ai",
  studiedAt: r.studiedAt ?? new Date(0).toISOString(),
  synced: !!r.synced,
});

type ProfileRow = {
  nickname: string; interests: string[]; level: number; study_minutes: number;
  reminder_enabled: boolean; reminder_time: string;
};
const prefsToProfile = (p: Prefs, id: string) => ({
  id, nickname: p.nickname, interests: p.interests, level: p.level, study_minutes: p.studyMinutes,
  reminder_enabled: p.reminderEnabled, reminder_time: p.reminderTime, updated_at: new Date().toISOString(),
});
const profileToPrefs = (x: ProfileRow): Prefs => ({
  nickname: x.nickname, interests: x.interests ?? [], level: ([0, 1, 2, 3].includes(x.level) ? x.level : 0) as Prefs["level"],
  studyMinutes: x.study_minutes, reminderEnabled: x.reminder_enabled, reminderTime: x.reminder_time,
});

const sortRecords = (rs: StudyRecord[]) => [...rs].sort((a, b) => a.studiedAt.localeCompare(b.studiedAt));

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("none");
  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [onboarded, setOnboarded] = useState(false);
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [active, setActiveState] = useState<ActiveSession | null>(null);
  const [gears, setGears] = useState(0);

  // 비동기 함수 안에서 최신 값을 읽기 위한 ref
  const recordsRef = useRef(records);
  const prefsRef = useRef(prefs);
  const activeRef = useRef(active);
  const gearsRef = useRef(gears);
  useLayoutEffect(() => {
    recordsRef.current = records;
    prefsRef.current = prefs;
    activeRef.current = active;
    gearsRef.current = gears;
  });

  const saveRecordsLocal = useCallback((rs: StudyRecord[]) => {
    recordsRef.current = rs;
    setRecords(rs);
    writeJSON(K.records, rs);
  }, []);

  const setModePersist = useCallback((m: Mode) => {
    setMode(m);
    writeJSON(K.mode, m);
  }, []);

  /** 서버에 아직 안 올라간 기록을 올립니다. */
  const syncPending = useCallback(async (userId: string) => {
    if (!supabase) return;
    const pending = recordsRef.current.filter((r) => !r.synced);
    if (!pending.length) return;
    const { error } = await supabase.from("study_records").upsert(pending.map((r) => toRow(r, userId)));
    if (error) return;
    const ids = new Set(pending.map((r) => r.id));
    saveRecordsLocal(recordsRef.current.map((r) => (ids.has(r.id) ? { ...r, synced: true } : r)));
  }, [saveRecordsLocal]);

  /** 로그인 직후: 프로필과 기록을 서버에서 가져오고, 게스트 때 쌓은 기록은 계정으로 옮깁니다. */
  const loadAccount = useCallback(async (s: Session) => {
    if (!supabase) return;
    const uid = s.user.id;
    setSession(s);

    const { data: profile, error: pErr } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (profile) {
      const p = profileToPrefs(profile as ProfileRow);
      setPrefs(p); writeJSON(K.prefs, p);
      setOnboarded(true); writeJSON(K.onboarded, true);
    } else if (!pErr) {
      const local = prefsRef.current;
      const localOnboarded = await readJSON(K.onboarded, false);
      if (localOnboarded && local.nickname && local.interests.length) {
        // 게스트로 설정해 둔 관심 분야를 그대로 계정에 저장
        const { error } = await supabase.from("profiles").upsert(prefsToProfile(local, uid));
        setOnboarded(!error);
      } else {
        setOnboarded(false); writeJSON(K.onboarded, false);
      }
    }
    // 오프라인 등으로 프로필을 못 읽으면 로컬 상태를 그대로 사용

    await syncPending(uid);
    const { data: rows, error: rErr } = await supabase
      .from("study_records").select("*").order("studied_at", { ascending: true }).limit(5000);
    if (!rErr && rows) {
      const server = (rows as RecordRow[]).map(fromRow);
      const ids = new Set(server.map((r) => r.id));
      const unsynced = recordsRef.current.filter((r) => !r.synced && !ids.has(r.id));
      saveRecordsLocal(sortRecords([...server, ...unsynced]));
    }
    setModePersist("user");
  }, [saveRecordsLocal, setModePersist, syncPending]);

  const clearLocal = useCallback(async () => {
    await AsyncStorage.multiRemove(Object.values(K)).catch(() => {});
    await cancelAllNotifications().catch(() => {});
    setSession(null);
    setPrefs(DEFAULT_PREFS);
    setOnboarded(false);
    saveRecordsLocal([]);
    setActiveState(null);
    gearsRef.current = STARTER_GEARS;
    setGears(STARTER_GEARS);
    setMode("none");
  }, [saveRecordsLocal]);

  // ───────── 앱 시작 ─────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, p, ob, rawRecords, rawActive, g] = await Promise.all([
        readJSON<Mode>(K.mode, "none"),
        readJSON<Prefs>(K.prefs, DEFAULT_PREFS),
        readJSON<boolean>(K.onboarded, false),
        readJSON<Partial<StudyRecord>[]>(K.records, []),
        readJSON<ActiveSession | null>(K.active, null),
        readJSON<number | null>(K.gears, null),
      ]);
      const rs = Array.isArray(rawRecords) ? rawRecords.map(normalizeRecord) : [];
      // 이전 버전(설명 단계)에서 진행 중이던 주제는 이어갈 수 없으므로 비움
      const ac = rawActive && ["study", "quiz", "result"].includes(rawActive.stage) ? rawActive : null;
      if (!alive) return;
      setPrefs({ ...DEFAULT_PREFS, ...p });
      prefsRef.current = { ...DEFAULT_PREFS, ...p };
      setOnboarded(ob);
      recordsRef.current = rs;
      setRecords(rs);
      activeRef.current = ac;
      setActiveState(ac);
      const gs = typeof g === "number" ? g : STARTER_GEARS;
      gearsRef.current = gs;
      setGears(gs);
      if (g == null) writeJSON(K.gears, gs);

      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setMode("user");
          setSession(data.session);
          setReady(true);
          loadAccount(data.session).catch(() => {}); // 화면은 로컬 데이터로 먼저 띄우고 서버는 뒤에서 갱신
          return;
        }
      }
      setMode(m === "user" ? "none" : m); // 세션이 만료됐으면 첫 화면으로
      setReady(true);
    })();
    return () => { alive = false; };
  }, [loadAccount]);

  // 로그아웃 감지 (토큰 만료, 다른 기기에서 탈퇴 등)
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") setSession(null);
      else if (s) setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // 앱으로 돌아올 때마다 밀린 기록 동기화 + 알림 다시 예약
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", (st) => {
      if (st !== "active") return;
      if (mode === "user" && session) syncPending(session.user.id).catch(() => {});
      if (onboarded) rescheduleReminders(prefsRef.current, recordsRef.current).catch(() => {});
    });
    return () => sub.remove();
  }, [mode, session, onboarded, syncPending]);

  useEffect(() => {
    if (ready && onboarded) rescheduleReminders(prefs, records).catch(() => {});
  }, [ready, onboarded, prefs, records]);

  // ───────── 동작 ─────────
  const startGuest = useCallback(async () => setModePersist("guest"), [setModePersist]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("서버가 아직 연결되지 않았어요.");
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) throw error;
    if (!data.session) return { needsConfirm: true }; // 이메일 인증이 켜져 있으면 메일 확인 후 로그인
    await loadAccount(data.session);
    return { needsConfirm: false };
  }, [loadAccount]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("서버가 아직 연결되지 않았어요.");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await loadAccount(data.session);
  }, [loadAccount]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut().catch(() => {});
    await clearLocal();
  }, [clearLocal]);

  const deleteAccount = useCallback(async () => {
    if (mode === "user" && supabase) {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    await clearLocal();
  }, [mode, clearLocal]);

  const updatePrefs = useCallback(async (patch: Partial<Prefs>, opts?: { finishOnboarding?: boolean }) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    writeJSON(K.prefs, next);
    if (opts?.finishOnboarding) {
      setOnboarded(true);
      writeJSON(K.onboarded, true);
    }
    if (mode === "user" && session && supabase) {
      const { error } = await supabase.from("profiles").upsert(prefsToProfile(next, session.user.id));
      if (error && opts?.finishOnboarding) throw error;
    }
  }, [mode, session]);

  const setActive = useCallback((a: ActiveSession | null | ((prev: ActiveSession | null) => ActiveSession | null)) => {
    const next = typeof a === "function" ? a(activeRef.current) : a;
    activeRef.current = next;
    setActiveState(next);
    writeJSON(K.active, next);
  }, []);

  const spendGears = useCallback((n: number) => {
    if (gearsRef.current < n) return false;
    const next = gearsRef.current - n;
    gearsRef.current = next;
    setGears(next);
    writeJSON(K.gears, next);
    return true;
  }, []);

  const addRecord = useCallback(async (r: NewRecord) => {
    const rec: StudyRecord = { ...r, id: Crypto.randomUUID(), studiedAt: new Date().toISOString(), synced: false };
    saveRecordsLocal(sortRecords([...recordsRef.current, rec]));
    if (mode === "user" && session) syncPending(session.user.id).catch(() => {});
    return rec;
  }, [mode, session, saveRecordsLocal, syncPending]);

  const removeRecord = useCallback(async (id: string) => {
    const target = recordsRef.current.find((r) => r.id === id);
    if (!target) return;
    if (mode === "user" && supabase && target.synced) {
      const { error } = await supabase.from("study_records").delete().eq("id", id);
      if (error) throw error;
    }
    saveRecordsLocal(recordsRef.current.filter((r) => r.id !== id));
  }, [mode, saveRecordsLocal]);

  const value = useMemo<AppStateValue>(() => ({
    ready, mode, email: session?.user.email ?? null, serverEnabled: !!supabase,
    prefs, onboarded, records, active, gears, spendGears,
    startGuest, signUp, signIn, signOut, deleteAccount, updatePrefs, setActive, addRecord, removeRecord,
  }), [ready, mode, session, prefs, onboarded, records, active, gears, spendGears,
    startGuest, signUp, signIn, signOut, deleteAccount, updatePrefs, setActive, addRecord, removeRecord]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
