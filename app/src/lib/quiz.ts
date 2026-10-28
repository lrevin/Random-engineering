import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOPICS, type Topic } from "@/data";
import { QUIZ_BANK } from "@/data/quizbank";
import { supabase } from "./supabase";

/** 문제마다 어디서 왔는지: bank = 우리가 미리 만든 문제 · ai = 퀴즈 AI가 새로 만든 문제 · offline = 앱 데이터로 만든 연습 문제 */
export type QuestionSource = "bank" | "ai" | "offline";

export type QuizQuestion =
  | { type: "mc"; q: string; choices: string[]; answer: number; explain: string; src?: QuestionSource }
  | { type: "ox"; q: string; answer: boolean; explain: string; src?: QuestionSource };

export type QuizSource = QuestionSource;

export interface QuizSet {
  topicId: string;
  /** 대표 출처: AI 문제가 하나라도 있으면 ai, 없으면 bank, 둘 다 없으면 offline */
  source: QuizSource;
  /** 이번에 풀 문제 (이미 섞여 있음) */
  questions: QuizQuestion[];
}

/** 한 번에 푸는 문제 수: AI가 새로 만든 4문제 + 미리 만든 문제 3개 */
export const QUIZ_LENGTH = 7;
export const AI_COUNT = 4;

/** 퀴즈 AI 서버 (api/quiz-server). 개인 PC 등에서 계속 켜 두는 출제 AI. 없으면 Supabase 함수 → 오프라인 문제 */
const QUIZ_SERVER_URL = (process.env.EXPO_PUBLIC_QUIZ_SERVER_URL ?? "").replace(/\/+$/, "");
const QUIZ_SERVER_TOKEN = process.env.EXPO_PUBLIC_QUIZ_SERVER_TOKEN ?? "";
// 새로 만들기 + 검수 2번까지 기다리는 시간 (주제를 뽑은 즉시 시작하므로 보통 공부하는 동안 끝남)
const AI_TIMEOUT_MS = 150000;

// ───────── 검증 ─────────
function isQuestion(x: unknown): x is QuizQuestion {
  const o = x as Record<string, unknown>;
  if (!o || typeof o.q !== "string" || !o.q.trim() || typeof o.explain !== "string") return false;
  if (o.type === "ox") return typeof o.answer === "boolean";
  if (o.type === "mc") {
    return (
      Array.isArray(o.choices) && o.choices.length === 4 && o.choices.every((c) => typeof c === "string" && c.trim()) &&
      new Set(o.choices).size === 4 && Number.isInteger(o.answer) && (o.answer as number) >= 0 && (o.answer as number) < 4
    );
  }
  return false;
}
export const validQuestions = (xs: unknown): QuizQuestion[] => (Array.isArray(xs) ? xs.filter(isQuestion) : []);

// ───────── 비슷한 문제 거르기 ─────────
const normalize = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
const bigrams = (s: string) => {
  const n = normalize(s);
  const out = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2));
  return out;
};
/** 두 문장이 얼마나 비슷한지 (글자 2개씩 묶음의 자카드 유사도, 0~1) */
export function similarity(a: string, b: string) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return normalize(a) === normalize(b) ? 1 : 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
export const SIMILAR = 0.5;
const tooSimilar = (q: QuizQuestion, others: QuizQuestion[]) => others.some((o) => similarity(q.q, o.q) >= SIMILAR);

/** 서로 비슷하지 않은 문제만 남김 (이미 고른 문제와도 비교) */
function distinct(qs: QuizQuestion[], against: QuizQuestion[] = []) {
  const kept: QuizQuestion[] = [];
  for (const q of qs) if (!tooSimilar(q, [...against, ...kept])) kept.push(q);
  return kept;
}

// ───────── 섞기 ─────────
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleChoices(q: QuizQuestion): QuizQuestion {
  if (q.type !== "mc") return q;
  const order = shuffle([0, 1, 2, 3]);
  return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) };
}

/** n문제 고르기: 4지선다 위주로, OX는 약 30% (부족하면 남는 유형으로 채움) */
export function pickQuestions(pool: QuizQuestion[], n: number): QuizQuestion[] {
  const mc = shuffle(pool.filter((q) => q.type === "mc"));
  const ox = shuffle(pool.filter((q) => q.type === "ox"));
  const wantMc = Math.min(mc.length, Math.max(Math.round(n * 0.7), n - ox.length));
  return [...mc.slice(0, wantMc), ...ox.slice(0, n - wantMc)];
}

// ───────── 오프라인 연습 문제 (AI도 문제 은행도 없을 때) ─────────
// 말투는 문제 은행과 같게: 4지선다 "~은/는?", OX "~다.", 해설 "~입니다" (docs/quiz-authoring.md)
const josa = (word: string, withBatchim: string, without: string) => {
  const last = word.replace(/\s*\(.*?\)\s*$/, "").trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${withBatchim}(${without})`;
  return code % 28 ? withBatchim : without;
};

export function offlineQuestions(topic: Topic): QuizQuestion[] {
  const same = shuffle(TOPICS.filter((t) => t.category === topic.category && t.id !== topic.id && t.ko !== topic.ko));
  const others = shuffle(TOPICS.filter((t) => t.domain === topic.domain && t.category !== topic.category));
  const pick3 = (exclude: Topic) => shuffle([...same, ...others].filter((t) => t.id !== exclude.id && t.ko !== exclude.ko)).slice(0, 3);
  const qs: QuizQuestion[] = [];

  const hintToName = (t: Topic): QuizQuestion => ({
    type: "mc",
    q: `“${t.hint}”에 해당하는 개념은?`,
    choices: [t.ko, ...pick3(t).map((x) => x.ko)],
    answer: 0,
    explain: `“${t.hint}”는 ${t.ko}에 대한 설명입니다.`,
  });

  qs.push(hintToName(topic));
  // 이름이 이미 영어 약어(예: DOM)라면 영어 이름 문제는 의미가 없으므로 관련 개념 문제로 대체
  const hasHangul = /[가-힣]/.test(topic.ko) && topic.ko.toLowerCase() !== topic.en.toLowerCase();
  if (hasHangul) qs.push({
    type: "mc",
    q: `‘${topic.ko}’의 영어 이름은?`,
    choices: [topic.en, ...pick3(topic).map((x) => x.en)],
    answer: 0,
    explain: `${topic.ko}의 영어 이름은 ${topic.en}입니다.`,
  });
  if (hasHangul) qs.push({
    type: "mc",
    q: `‘${topic.en}’에 해당하는 한국어 개념은?`,
    choices: [topic.ko, ...pick3(topic).map((x) => x.ko)],
    answer: 0,
    explain: `${topic.en}에 해당하는 한국어 개념은 ${topic.ko}입니다.`,
  });
  // 같은 세부 분야의 관련 개념도 함께 복습
  for (const t of same.slice(0, hasHangul ? 4 : 6)) qs.push(hintToName(t));

  const wrongCat = others[0];
  qs.push({
    type: "ox",
    q: `‘${topic.ko}’${josa(topic.ko, "은", "는")} ${topic.categoryName} 분야의 개념이다.`,
    answer: true,
    explain: `${topic.ko}${josa(topic.ko, "은", "는")} ${topic.categoryName}에서 다루는 개념입니다.`,
  });
  if (wrongCat) {
    qs.push({
      type: "ox",
      q: `‘${topic.ko}’${josa(topic.ko, "은", "는")} ${wrongCat.categoryName} 분야의 개념이다.`,
      answer: false,
      explain: `${topic.ko}${josa(topic.ko, "은", "는")} ${wrongCat.categoryName}이 아니라 ${topic.categoryName} 분야의 개념입니다.`,
    });
  }
  const decoy = same[4] ?? others[1];
  if (decoy) {
    qs.push({
      type: "ox",
      q: `“${decoy.hint}”는 ‘${topic.ko}’에 대한 올바른 설명이다.`,
      answer: false,
      explain: `이 설명은 ${decoy.ko}에 대한 것입니다. ${topic.ko}${josa(topic.ko, "은", "는")} “${topic.hint}”에 해당하는 개념입니다.`,
    });
  }
  return validQuestions(qs).map((q) => ({ ...q, src: "offline" as const }));
}

/** 예전 이름 (오프라인 문제만으로 된 세트) */
export const offlineQuiz = (topic: Topic): QuizSet => ({
  topicId: topic.id, source: "offline", questions: pickQuestions(offlineQuestions(topic), QUIZ_LENGTH).map(shuffleChoices),
});

// ───────── 퀴즈 AI 호출 ─────────
// 말투 규칙(2026-10)이 생기기 전에 저장한 문제는 쓰지 않도록 키에 버전을 붙임
const aiCacheKey = (id: string) => `pg.quiz.ai2.${id}`;

async function postJson(url: string, body: unknown): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(QUIZ_SERVER_TOKEN ? { "x-quiz-token": QUIZ_SERVER_TOKEN } : {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`quiz server ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 퀴즈 AI에게 새 문제를 받아 옴. 미리 만든 문제(avoid)를 함께 보내서 비슷하지 않은 새 유형으로 만들게 함.
 * fresh면 그 자리에서 새로 만들고 2번 검수한 문제를 받음 (주제를 뽑은 즉시). 서버는 검수를 통과한 문제만 줌.
 * 1) 퀴즈 AI 서버 → 2) Supabase 함수 → 실패하면 빈 배열
 */
async function fetchAiQuestions(topic: Topic, avoid: QuizQuestion[], fresh: boolean): Promise<QuizQuestion[]> {
  const body = { topicId: topic.id, count: AI_COUNT, avoid: avoid.map((q) => q.q).slice(0, 40), fresh };
  if (QUIZ_SERVER_URL) {
    try {
      const data = await postJson(`${QUIZ_SERVER_URL}/quiz`, body);
      const qs = validQuestions((data as { questions?: unknown } | null)?.questions);
      if (qs.length) return qs;
    } catch {
      // 서버가 꺼져 있으면 다음 방법으로
    }
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", { body });
      const qs = validQuestions((data as { questions?: unknown } | null)?.questions);
      if (!error && qs.length) return qs;
    } catch {
      // 네트워크 오류
    }
  }
  return [];
}

async function readAiCache(topicId: string): Promise<QuizQuestion[]> {
  try {
    const raw = await AsyncStorage.getItem(aiCacheKey(topicId));
    return raw ? validQuestions(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}
/** 받은 AI 문제는 이 휴대폰에도 모아 둠 (오프라인일 때 다시 씀, 최대 30개) */
async function saveAiCache(topicId: string, qs: QuizQuestion[]) {
  const prev = await readAiCache(topicId);
  const merged = distinct([...qs, ...prev]).slice(0, 30);
  AsyncStorage.setItem(aiCacheKey(topicId), JSON.stringify(merged)).catch(() => {});
}

// ───────── 한 번 풀 퀴즈 만들기 ─────────
async function buildQuiz(topic: Topic, fresh: boolean): Promise<QuizSet> {
  const bank = distinct(validQuestions(QUIZ_BANK[topic.id]).map((q) => ({ ...q, src: "bank" as const })));

  // AI 문제: 미리 만든 문제와 비슷하면 버림
  let ai: QuizQuestion[] = distinct(await fetchAiQuestions(topic, bank, fresh), bank).map((q) => ({ ...q, src: "ai" as const }));
  if (ai.length) saveAiCache(topic.id, ai).catch(() => {});
  else ai = distinct(shuffle(await readAiCache(topic.id)), bank).map((q) => ({ ...q, src: "ai" as const }));
  ai = pickQuestions(ai, AI_COUNT);

  // 나머지는 미리 만든 문제로 채우고, 그래도 모자라면 오프라인 연습 문제로
  const picked = [...ai, ...pickQuestions(distinct(bank, ai), QUIZ_LENGTH - ai.length)];
  if (picked.length < QUIZ_LENGTH) {
    picked.push(...pickQuestions(distinct(offlineQuestions(topic), picked), QUIZ_LENGTH - picked.length));
  }
  const source: QuizSource = picked.some((q) => q.src === "ai") ? "ai" : picked.some((q) => q.src === "bank") ? "bank" : "offline";
  return { topicId: topic.id, source, questions: shuffle(picked).slice(0, QUIZ_LENGTH).map(shuffleChoices) };
}

// 주제를 뽑은 즉시 만들기 시작한 퀴즈 (퀴즈 화면에 들어가면 한 번 꺼내 씀)
const prepared = new Map<string, { at: number; p: Promise<QuizSet> }>();
const PREPARED_TTL = 3 * 60 * 60 * 1000;

/**
 * 이번에 풀 퀴즈를 가져옵니다. 주제를 뽑을 때 만들기 시작한 게 있으면 그것을,
 * 없으면(퀴즈 다시 풀기 등) 서버에 쌓인 검수 통과 문제로 새 조합을 만듭니다.
 */
export function loadQuiz(topic: Topic): Promise<QuizSet> {
  const ready = prepared.get(topic.id);
  prepared.delete(topic.id);
  if (ready && Date.now() - ready.at < PREPARED_TTL) return ready.p.catch(() => buildQuiz(topic, false));
  return buildQuiz(topic, false);
}

/**
 * 주제를 뽑은 즉시 AI 문제 만들기를 시작 (만든 직후 서버가 2번 검수).
 * 같은 주제로 이미 시작했으면 다시 만들지 않음 (공부 화면에서도 불러도 됨).
 */
export const prefetchQuiz = (topic: Topic) => {
  const ready = prepared.get(topic.id);
  if (ready && Date.now() - ready.at < PREPARED_TTL) return;
  const p = buildQuiz(topic, true);
  p.catch(() => {});
  prepared.set(topic.id, { at: Date.now(), p });
};
