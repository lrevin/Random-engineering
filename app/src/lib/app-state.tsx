import {catalogRevision,subscribeCatalog} from "./catalog-sync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {topicById} from "@/data";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import { BATTLE_TICKET_COST, FREE_BATTLE_TICKETS, FREEZE_COST, MAX_BOUGHT_TICKETS, MAX_FREEZES, monthKey, planStreakRescue, PREMIUM_BONUS_GEARS, refillTickets, RESTORE_COST_PER_DAY, type StreakRescue, type Tickets } from "./economy";
import { AD_DAILY_LIMIT, AD_REWARD } from "./ads";
import { resetBoost } from "./booster";
import { resetSkins } from "./skins";
import { dateKey } from "./stats";
import { cancelAllNotifications, rescheduleReminders } from "./notify";
import { mysqlAuth } from "./auth";
import { kakaoSignIn } from "./kakao-login";
import { AuthApiError, type AuthSession, type WalletState } from "./auth-client";
import { enqueueRecordOperation, syncMySqlRecords } from "./record-sync";
import { DEFAULT_PREFS, type ActiveSession, type Prefs, type StudyRecord } from "./types";

/** none: 아직 시작 전(첫 화면) · guest: 로그인 없이 둘러보기 · user: 회원 */
export type Mode = "none" | "guest" | "user";

const K = {
  account: "pg.mysql.owner",
  mode: "pg.mode",
  prefs: "pg.prefs",
  onboarded: "pg.onboarded",
  records: "pg.records",
  active: "pg.active",
  gears: "pg.gears",
  freezes: "pg.freezes",
  kept: "pg.keptDays",
  premium: "pg.premium",
  /** 결제 보너스를 받은 달 ("YYYY-MM" 목록) */
  premiumBonus: "pg.premiumBonus",
  tickets: "pg.battleTickets",
  battleXp: "pg.battleXp",
  battlesApplied: "pg.battlesApplied",
  uid: "pg.uid",
  rescueAsked: "pg.rescueAsked",
  questClaims: "pg.questClaims",
  adViews: "pg.adViews",
};

// Preserve existing MySQL cache keys and account isolation.
for (const key of Object.keys(K) as (keyof typeof K)[]) {
  if (key !== "account") K[key] = K[key].replace(/^pg\./, "pg.mysql.");
}

/** 친구 추가용 UID: 헷갈리는 글자(0/O, 1/I)를 뺀 8자리 */
const UID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newUid = () => Array.from(Crypto.getRandomBytes(8), (b) => UID_CHARS[b % UID_CHARS.length]).join("");

/** 처음 시작할 때 주는 톱니바퀴 (유료 재화). 결제는 아직 없음 */
export const STARTER_GEARS = 30;

type NewRecord = Omit<StudyRecord, "id" | "synced" | "studiedAt">;

interface AppStateValue {
  ready: boolean;
  catalogVersion: number;
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
  spendGears(n: number, product?: string): Promise<boolean>;
  walletNotice: string;
  /** 경험치 합계 = 공부 기록에서 얻은 경험치 + 배틀로 얻고 잃은 경험치 */
  xp: number;
  /** 연속 기록 보호권 개수 · 보호권/톱니바퀴로 지킨 날짜 */
  freezes: number;
  keptDays: string[];
  buyFreeze(): Promise<boolean>;
  /** 앱을 열었을 때 끊긴 연속 기록 안내 (보호권 자동 사용 결과 + 톱니바퀴 복구 제안) */
  rescue: StreakRescue | null;
  restoreStreak(): Promise<boolean>;
  dismissRescue(): void;
  /** 개발용: 연속 기록 복구 창 미리 보기 (어제·그제를 빠진 날로) */
  devPreviewRescue(): void;
  /** 개발용: 어제까지 7일 연속으로 공부한 기록을 넣음 (복습 · 연속 기록 보상 · 업적 점검용) */
  devSeedRecords(topicIds: string[]): void;
  /** 유료 버전 여부 (결제 연동 전이라 시험용으로 켜고 끔) */
  premium: boolean;
  setPremium(v: boolean): void;
  /** 프리미엄 결제: 프리미엄을 켜고 그 순간 톱니바퀴를 넣어 줌. 돌려주는 값은 받은 톱니바퀴 수 (이번 달에 이미 받았으면 0) */
  purchasePremium(): Promise<number>;
  /** 무료 버전 배틀권 (유료 버전이면 무제한) */
  battleTickets: number;
  /** 이번 달 무료 배틀권 / 톱니바퀴로 산 배틀권 */
  freeTickets: number;
  boughtTickets: number;
  /** 톱니바퀴 BATTLE_TICKET_COST개로 배틀권 1개 사기 (최대 MAX_BOUGHT_TICKETS개까지 보유) */
  buyBattleTicket(): Promise<boolean>;
  spendBattleTicket(): Promise<boolean>;
  refundBattleTicket(): void;
  /** 배틀 결과 경험치 반영 (같은 배틀은 한 번만) */
  applyBattleXp(battleId: string, delta: number): void;
  /** key로 처음 부르면 true, 그다음부터는 false (배틀권 환불 · 배틀 기록 저장을 한 번만 하려고) */
  claimOnce(key: string): boolean;
  /** 친구 추가용 내 UID */
  uid: string;
  /** 오늘 본 보상형 광고 수 · 광고를 끝까지 봤을 때 톱니바퀴 지급 (하루 제한 넘으면 false) */
  adViewsToday: number;
  grantAdReward(): Promise<boolean>;
  /** 받은 퀘스트 보상 키 (quest:날짜:id) */
  questClaims: string[];
  /** 퀘스트 보상 받기 (같은 키는 한 번만). 톱니바퀴를 reward개 더함 */
  claimQuest(key: string, reward: number): Promise<boolean>;
  startGuest(): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirm: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signInKakao(): Promise<boolean>;
  signOut(): Promise<void>;
  cancelDeletion(email: string, password: string): Promise<void>;
  refreshRecords(): Promise<void>;
  refreshWallet(): Promise<void>;
  refreshSpeedXp(): Promise<void>;
  updateRecordMemo(id: string, memo: string, choice?: "local" | "server"): Promise<void>;
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

/** 이전 버전(별점 방식) 기록을 새 형식으로 바꿉니다. */
const normalizeRecord = (r: Partial<StudyRecord> & { rating?: number }): StudyRecord => ({
  ...r, id: r.id ?? "", topicId: r.topicId ?? "", topicKo: r.topicKo ?? "", domain: r.domain ?? "it",
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

const sortRecords = (rs: StudyRecord[]) => [...rs].sort((a, b) => a.studiedAt.localeCompare(b.studiedAt));

export function AppProvider({ children }: { children: ReactNode }) {
  const catalogVersion=useSyncExternalStore(subscribeCatalog,catalogRevision,catalogRevision);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("none");
  const [apiSession, setApiSession] = useState<AuthSession | null>(null);
  const ownerRef = useRef<string | null>(null);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [onboarded, setOnboarded] = useState(false);
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [active, setActiveState] = useState<ActiveSession | null>(null);
  const [gears, setGears] = useState(0);
  const [freezes, setFreezes] = useState(0);
  const [keptDays, setKeptDays] = useState<string[]>([]);
  const [premium, setPremiumState] = useState(false);
  const [tickets, setTickets] = useState<Tickets>(() => refillTickets(null));
  const ticketsRef = useRef<Tickets>(refillTickets(null));
  const [battleXp, setBattleXp] = useState(0);
  const [speedXp,setSpeedXp]=useState(0);
  const [questClaims, setQuestClaims] = useState<string[]>([]);
  const questRef = useRef<string[]>([]);
  // 오늘 본 보상형 광고 수 { day: "YYYY-MM-DD", n }
  const [adViews, setAdViews] = useState<{ day: string; n: number }>({ day: "", n: 0 });
  const adRef = useRef<{ day: string; n: number }>({ day: "", n: 0 });
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
  const [walletNotice, setWalletNotice] = useState("");
  const walletQueue = useRef<Promise<unknown>>(Promise.resolve());
  const walletRevision = useRef("0");
  const applyWallet = useCallback((value: WalletState) => {
    const revision=value.revision??"0";
    if(BigInt(revision)<BigInt(walletRevision.current))return;
    walletRevision.current=revision;
    gearsRef.current=value.balance; setGears(value.balance); writeJSON(K.gears,value.balance);
    freezesRef.current=value.state.freezes; setFreezes(value.state.freezes); writeJSON(K.freezes,value.state.freezes);
    const t={n:value.state.freeTickets,bought:value.state.boughtTickets,month:value.state.month};
    ticketsRef.current=t;setTickets(t);writeJSON(K.tickets,t);
    setPremiumState(value.state.premium);writeJSON(K.premium,value.state.premium);
    keptRef.current=value.state.keptDays;setKeptDays(value.state.keptDays);writeJSON(K.kept,value.state.keptDays);
    questRef.current=value.claims;setQuestClaims(value.claims);writeJSON(K.questClaims,value.claims);
    if(typeof value.adsToday==="number"){adRef.current={day:dateKey(new Date()),n:value.adsToday};setAdViews(adRef.current);writeJSON(K.adViews,adRef.current);}
  }, []);
  const refreshWallet = useCallback(async () => {
    const owner=ownerRef.current;
    if(!owner)return;
    const value=await mysqlAuth.getWallet();
    if(ownerRef.current===owner){applyWallet(value);setWalletNotice("");}
  },[applyWallet]);
  const remoteWallet = useCallback((action: string, payload: Record<string,unknown> = {}) => {
    const owner=ownerRef.current;
    const run=walletQueue.current.catch(()=>{}).then(async()=>{
      if(!owner || ownerRef.current!==owner)return false;
      const key='pg.mysql.wallet.pending.'+owner;
      const pending=await readJSON<{id:string;action:string;payload:Record<string,unknown>}|null>(key,null);
      if(pending){
        try {const value=await mysqlAuth.walletOperation(pending.id,pending.action,pending.payload);if(ownerRef.current!==owner)return false;applyWallet(value);await AsyncStorage.removeItem(key);
          if(pending.action===action&&JSON.stringify(pending.payload)===JSON.stringify(payload)){setWalletNotice("");return true;}
        }catch(e){if(e instanceof AuthApiError&&e.status>=400&&e.status<500)await AsyncStorage.removeItem(key);throw e;}
      }
      const request={id:Crypto.randomUUID(),action,payload};await AsyncStorage.setItem(key,JSON.stringify(request));
      try {const value=await mysqlAuth.walletOperation(request.id,action,payload);if(ownerRef.current!==owner)return false;applyWallet(value);await AsyncStorage.removeItem(key);setWalletNotice("");return true;}
      catch(e){if(e instanceof AuthApiError&&e.status>=400&&e.status<500)await AsyncStorage.removeItem(key);throw e;}
    }).catch((e:unknown)=>{
      if(ownerRef.current===owner){const code=e instanceof AuthApiError?e.code:'';setWalletNotice(({insufficient_balance:'톱니바퀴가 부족해요.',verification_required:'서버의 광고·결제 확인을 준비하고 있어요.',product_not_available:'이 상품의 계정 저장을 준비하고 있어요.',operation_not_available:'이 기능의 서버 연결을 준비하고 있어요.',quest_not_complete:'서버에 저장된 학습 기록으로 보상 조건을 확인하지 못했어요.',already_claimed:'이미 받은 보상이에요.'} as Record<string,string>)[code]??'서버에 연결하지 못했어요. 다시 시도해 주세요.');}return false;
    });walletQueue.current=run;return run;
  }, [applyWallet]);
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
    return enqueueRecordOperation(syncQueue, async () => {
      if (ownerRef.current !== userId) return;
      await syncMySqlRecords(mysqlAuth, () => recordsRef.current, saveRecordsLocal,
        () => ownerRef.current === userId,
        r => AsyncStorage.setItem("pg.mysql.memo-draft." + userId + "." + r.id, JSON.stringify(r)));
    });
  }, [saveRecordsLocal]);

  const clearLocal = useCallback(async () => {
    ownerRef.current = null;
    walletRevision.current="0";
    setApiSession(null);
    await AsyncStorage.multiRemove([...Object.values(K), "pg.exam", "pg.exam.active", "pg.review.done2", "pg.recall", "pg.certDates", "pg.speed"]).catch(() => {});
    resetSkins();
    resetBoost();
    await cancelAllNotifications().catch(() => {});
    setPrefs(DEFAULT_PREFS);
    setOnboarded(false);
    saveRecordsLocal([]);
    setActiveState(null);
    gearsRef.current = STARTER_GEARS;
    setGears(STARTER_GEARS);
    setFreezes(0);
    setKeptDays([]);
    setPremiumState(false);
    ticketsRef.current = refillTickets(null);
    setTickets(refillTickets(null));
    setBattleXp(0);setSpeedXp(0);
    questRef.current = [];
    setQuestClaims([]);
    appliedRef.current = [];
    setUid(newUid());
    setRescue(null);
    setMode("none");
  }, [saveRecordsLocal]);

  const restoreAccountExtras = useCallback(async () => {
    const [fz,kd,pm,tk,bx,ba,id,qc,av] = await Promise.all([
      readJSON<number>(K.freezes,0),readJSON<string[]>(K.kept,[]),readJSON<boolean>(K.premium,false),readJSON<Tickets|null>(K.tickets,null),
      readJSON<number>(K.battleXp,0),readJSON<string[]>(K.battlesApplied,[]),readJSON<string>(K.uid,""),readJSON<string[]>(K.questClaims,[]),readJSON<{day:string;n:number}>(K.adViews,{day:"",n:0}),
    ]);
      const fzn = Math.min(MAX_FREEZES, Math.max(0, fz));
      freezesRef.current = fzn;
      setFreezes(fzn);
      const kdl = Array.isArray(kd) ? kd : [];
      keptRef.current = kdl;
      setKeptDays(kdl);
      setPremiumState(!!pm);
      const t = refillTickets(tk); // 매월 1일 00시가 지났으면 다시 채움
      ticketsRef.current = t;
      setTickets(t);
      writeJSON(K.tickets, t);
      setBattleXp(typeof bx === "number" ? bx : 0);
      appliedRef.current = Array.isArray(ba) ? ba : [];
      questRef.current = Array.isArray(qc) ? qc : [];
      setQuestClaims(questRef.current);
      adRef.current = av && typeof av.n === "number" ? av : { day: "", n: 0 };
      setAdViews(adRef.current);
      const myUid = id || newUid();
      setUid(myUid);
      if (!id) writeJSON(K.uid, myUid);

  }, []);

  const archiveApiAccount = useCallback(async () => {
    const owner = await readJSON<string | null>(K.account, null);
    if (!owner) return;
    await AsyncStorage.setItem(`pg.mysql.local.${owner}`, JSON.stringify({
      extras: await AsyncStorage.multiGet(Object.values(K)),
      prefs: prefsRef.current, records: recordsRef.current, active: activeRef.current,
      gears: gearsRef.current, onboarded: await readJSON(K.onboarded, false),
    }));
  }, []);

  const refreshSpeedXp=useCallback(async()=>{
    const id=ownerRef.current;if(!id)return;
    const stats=await mysqlAuth.getSpeedStats();if(ownerRef.current!==id)return;
    setSpeedXp(stats.totalXp);await writeJSON("pg.mysql.speed.xp."+id,stats.totalXp);
  },[]);

  const refreshApiProfile = useCallback(async () => {
    try {
      let remote = await mysqlAuth.getProfile();
      const localOnboarded = await readJSON(K.onboarded, false);
      if (!remote && localOnboarded && prefsRef.current.nickname && prefsRef.current.interests.length) {
        remote = await mysqlAuth.saveProfile(prefsRef.current);
      }
      if (remote) {
        prefsRef.current = remote; setPrefs(remote);
        const complete = !!remote.nickname && remote.interests.length > 0;
        setOnboarded(complete);
        await AsyncStorage.multiSet([[K.prefs, JSON.stringify(remote)], [K.onboarded, JSON.stringify(complete)]]);
      }
    } catch { /* Offline/temporary failure keeps the account's cached profile. */ }
  }, []);

  const loadApiAccount = useCallback(async (s: AuthSession) => {
    const owner = await readJSON<string | null>(K.account, null);
    const previousMode = await readJSON<Mode>(K.mode, "none");
    if (owner !== s.user.id) {
      await archiveApiAccount();
      const saved = await readJSON<{ extras?: [string,string|null][]; prefs: Prefs; records: StudyRecord[]; active: ActiveSession | null; gears: number; onboarded: boolean } | null>(`pg.mysql.local.${s.user.id}`, null);
      if (owner || previousMode === "user" || saved) await clearLocal();
      if (saved) {
        if(saved.extras) await AsyncStorage.multiSet(saved.extras.filter((pair): pair is [string,string] => pair[1] !== null));
        await restoreAccountExtras();
        prefsRef.current = saved.prefs; setPrefs(saved.prefs);
        saveRecordsLocal(saved.records); activeRef.current = saved.active; setActiveState(saved.active);
        gearsRef.current = saved.gears; setGears(saved.gears); setOnboarded(saved.onboarded);
        await AsyncStorage.multiSet([
          [K.prefs, JSON.stringify(saved.prefs)], [K.active, JSON.stringify(saved.active)],
          [K.gears, JSON.stringify(saved.gears)], [K.onboarded, JSON.stringify(saved.onboarded)],
        ]);
      }
    }
    ownerRef.current = s.user.id;
    saveRecordsLocal(recordsRef.current.filter(r=>!r.devOnly));
    setSpeedXp(await readJSON<number>("pg.mysql.speed.xp."+s.user.id,0));
    await writeJSON(K.account, s.user.id);
    setApiSession(s);
    setModePersist("user");
    await refreshApiProfile();
    await refreshSpeedXp().catch(()=>{});
    try { const value=await mysqlAuth.getWallet();if(ownerRef.current===s.user.id)applyWallet(value); }catch {setWalletNotice('재화 정보를 갱신하지 못했어요. 인터넷 연결 후 다시 열어 주세요.');}
    try { const social=await mysqlAuth.apiRequest('/social/me',{},'POST');if(ownerRef.current===s.user.id){setUid(social.uid);await writeJSON(K.uid,social.uid);} }catch { /* Friends retry on the next account load. */ }
    await syncPending(s.user.id).catch(() => {});
  }, [applyWallet, archiveApiAccount, clearLocal, refreshSpeedXp, refreshApiProfile, restoreAccountExtras, saveRecordsLocal, setModePersist, syncPending]);

  const cancelDeletion = useCallback(async (email: string, password: string) => {
    await loadApiAccount(await mysqlAuth.cancelDeletion(email, password));
  }, [loadApiAccount]);

  const refreshRecords = useCallback(async () => {
    const id = apiSession?.user.id;
    if (mode === "user" && id) await syncPending(id);
  }, [apiSession, mode, syncPending]);

  const updateRecordMemo = useCallback(async (id: string, memo: string, choice?: "local" | "server") => {
    if ([...memo].length > 5000) throw new Error("메모는 5,000자까지 저장할 수 있어요.");
    const r = recordsRef.current.find(x => x.id === id);
    if (!r) return;
    const conflict = r.memoConflict;
    if (choice === "server" && conflict) {
      saveRecordsLocal(recordsRef.current.map(x => x.id === id ? {...x, memo: conflict.memo, changeSeq: conflict.changeSeq, memoPending: undefined, memoConflict: undefined} : x));
      return;
    }
    const changed = {...r, memo, memoConflict: undefined,
      memoPending: mode === "user" ? {version: Crypto.randomUUID(), baseChangeSeq: choice === "local" ? conflict?.changeSeq : r.memoPending?.baseChangeSeq ?? r.changeSeq} : undefined};
    saveRecordsLocal(recordsRef.current.map(x => x.id === id ? changed : x));
    if (mode === "user" && apiSession) await syncPending(apiSession.user.id).catch(() => {});
  }, [mode, apiSession, saveRecordsLocal, syncPending]);

  // ───────── 앱 시작 ─────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, p, ob, rawRecords, rawActive, g, fz, kd, pm, tk, bx, ba, id, qc, av] = await Promise.all([
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
        readJSON<string[]>(K.questClaims, []),
        readJSON<{ day: string; n: number }>(K.adViews, { day: "", n: 0 }),
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
      ticketsRef.current = t;
      setTickets(t);
      writeJSON(K.tickets, t);
      setBattleXp(typeof bx === "number" ? bx : 0);
      appliedRef.current = Array.isArray(ba) ? ba : [];
      questRef.current = Array.isArray(qc) ? qc : [];
      setQuestClaims(questRef.current);
      adRef.current = av && typeof av.n === "number" ? av : { day: "", n: 0 };
      setAdViews(adRef.current);
      const myUid = id || newUid();
      setUid(myUid);
      if (!id) writeJSON(K.uid, myUid);

      try {
        const restored = await mysqlAuth.restore();
        if (!alive) return;
        if (restored) await loadApiAccount(restored);
        else setMode(m === "user" ? "none" : m);
      } catch { if (alive) setMode(m === "user" ? "none" : m); }
      finally { if (alive) setReady(true); }
    })();
    return () => { alive = false; };
  }, [loadApiAccount]);

  // 로그아웃 감지 (토큰 만료, 다른 기기에서 탈퇴 등)
  useEffect(() => mysqlAuth.subscribe(s => {
    setApiSession(s);
    if (!s) setModePersist("none");
  }), [setModePersist]);

  useEffect(() => {
    if (mode !== "user") return;
    const client = mysqlAuth;
    const refresh = () => { const owner=ownerRef.current;refreshSpeedXp().catch(()=>{});client.ensure().then(setApiSession).catch(() => {});client.getWallet().then(value=>{if(owner&&ownerRef.current===owner)applyWallet(value);}).catch(()=>{});client.apiRequest("/social/me",{},"POST").then(data=>{if(owner&&ownerRef.current===owner){setUid(data.uid);writeJSON(K.uid,data.uid);}}).catch(()=>{}); };
    const timer = setInterval(() => { if (RNAppState.currentState === "active") refresh(); }, 60000);
    const sub = RNAppState.addEventListener("change", st => { if (st === "active") refresh(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [mode, applyWallet, refreshSpeedXp]);

  // 앱으로 돌아올 때마다 밀린 기록 동기화 + 알림 다시 예약
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", (st) => {
      if (st !== "active") return;
      if (mode === "user" && apiSession) syncPending(apiSession.user.id).catch(() => {});
      if (onboarded) rescheduleReminders(prefsRef.current, recordsRef.current).catch(() => {});
    });
    return () => sub.remove();
  }, [mode, apiSession, onboarded, syncPending]);

  useEffect(() => {
    if (ready && onboarded) rescheduleReminders(prefs, records).catch(() => {});
  }, [ready, onboarded, prefs, records]);


  // ───────── 동작 ─────────
  const startGuest = useCallback(async () => setModePersist("guest"), [setModePersist]);

  const signUp = useCallback(async (email: string, password: string) => {
    await loadApiAccount(await mysqlAuth.signUp(email, password));
    return { needsConfirm: false };
  }, [loadApiAccount]);

  const signIn = useCallback(async (email: string, password: string) => {
    await loadApiAccount(await mysqlAuth.signIn(email, password));
  }, [loadApiAccount]);

  /** 카카오 로그인 (처음이면 계정이 새로 생기고 처음 설정 화면으로). 취소하면 false */
  const signInKakao = useCallback(async () => {
    const s = await kakaoSignIn();
    if (!s) return false;
    await loadApiAccount(s);
    return true;
  }, [loadApiAccount]);

  const signOut = useCallback(async () => {
    await archiveApiAccount();
    try { await mysqlAuth.signOut(); } catch { /* Clear local login even when offline. */ }
    await clearLocal();
  }, [archiveApiAccount, clearLocal]);

  const deleteAccount = useCallback(async () => {
    if (mode === "user") {
      const id = apiSession?.user.id;
      await mysqlAuth.deleteAccount();
      if (id) {
        const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith("pg.mysql.memo-draft." + id + ".") || key === "pg.mysql.local." + id || key.startsWith("pg.mysql.speed.")&&key.endsWith("."+id));
        await AsyncStorage.multiRemove(keys);
      }
      await clearLocal(); return;
    }
    await clearLocal();
  }, [mode, apiSession, clearLocal]);

  const updatePrefs = useCallback(async (patch: Partial<Prefs>, opts?: { finishOnboarding?: boolean }) => {
    let next = { ...prefsRef.current, ...patch };
    if (mode === "user") next = await mysqlAuth.saveProfile(next);
    prefsRef.current = next;
    setPrefs(next);
    writeJSON(K.prefs, next);
    if (opts?.finishOnboarding) {
      setOnboarded(true);
      writeJSON(K.onboarded, true);
    }
  }, [mode]);

  const setActive = useCallback((a: ActiveSession | null | ((prev: ActiveSession | null) => ActiveSession | null)) => {
    const next = typeof a === "function" ? a(activeRef.current) : a;
    activeRef.current = next;
    setActiveState(next);
    writeJSON(K.active, next);
  }, []);

  const spendGears = useCallback(async (n: number, product?: string) => {
    if(mode==='user')return remoteWallet('spend',{product:product??'unsupported'});
    if(!Number.isInteger(n)||n<=0)return false;
    if (gearsRef.current < n) return false;
    const next = gearsRef.current - n;
    gearsRef.current = next;
    setGears(next);
    writeJSON(K.gears, next);
    return true;
  }, [mode, remoteWallet]);

  // ───────── 연속 기록 지키기 ─────────
  const saveKept = useCallback((days: string[]) => {
    const next = [...new Set([...keptRef.current, ...days])].sort();
    keptRef.current = next;
    setKeptDays(next);
    writeJSON(K.kept, next);
  }, []);

  /** 앱을 열 때: 빠진 날에 보호권을 자동으로 쓰고, 모자라면 톱니바퀴 복구를 제안 (복구 제안은 하루 한 번) */
  const checkStreak = useCallback(async () => {
    if(mode==="user"){
      const ok=await remoteWallet('check_streak');
      if(ok){const plan=planStreakRescue(recordsRef.current,keptRef.current,freezesRef.current);if(plan&&!plan.tooLate)setRescue(plan);}
      return;
    }
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
  }, [mode, remoteWallet, saveKept]);

  const buyFreeze = useCallback(async () => {
    if(mode==="user")return remoteWallet("buy_freeze");
    if (freezesRef.current >= MAX_FREEZES || !await spendGears(FREEZE_COST)) return false;
    const n = freezesRef.current + 1;
    freezesRef.current = n;
    setFreezes(n);
    writeJSON(K.freezes, n);
    return true;
  }, [mode, remoteWallet, spendGears]);

  const restoreStreak = useCallback(async () => {
    if(mode==="user"){const ok=await remoteWallet("restore_streak");if(ok)setRescue(null);return ok;}
    if (!rescue?.restore.length || !await spendGears(rescue.restore.length * RESTORE_COST_PER_DAY)) return false;
    saveKept(rescue.restore);
    setRescue(null);
    return true;
  }, [mode, remoteWallet, rescue, saveKept, spendGears]);

  const dismissRescue = useCallback(() => setRescue(null), []);
  const devPreviewRescue = useCallback(() => {
    const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return dateKey(x); };
    setRescue({ streak: 5, auto: freezesRef.current > 0 ? [d(2)] : [], restore: freezesRef.current > 0 ? [d(1)] : [d(2), d(1)], tooLate: false });
  }, []);

  const devSeedRecords = useCallback((topicIds: string[]) => {
    if(!__DEV__ || mode!=="guest")return;
    const seeded: StudyRecord[] = topicIds.slice(0, 7).flatMap((id, i) => {
      const t = topicById(id);
      if (!t) return [];
      const at = new Date();
      at.setDate(at.getDate() - (7 - i));
      at.setHours(20, 0, 0, 0);
      return [{
        id: Crypto.randomUUID(), devOnly:true, topicId: t.id, topicKo: t.ko, domain: t.domain, category: t.category, level: t.level,
        memo: "", score: 5, total: 7, rp: 30, wrong: [], studySec: 600, quizSource: "bank" as const, studiedAt: at.toISOString(), synced: false,
      }];
    });
    saveRecordsLocal(sortRecords([...recordsRef.current, ...seeded]));
  }, [mode, saveRecordsLocal]);

  // 연속 기록 확인: 앱을 열 때와 앱으로 돌아올 때
  useEffect(() => {
    if (!ready || !onboarded) return;
    checkStreak().catch(() => {});
    const sub = RNAppState.addEventListener("change", (st) => { if (st === "active") checkStreak().catch(() => {}); });
    return () => sub.remove();
  }, [ready, onboarded, checkStreak]);

  // ───────── 유료 버전 · 배틀권 · 배틀 경험치 ─────────
  const setPremium = useCallback((v: boolean) => {
    if(mode==="user"){setWalletNotice("프리미엄 결제 확인을 준비하고 있어요.");return;}
    setPremiumState(v);
    writeJSON(K.premium, v);
  }, [mode]);

  // 배틀권: 사자마자 바로 쓰는 경우(톱니바퀴로 사서 매칭)가 있어서 최신 값을 ref로 들고 있음
  const saveTickets = useCallback((next: Tickets) => {
    ticketsRef.current = next;
    setTickets(next);
    writeJSON(K.tickets, next);
  }, []);
  // 마지막으로 쓴 배틀권 종류 (돌려줄 때 같은 곳으로)
  const lastTicketRef = useRef<"free" | "bought">("free");
  const spendBattleTicket = useCallback(async () => {
    if(mode==="user"){setWalletNotice("배틀 서버 연결을 준비하고 있어요.");return false;}
    if (premium) return true;
    const t = refillTickets(ticketsRef.current);
    const bought = t.bought ?? 0;
    if (t.n <= 0 && bought <= 0) return false;
    // 무료 배틀권부터 씀 (산 배틀권은 달이 바뀌어도 남으니까)
    lastTicketRef.current = t.n > 0 ? "free" : "bought";
    saveTickets(t.n > 0 ? { ...t, n: t.n - 1 } : { ...t, bought: bought - 1 });
    return true;
  }, [mode, premium, saveTickets]);

  /** 톱니바퀴로 배틀권 1개 사기 */
  const buyBattleTicket = useCallback(async () => {
    if(mode==="user")return remoteWallet("buy_battle_ticket");
    const t = refillTickets(ticketsRef.current);
    if ((t.bought ?? 0) >= MAX_BOUGHT_TICKETS || !await spendGears(BATTLE_TICKET_COST)) return false;
    saveTickets({ ...t, bought: (t.bought ?? 0) + 1 });
    return true;
  }, [mode, remoteWallet, spendGears, saveTickets]);

  /** 상대가 거절했거나 응답이 없어 배틀이 안 열리면 배틀권을 돌려줌 */
  const refundBattleTicket = useCallback(() => {
    if(mode==="user")return;
    if (premium) return;
    const cur = refillTickets(ticketsRef.current);
    saveTickets(lastTicketRef.current === "bought"
      ? { ...cur, bought: (cur.bought ?? 0) + 1 }
      : { ...cur, n: Math.min(cur.n + 1, FREE_BATTLE_TICKETS) });
  }, [mode, premium, saveTickets]);

  const claimOnce = useCallback((key: string) => {
    if (appliedRef.current.includes(key)) return false;
    appliedRef.current = [...appliedRef.current, key].slice(-300);
    writeJSON(K.battlesApplied, appliedRef.current);
    return true;
  }, []);

  /** 결제하는 순간 톱니바퀴를 계정에 추가. 같은 달에 껐다 켜도 한 번만 (결제 한 번 = 보너스 한 번) */
  const purchasePremium = useCallback(async () => {
    if(mode==="user"){await remoteWallet("premium");return 0;}
    setPremium(true);
    const month = monthKey();
    const got = await readJSON<string[]>(K.premiumBonus, []);
    // 예전 방식(배틀 기록 목록)으로 받은 달도 받은 것으로 침
    if (got.includes(month) || appliedRef.current.includes("premium-bonus:" + month)) return 0;
    writeJSON(K.premiumBonus, [...got, month].slice(-36));
    gearsRef.current += PREMIUM_BONUS_GEARS;
    setGears(gearsRef.current);
    writeJSON(K.gears, gearsRef.current);
    return PREMIUM_BONUS_GEARS;
  }, [mode, remoteWallet, setPremium]);

  const applyBattleXp = useCallback((battleId: string, delta: number) => {
    if (mode === "user" || !claimOnce("xp:" + battleId)) return;
    setBattleXp((x) => {
      const nx = x + delta;
      writeJSON(K.battleXp, nx);
      return nx;
    });
  }, [claimOnce, mode]);

  // ───────── 보상형 광고: 끝까지 보면 톱니바퀴 (하루 AD_DAILY_LIMIT번) ─────────
  const grantAdReward = useCallback(async () => {
    if(mode==="user"){
      // 회원: 구글이 서버로 직접 알려 준 뒤(SSV) 서버가 지급함 → 지갑을 몇 번 다시 읽어 지급됐는지 확인
      const owner=ownerRef.current;
      const before=adRef.current.day===dateKey(new Date())?adRef.current.n:0;
      for(let i=0;i<8;i++){
        await new Promise(r=>setTimeout(r,1500));
        if(ownerRef.current!==owner)return false;
        try{const v=await mysqlAuth.getWallet();applyWallet(v);if((v.adsToday??0)>before)return true;}catch{/* 다음 시도 */}
      }
      return false;
    }
    const day = dateKey(new Date());
    const cur = adRef.current.day === day ? adRef.current : { day, n: 0 };
    if (cur.n >= AD_DAILY_LIMIT) return false;
    adRef.current = { day, n: cur.n + 1 };
    setAdViews(adRef.current);
    writeJSON(K.adViews, adRef.current);
    gearsRef.current += AD_REWARD;
    setGears(gearsRef.current);
    writeJSON(K.gears, gearsRef.current);
    return true;
  }, [mode, applyWallet]);

  // ───────── 오늘의 퀘스트 보상 ─────────
  const claimQuest = useCallback(async (key: string, reward: number) => {
    if(mode==="user")return remoteWallet("quest",{key});
    if (questRef.current.includes(key)) return false;
    questRef.current = [...questRef.current, key].slice(-200);
    setQuestClaims(questRef.current);
    writeJSON(K.questClaims, questRef.current);
    gearsRef.current += reward;
    setGears(gearsRef.current);
    writeJSON(K.gears, gearsRef.current);
    return true;
  }, [mode, remoteWallet]);

  const addRecord = useCallback(async (r: NewRecord) => {
    const rec: StudyRecord = { ...r, id: Crypto.randomUUID(), studiedAt: new Date().toISOString(), synced: false };
    saveRecordsLocal(sortRecords([...recordsRef.current, rec]));
    if (mode === "user" && apiSession) await syncPending(apiSession.user.id).catch(() => {});
    return recordsRef.current.find(x => x.id === rec.id) ?? rec;
  }, [mode, apiSession, saveRecordsLocal, syncPending]);

  const removeRecord = useCallback(async (id: string) => {
    const target = recordsRef.current.find((r) => r.id === id);
    if (!target) return;
    if (mode === "user") {
      const owner = ownerRef.current, client = mysqlAuth;
      await enqueueRecordOperation(syncQueue, async () => {
        if (ownerRef.current !== owner) return;
        try { await client.deleteRecord(id); }
        catch (e) { if (!(e instanceof AuthApiError) || e.status !== 404 || target.synced) throw e; }
        if (ownerRef.current === owner) saveRecordsLocal(recordsRef.current.filter(r => r.id !== id));
      });
      return;
    }
    saveRecordsLocal(recordsRef.current.filter((r) => r.id !== id));
  }, [mode, saveRecordsLocal]);

  const xp = useMemo(() => Math.max(0, records.reduce((a, r) => a + (r.rp || 0), 0) + (mode === "user" ? 0 : battleXp) + speedXp), [records, battleXp, speedXp, mode]);

  const value = useMemo<AppStateValue>(() => ({
    ready, mode, email: apiSession?.user.email ?? null, serverEnabled: true,
    catalogVersion, prefs, onboarded, records, active, gears, spendGears, walletNotice,
    xp, freezes, keptDays, buyFreeze, rescue, restoreStreak, dismissRescue, devPreviewRescue, devSeedRecords,
    premium, setPremium, purchasePremium, battleTickets: premium ? Infinity : (mode === "user" ? tickets : refillTickets(tickets)).n + ((mode === "user" ? tickets : refillTickets(tickets)).bought ?? 0), freeTickets: (mode === "user" ? tickets : refillTickets(tickets)).n, boughtTickets: (mode === "user" ? tickets : refillTickets(tickets)).bought ?? 0, buyBattleTicket, spendBattleTicket, refundBattleTicket, applyBattleXp, claimOnce, uid, questClaims, claimQuest, adViewsToday: adViews.day === dateKey(new Date()) ? adViews.n : 0, grantAdReward,
    startGuest, signUp, signIn, signInKakao, signOut, cancelDeletion, refreshRecords, refreshWallet, refreshSpeedXp, updateRecordMemo, deleteAccount, updatePrefs, setActive, addRecord, removeRecord,
  }), [catalogVersion, ready, mode, apiSession, prefs, onboarded, records, active, gears, spendGears, walletNotice,
    xp, freezes, keptDays, buyFreeze, rescue, restoreStreak, dismissRescue, devPreviewRescue, devSeedRecords,
    premium, setPremium, purchasePremium, tickets, buyBattleTicket, spendBattleTicket, refundBattleTicket, applyBattleXp, claimOnce, uid, questClaims, claimQuest, adViews, grantAdReward,
    startGuest, signUp, signIn, signInKakao, signOut, cancelDeletion, refreshRecords, refreshWallet, refreshSpeedXp, updateRecordMemo, deleteAccount, updatePrefs, setActive, addRecord, removeRecord]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
