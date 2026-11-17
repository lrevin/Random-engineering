/**
 * 오답 보스전 (서버 api/mysql/boss-service.mjs, 규칙 숫자는 boss-policy.mjs와 같아야 함 — 서버 테스트가 비교)
 * - 내 관심 분야를 고른 사람들이 자주 · 많이 틀린 문제 50개 (모자라면 그 분야 문제 은행으로 채움)
 * - 한 주(월~일)에 한 판. 맞히면 보스 체력 -10(30번이면 처치), 틀리면 내 체력 -5(20번이면 실패)
 * - 클리어 보상: 남은 체력이 많을수록 톱니바퀴 · XP가 많음 + 0.01% 확률로 전용 테마 '블러드 이클립스'
 * 둘러보기(게스트)는 서버를 못 쓰므로 이 휴대폰의 오답 + 문제 은행으로 같은 규칙의 판을 만듦 (보상은 이 휴대폰에)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { TOPICS, inInterests } from "@/data";
import { mysqlAuth } from "./auth";
import { AuthApiError } from "./auth-client";
import { LOCAL_KEYS } from "./local-data";
import { bankQuestions, type QuizQuestion } from "./quiz";
import type { StudyRecord } from "./types";

export const BOSS_QUESTIONS = 50;
export const CLEAR_HITS = 30;
export const BOSS_HIT = 10;
export const PLAYER_HP = 100;
export const PLAYER_HIT = 5;
export const BOSS_THEME = "eclipse";
export const BOSS_THEME_ODDS = 10000;
/** 화면에 보여 주는 확률 */
export const BOSS_THEME_ODDS_TEXT = "0.01%";
/** 틀려도 되는 횟수 */
export const MAX_MISSES = PLAYER_HP / PLAYER_HIT;

/** 남은 체력이 많을수록 보상이 큼 (서버 bossReward와 같음) */
export function bossReward(hp: number) {
  if (!(hp > 0)) return { gears: 0, xp: 0 };
  const k = Math.min(hp, PLAYER_HP) / PLAYER_HP;
  return { gears: Math.round(40 + 60 * k), xp: Math.round(80 + 120 * k) };
}
export const MAX_REWARD = bossReward(PLAYER_HP);

export interface BossQuestion { position: number; q: string; choices: string[]; topic: string | null; wrong: number }
export interface BossRun {
  runId: string; status: "issued" | "cleared" | "failed"; bossHp: number; bossMaxHp: number; playerHp: number; position: number; total: number;
  question: BossQuestion | null; reward: null | { gears: number; xp: number; theme: string | null };
}
export interface BossAnswer extends BossRun { correct: boolean; answer: number; explain: string }
export interface BossStatus {
  week: { start: string; end: string };
  interests: string[];
  run: null | { runId: string; status: BossRun["status"] };
  ownsTheme: boolean;
}

export function bossMessage(e: unknown) {
  const code = e instanceof AuthApiError ? e.code : e instanceof Error ? e.message : "";
  return ({
    boss_week_used: "이번 주 보스전은 이미 했어요. 다음 주 월요일에 새 보스가 나타나요.",
    boss_no_interest: "관심 분야를 먼저 골라 주세요. (설정 > 관심 분야)",
    boss_not_ready: `관심 분야 문제가 아직 ${CLEAR_HITS}개가 안 돼요. 관심 분야를 늘려 보세요.`,
    boss_finished: "이미 끝난 보스전이에요.",
    unauthorized: "로그인 후 이용해 주세요.",
    network_error: "인터넷 연결을 확인해 주세요.",
  } as Record<string, string>)[code] ?? "보스전 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

/** 답 하나 반영 (서버 applyBossAnswer와 같음) */
export function applyBossAnswer(run: { position: number; total: number; bossHp: number; playerHp: number }, correct: boolean) {
  let { bossHp, playerHp } = run;
  if (correct) bossHp = Math.max(0, bossHp - BOSS_HIT);
  else playerHp = Math.max(0, playerHp - PLAYER_HIT);
  const next = run.position + 1;
  const status: BossRun["status"] = bossHp === 0 ? "cleared" : playerHp === 0 || next >= run.total ? "failed" : "issued";
  return { bossHp, playerHp, status, next };
}

/** 이번 주 월요일(한국 시간) 'YYYY-MM-DD' */
export function weekStartKst(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600e3);
  kst.setUTCDate(kst.getUTCDate() - ((kst.getUTCDay() + 6) % 7));
  return kst.toISOString().slice(0, 10);
}
const weekEnd = (start: string) => { const d = new Date(start + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); };

/** 판 하나를 진행하는 쪽 (회원 = 서버, 게스트 = 이 휴대폰) */
export interface BossEngine {
  status(): Promise<BossStatus>;
  /** 이번 주 판 시작 · 이어 하기 */
  start(): Promise<BossRun>;
  answer(position: number, answer: number): Promise<BossAnswer>;
}

// ───────── 회원: 서버 ─────────
const call = <T,>(path: string, body?: unknown, method?: "GET" | "POST") => mysqlAuth.apiRequest(path, body, method) as Promise<T>;
export function serverBoss(): BossEngine {
  let runId = "";
  return {
    status: () => call<BossStatus>("/me/boss"),
    async start() {
      // 같은 요청을 두 번 보내도 한 판만 생기게, 성공할 때까지 같은 requestId
      const key = "pg.boss.start." + (mysqlAuth.getUserId() ?? "");
      let requestId = await AsyncStorage.getItem(key);
      if (!requestId) { requestId = Crypto.randomUUID(); await AsyncStorage.setItem(key, requestId); }
      const run = await call<BossRun>("/me/boss/runs", { requestId }, "POST");
      runId = run.runId;
      return run;
    },
    answer: (position, answer) => call<BossAnswer>(`/me/boss/runs/${runId}/answers`, { position, answer }, "POST"),
  };
}

// ───────── 게스트: 이 휴대폰 ─────────
type Q = { q: string; choices: string[]; answer: number; explain: string; topic: string | null; wrong: number };
interface LocalRun { week: string; runId: string; status: BossRun["status"]; bossHp: number; playerHp: number; position: number; questions: Q[]; reward: BossRun["reward"] }

const toQ = (s: QuizQuestion, topic: string | null, wrong: number): Q | null => {
  if (s.type === "mc" && s.choices.length === 4) return { q: s.q, choices: s.choices, answer: s.answer, explain: s.explain, topic, wrong };
  if (s.type === "ox") return { q: s.q, choices: ["O (맞다)", "X (틀리다)"], answer: s.answer ? 0 : 1, explain: s.explain, topic, wrong };
  return null;
};
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** 이 휴대폰 기록에서 관심 분야 주제의 오답 (많이 틀린 순) + 그 분야 문제 은행으로 50개 */
export async function localBossQuestions(records: StudyRecord[], interests: string[]): Promise<Q[]> {
  const topics = TOPICS.filter((t) => inInterests(t, interests));
  const ids = new Set(topics.map((t) => t.id)), name = new Map(topics.map((t) => [t.id, t.ko]));
  const count = new Map<string, Q>();
  for (const r of records) {
    if (!ids.has(r.topicId)) continue;
    for (const it of r.items ?? []) {
      if (it.answer === null || it.answer === it.question.answer) continue;
      const old = count.get(it.question.q);
      if (old) { old.wrong++; continue; }
      const q = toQ(it.question, name.get(r.topicId) ?? null, 1);
      if (q) count.set(q.q, q);
    }
  }
  const list = [...count.values()].sort((a, b) => b.wrong - a.wrong).slice(0, BOSS_QUESTIONS);
  const seen = new Set(list.map((q) => q.q));
  for (const t of shuffle(topics)) {
    if (list.length >= BOSS_QUESTIONS) break;
    const bank = await bankQuestions(t.id).catch(() => [] as QuizQuestion[]);
    for (const s of shuffle(bank).slice(0, 6)) {
      const q = toQ(s, t.ko, 0);
      if (!q || seen.has(q.q) || list.length >= BOSS_QUESTIONS) continue;
      seen.add(q.q); list.push(q);
    }
  }
  return shuffle(list);
}

/** 게스트 판: 보상 지급은 화면에서 (claimQuest · applyBattleXp · addTheme) */
export function localBoss(records: StudyRecord[], interests: string[]): BossEngine {
  const KEY = LOCAL_KEYS.boss.key;
  let run: LocalRun | null = null;
  const save = () => AsyncStorage.setItem(KEY, JSON.stringify(run)).catch(() => {});
  const load = async (): Promise<LocalRun | null> => {
    try { const r = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null") as LocalRun | null; return r && r.week === weekStartKst() ? r : null; } catch { return null; }
  };
  const view = (r: LocalRun): BossRun => {
    const item = r.status === "issued" ? r.questions[r.position] : null;
    return {
      runId: r.runId, status: r.status, bossHp: r.bossHp, bossMaxHp: CLEAR_HITS * BOSS_HIT, playerHp: r.playerHp, position: r.position, total: r.questions.length,
      question: item ? { position: r.position, q: item.q, choices: item.choices, topic: item.topic, wrong: item.wrong } : null, reward: r.reward,
    };
  };
  return {
    async status() {
      const r = await load(), start = weekStartKst();
      return { week: { start, end: weekEnd(start) }, interests, run: r ? { runId: r.runId, status: r.status } : null, ownsTheme: false };
    },
    async start() {
      run = await load();
      if (!run) {
        if (!interests.length) throw new Error("boss_no_interest");
        const questions = await localBossQuestions(records, interests);
        if (questions.length < CLEAR_HITS) throw new Error("boss_not_ready");
        run = { week: weekStartKst(), runId: Crypto.randomUUID(), status: "issued", bossHp: CLEAR_HITS * BOSS_HIT, playerHp: PLAYER_HP, position: 0, questions, reward: null };
        await save();
      }
      return view(run);
    },
    async answer(position, answer) {
      if (!run || run.status !== "issued" || position !== run.position) throw new Error("boss_finished");
      const item = run.questions[position], correct = answer === item.answer;
      const s = applyBossAnswer({ position, total: run.questions.length, bossHp: run.bossHp, playerHp: run.playerHp }, correct);
      run = { ...run, bossHp: s.bossHp, playerHp: s.playerHp, position: s.next, status: s.status };
      if (s.status === "cleared") {
        const theme = Math.floor(Math.random() * BOSS_THEME_ODDS) === 0 ? BOSS_THEME : null;
        run.reward = { ...bossReward(s.playerHp), theme };
      } else if (s.status === "failed") run.reward = { gears: 0, xp: 0, theme: null };
      await save();
      return { ...view(run), correct, answer: item.answer, explain: item.explain };
    },
  };
}
