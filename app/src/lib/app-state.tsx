import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import { FREE_BATTLE_TICKETS, FREEZE_COST, MAX_FREEZES, planStreakRescue, refillTickets, RESTORE_COST_PER_DAY, type StreakRescue, type Tickets } from "./economy";
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
  freezes: "pg.freezes",
  kept: "pg.keptDays",
  premium: "pg.premium",
  tickets: "pg.battleTickets",
  battleXp: "pg.battleXp",
  battlesApplied: "pg.battlesApplied",
  uid: "pg.uid",
  rescueAsked: "pg.rescueAsked",
};

/** 친구 추가용 UID: 헷갈리는 글자(0/O, 1/I)를 뺀 8자리 */
const UID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newUid = () => Array.from(Crypto.getRandomBytes(8), (b) => UID_CHARS[b % UID_CHARS.length]).join("");

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
  /** 경험치 합계 = 공부 기록에서 얻은 경험치 + 배틀로 얻고 잃은 경험치 */
  xp: number;
  /** 연속 기록 보호권 개수 · 보호권/톱니바퀴로 지킨 날짜 */
  freezes: number;
  keptDays: string[];
  buyFreeze(): boolean;
  /** 앱을 열었을 때 끊긴 연속 기록 안내 (보호권 자동 사용 결과 + 톱니바퀴 복구 제안) */
  rescue: StreakRescue | null;
  restoreStreak(): boolean;
  dismissRescue(): void;
  /** 유료 버전 여부 (결제 연동 전이라 시험용으로 켜고 끔) */
  premium: boolean;
  setPremium(v: boolean): void;
  /** 무료 버전 배틀권 (유료 버전이면 무제한) */
  battleTickets: number;
  spendBattleTicket(): boolean;
  refundBattleTicket(): void;
  /** 배틀 결과 경험치 반영 (같은 배틀은 한 번만) */
  applyBattleXp(battleId: string, delta: number): void;
  /** key로 처음 부르면 true, 그다음부터는 false (배틀권 환불 · 배틀 기록 저장을 한 번만 하려고) */
  claimOnce(key: string): boolean;
  /** 친구 추가용 내 UID */
  uid: string;
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
  const [freezes, setFreezes] = useState(0);
  const [keptDays, setKeptDays] = useState<string[]>([]);
  const [premium, setPremiumState] = useState(false);
  const [tickets, setTickets] = useState<Tickets>(() => refillTickets(null));
  const [battleXp, setBattleXp] = useState(0);
  const [uid, setUid] = useState("");
  const [rescue, setRescue] = useState<StreakRescue | null>(null);

  // 비동기 함수 안에서 최신 값을 읽기 위한 ref
  const recordsRef = useRef(records);
  const prefsRef = useRef(prefs);
  const activeRef = useRef(active);
  const gearsRef = useRef(gears);
  const keptRef = useRef(keptDays);
  const freezesRef = useRef(freezes);
  const appliedRef = useRef<string[]>([]);
  useLayoutEffect(() => {
    recordsRef.current = records;
    prefsRef.current = prefs;
    activeRef.current = active;
    gearsRef.current = gears;
    keptRef.current = keptDays;
    freezesRef.current = freezes;
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
    setFreezes(0);
    setKeptDays([]);
    setPremiumState(false);
    setTickets(refillTickets(null));
    setBattleXp(0);
    appliedRef.current = [];
    setUid(newUid());
    setRescue(null);
    setMode("none");
  }, [saveRecordsLocal]);

  // ───────── 앱 시작 ─────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, p, ob, rawRecords, rawActive, g, fz, kd, pm, tk, bx, ba, id] = await Promise.all([
        readJSON<Mode>(K.mode, "none"),
        readJSON<Prefs>(K.prefs, DEFAULT_PREFS),
        readJSON<boolean>(K.onboarded, false),
        readJSON<Partial<StudyRecord>[]>(K.records, []),
        readJSON<ActiveSession | null>(K.active, null),
        readJSON<number | null>(K.gears, null),
        readJSON<number>(K.freezes, 0),
        readJSON<string[]>(K.kept, []),
        readJSON<boolean>(K.premium, false),
        readJSON<Tickets | null>(K.tickets, null),
        readJSON<number>(K.battleXp, 0),
        readJSON<string[]>(K.battlesApplied, []),
        readJSON<string>(K.uid, ""),
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
      const fzn = Math.min(MAX_FREEZES, Math.max(0, fz));
      freezesRef.current = fzn;
      setFreezes(fzn);
      const kdl = Array.isArray(kd) ? kd : [];
      keptRef.current = kdl;
      setKeptDays(kdl);
      setPremiumState(!!pm);
      const t = refillTickets(tk); // 매월 1일 00시가 지났으면 다시 채움
      setTickets(t);
      writeJSON(K.tickets, t);
      setBattleXp(typeof bx === "number" ? bx : 0);
      appliedRef.current = Array.isArray(ba) ? ba : [];
      const myUid = id || newUid();
      setUid(myUid);
      if (!id) writeJSON(K.uid, myUid);

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

  // ───────── 연속 기록 지키기 ─────────
  const saveKept = useCallback((days: string[]) => {
    const next = [...new Set([...keptRef.current, ...days])].sort();
    keptRef.current = next;
    setKeptDays(next);
    writeJSON(K.kept, next);
  }, []);

  /** 앱을 열 때: 빠진 날에 보호권을 자동으로 쓰고, 모자라면 톱니바퀴 복구를 제안 (복구 제안은 하루 한 번) */
  const checkStreak = useCallback(async () => {
    const plan = planStreakRescue(recordsRef.current, keptRef.current, freezesRef.current);
    if (!plan || plan.tooLate) return;
    const today = new Date().toDateString();
    if (!plan.auto.length && (await readJSON<string>(K.rescueAsked, "")) === today) return;
    if (plan.auto.length) {
      saveKept(plan.auto);
      const left = freezesRef.current - plan.auto.length;
      freezesRef.current = left;
      setFreezes(left);
      writeJSON(K.freezes, left);
    }
    writeJSON(K.rescueAsked, today);
    setRescue(plan);
  }, [saveKept]);

  const buyFreeze = useCallback(() => {
    if (freezesRef.current >= MAX_FREEZES || !spendGears(FREEZE_COST)) return false;
    const n = freezesRef.current + 1;
    freezesRef.current = n;
    setFreezes(n);
    writeJSON(K.freezes, n);
    return true;
  }, [spendGears]);

  const restoreStreak = useCallback(() => {
    if (!rescue?.restore.length || !spendGears(rescue.restore.length * RESTORE_COST_PER_DAY)) return false;
    saveKept(rescue.restore);
    setRescue(null);
    return true;
  }, [rescue, saveKept, spendGears]);

  const dismissRescue = useCallback(() => setRescue(null), []);

  // 연속 기록 확인: 앱을 열 때와 앱으로 돌아올 때
  useEffect(() => {
    if (!ready || !onboarded) return;
    checkStreak().catch(() => {});
    const sub = RNAppState.addEventListener("change", (st) => { if (st === "active") checkStreak().catch(() => {}); });
    return () => sub.remove();
  }, [ready, onboarded, checkStreak]);

  // ───────── 유료 버전 · 배틀권 · 배틀 경험치 ─────────
  const setPremium = useCallback((v: boolean) => {
    setPremiumState(v);
    writeJSON(K.premium, v);
  }, []);

  const spendBattleTicket = useCallback(() => {
    if (premium) return true;
    const t = refillTickets(tickets);
    if (t.n <= 0) return false;
    const next = { ...t, n: t.n - 1 };
    setTickets(next);
    writeJSON(K.tickets, next);
    return true;
  }, [premium, tickets]);

  /** 상대가 거절했거나 응답이 없어 배틀이 안 열리면 배틀권을 돌려줌 */
  const refundBattleTicket = useCallback(() => {
    if (premium) return;
    setTickets((t) => {
      const cur = refillTickets(t);
      const next = { ...cur, n: Math.min(cur.n + 1, FREE_BATTLE_TICKETS) };
      writeJSON(K.tickets, next);
      return next;
    });
  }, [premium]);

  const claimOnce = useCallback((key: string) => {
    if (appliedRef.current.includes(key)) return false;
    appliedRef.current = [...appliedRef.current, key].slice(-300);
    writeJSON(K.battlesApplied, appliedRef.current);
    return true;
  }, []);

  const applyBattleXp = useCallback((battleId: string, delta: number) => {
    if (!claimOnce("xp:" + battleId)) return;
    setBattleXp((x) => {
      const nx = x + delta;
      writeJSON(K.battleXp, nx);
      return nx;
    });
  }, [claimOnce]);

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

  const xp = useMemo(() => records.reduce((a, r) => a + (r.rp || 0), 0) + battleXp, [records, battleXp]);

  const value = useMemo<AppStateValue>(() => ({
    ready, mode, email: session?.user.email ?? null, serverEnabled: !!supabase,
    prefs, onboarded, records, active, gears, spendGears,
    xp, freezes, keptDays, buyFreeze, rescue, restoreStreak, dismissRescue,
    premium, setPremium, battleTickets: premium ? Infinity : refillTickets(tickets).n, spendBattleTicket, refundBattleTicket, applyBattleXp, claimOnce, uid,
    startGuest, signUp, signIn, signOut, deleteAccount, updatePrefs, setActive, addRecord, removeRecord,
  }), [ready, mode, session, prefs, onboarded, records, active, gears, spendGears,
    xp, freezes, keptDays, buyFreeze, rescue, restoreStreak, dismissRescue,
    premium, setPremium, tickets, spendBattleTicket, refundBattleTicket, applyBattleXp, claimOnce, uid,
    startGuest, signUp, signIn, signOut, deleteAccount, updatePrefs, setActive, addRecord, removeRecord]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
