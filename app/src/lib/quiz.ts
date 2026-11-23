import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOPICS, type Topic } from "@/data";
import { BANK_BUNDLED_FULL, QUIZ_BANK } from "@/data/quizbank";
import { fetchBankQuestions } from "./api";

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

// 회원의 AI 생성·출제는 서버 activity 경로에서 관리한다. 이 파일은 게스트·로컬 보충용이다.

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

async function readAiCache(topicId: string): Promise<QuizQuestion[]> {
  try {
    const raw = await AsyncStorage.getItem(aiCacheKey(topicId));
    return raw ? validQuestions(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}
// ───────── MySQL 기본 문제 조회 및 기기 캐시 ─────────
const bankCacheKey = (id: string) => `pg.mysql.bank.${id}`;
const BANK_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/** 기본 문제 은행 전체를 앱에 포함한다. 부분 내장 빌드에서만 서버·캐시로 보완한다. */
export async function bankQuestions(topicId: string): Promise<QuizQuestion[]> {
  const bundled = validQuestions(QUIZ_BANK[topicId]);
  if (BANK_BUNDLED_FULL) return bundled;
  let cached: QuizQuestion[] = [];
  try {
    const raw = await AsyncStorage.getItem(bankCacheKey(topicId));
    const c = raw ? (JSON.parse(raw) as { at?: number; qs?: unknown }) : null;
    cached = validQuestions(c?.qs);
    if (cached.length && Date.now() - (c?.at ?? 0) < BANK_CACHE_MS) return cached;
  } catch { /* 손상된 캐시는 서버에서 다시 받음 */ }
  try {
    const qs = validQuestions(await fetchBankQuestions(topicId));
    await AsyncStorage.setItem(bankCacheKey(topicId), JSON.stringify({ at: Date.now(), qs }));
    return qs;
  } catch { return cached.length ? cached : bundled; }
}

// ───────── 한 번 풀 퀴즈 만들기 ─────────
async function buildQuiz(topic: Topic, seen: string[] = [], localOnly = false): Promise<QuizSet> {
  const all = distinct((localOnly ? validQuestions(QUIZ_BANK[topic.id]) : await bankQuestions(topic.id)).map((q) => ({ ...q, src: "bank" as const })));
  // 다시 공부: 전에 풀었던 문제(seen)와 비슷한 건 빼고 새 문제 위주로 (남는 게 모자라면 전체에서)
  const seenQs: QuizQuestion[] = seen.map((q) => ({ type: "ox", q, answer: true, explain: "" }));
  const unseen = distinct(all, seenQs);
  const bank = unseen.length >= QUIZ_LENGTH - AI_COUNT ? unseen : all;

  // 기존 기기 AI 캐시만 재사용하며 서버에 새 생성을 요청하지 않는다.
  const ai = pickQuestions(distinct(shuffle(localOnly ? [] : await readAiCache(topic.id)), [...bank, ...seenQs]).map((q) => ({ ...q, src: "ai" as const })), AI_COUNT);

  // 나머지는 미리 만든 문제로 채우고, 그래도 모자라면 오프라인 연습 문제로
  const picked = [...ai, ...pickQuestions(distinct(bank, ai), QUIZ_LENGTH - ai.length)];
  if (picked.length < QUIZ_LENGTH) {
    picked.push(...pickQuestions(distinct(offlineQuestions(topic), picked), QUIZ_LENGTH - picked.length));
  }
  const source: QuizSource = picked.some((q) => q.src === "ai") ? "ai" : picked.some((q) => q.src === "bank") ? "bank" : "offline";
  return { topicId: topic.id, source, questions: shuffle(picked).slice(0, QUIZ_LENGTH).map(shuffleChoices) };
}

/** 회원 오프라인 출제는 내장 기본 문제 우선. 원본 없는 보충 문제는 서버에서 보상 제외한다.
 * 네트워크와 과거 AI 캐시를 조회하지 않아 오프라인 전환 시 즉시 출제할 수 있다. */
// 오프라인 정책: 완전한 문제·보기·정답·해설과 답안을 기존 기록 키에 저장한다.
// 재접속 시 서버 원본 대조가 통과한 기본 문제만 기존 보상 정책(직접 업로드 하루 3회)에 따른다.
// 보충 문제 혼합은 미검증 보관, 서버 시간 증거 없는 학습은 시간 퀘스트에서 제외한다.
// 서버에서 이미 발급한 문제는 이 함수로 교체하지 않고 발급 ID와 기존 문제를 그대로 전송한다.
export const loadOfflineQuiz = (topic: Topic): Promise<QuizSet> => buildQuiz(topic, [], true);

// 공부 시작을 누른 즉시 만들기 시작한 퀴즈 (퀴즈 화면에 들어가면 한 번 꺼내 씀)
const prepared = new Map<string, { at: number; p: Promise<QuizSet> }>();
const PREPARED_TTL = 3 * 60 * 60 * 1000;

/**
 * 이번에 풀 퀴즈를 가져옵니다. 공부 시작 때 만들기 시작한 게 있으면 그것을,
 * 없으면 내장 은행·기존 기기 캐시로 새 조합을 만듭니다.
 */
export function loadQuiz(topic: Topic): Promise<QuizSet> {
  const ready = prepared.get(topic.id);
  prepared.delete(topic.id);
  if (ready && Date.now() - ready.at < PREPARED_TTL) return ready.p.catch(() => buildQuiz(topic));
  return buildQuiz(topic);
}

/** 게스트·로컬 보충용 퀴즈를 미리 조합한다. 실시간 AI 요청·토큰은 사용하지 않는다. */
export const prefetchQuiz = (topic: Topic, seen: string[] = []) => {
  const ready = prepared.get(topic.id);
  if (ready && Date.now() - ready.at < PREPARED_TTL && !seen.length) return;
  const p = buildQuiz(topic, seen);
  p.catch(() => {});
  prepared.set(topic.id, { at: Date.now(), p });
};

// ───────── 게스트 배틀 보충 문제 ─────────
/** 배틀 본 문제 수 · 연장전에 한 번에 만드는 문제 수 */
export const BATTLE_QUIZ_LENGTH = 5;
export const OVERTIME_BATCH = 2;

/**
 * 게스트 배틀 보충 count개. 실시간 LLM은 호출하지 않고 기존 기기 AI 캐시·내장 은행을 사용.
 * avoid(이미 낸 배틀 문제 · 문제 은행)와 비슷한 문제는 버림.
 * AI 서버가 꺼져 있으면 이 휴대폰에 모아 둔 AI 문제 → 문제 은행 → 연습 문제 순으로 채워 배틀이 멈추지 않게 함.
 */
export async function battleQuestions(topic: Topic, count: number, avoid: QuizQuestion[] = []): Promise<QuizQuestion[]> {
  const bank = distinct((await bankQuestions(topic.id)).map((q) => ({ ...q, src: "bank" as const })));
  const against = [...avoid, ...bank];
  const ai = distinct(shuffle(await readAiCache(topic.id)), against).map((q) => ({ ...q, src: "ai" as const }));
  let out = pickQuestions(ai, count);
  if (out.length < count) out = [...out, ...pickQuestions(distinct(bank, [...avoid, ...out]), count - out.length)];
  if (out.length < count) out = [...out, ...pickQuestions(distinct(offlineQuestions(topic), [...avoid, ...out]), count - out.length)];
  return shuffle(out).slice(0, count).map(shuffleChoices);
}

// ───────── 자격증 모의고사 ─────────
export interface ExamItem { q: QuizQuestion; topic: Topic }

/** 최근에 낸 모의고사 문제 · 주제 (반복 체감을 줄이기 위해 뒤로 미룸, 완전히 빼지는 않음) */
export interface ExamAvoid { questions?: string[]; topicIds?: string[] }

/**
 * 모의고사 한 과목 문제: 과목에 든 주제들에서 골고루 n문제.
 * 미리 만든 문제 은행에서 뽑고, 은행에 없는 주제는 연습 문제로 채웁니다. (AI는 쓰지 않아 바로 시작됨)
 * avoid를 주면 최근에 낸 주제·문제는 뒤로 미뤄서 같은 문제가 자꾸 반복되는 걸 줄입니다.
 */
export async function examQuestions(topics: Topic[], n: number, avoid: ExamAvoid = {}): Promise<ExamItem[]> {
  const avoidTopics = new Set(avoid.topicIds ?? []);
  const avoidQ = avoid.questions ?? [];
  const fresh = shuffle(topics.filter((t) => !avoidTopics.has(t.id)));
  const seen = shuffle(topics.filter((t) => avoidTopics.has(t.id)));
  const chosen = [...fresh, ...seen].slice(0, n);
  const pools = await Promise.all(chosen.map(async (topic) => {
    // 게스트 모의고사도 은행·보충 문제를 모두 4지선다로 제한한다.
    const isFourChoice = (q: QuizQuestion) => q.type === "mc" && q.choices.length === 4;
    const bank = distinct((await bankQuestions(topic.id)).filter(isFourChoice).map((q) => ({ ...q, src: "bank" as const })));
    const all = shuffle(bank.length >= n ? bank : distinct([...bank, ...offlineQuestions(topic).filter(isFourChoice)]));
    const notRecent = all.filter((q) => !avoidQ.some((t) => similarity(q.q, t) >= SIMILAR));
    const recent = all.filter((q) => !notRecent.includes(q));
    return { topic, qs: [...notRecent, ...recent] };
  }));
  // 주제마다 한 문제씩 돌아가며 뽑음 (주제 수가 n보다 적으면 두 번째 바퀴에서 더 뽑음)
  const out: ExamItem[] = [];
  for (let round = 0; out.length < n && pools.some((p) => p.qs.length > round); round++) {
    for (const p of pools) {
      if (out.length >= n) break;
      const q = p.qs[round];
      if (q && !tooSimilar(q, out.map((x) => x.q))) out.push({ q: shuffleChoices(q), topic: p.topic });
    }
  }
  return shuffle(out);
}

// ───────── 오답 다시 풀기 (프리미엄): 틀린 문제의 변형 ─────────
/**
 * 틀렸던 문제와 같은 주제·같은 유형(4지선다/OX)이면서 가장 비슷한 다른 문제를 골라 줍니다.
 * 같은 걸 묻지만 정답이 달라서, 답을 외워서는 못 맞힙니다. 비슷한 문제가 없으면 원래 문제의 보기 순서를 섞어서 냅니다.
 * changed: 원래 문제와 다른 문제로 바뀌었는지
 */
export async function variantQuestion(topic: Topic, wrong: { q: string; answer: string }): Promise<{ q: QuizQuestion; changed: boolean }> {
  const bank = distinct((await bankQuestions(topic.id)).map((q) => ({ ...q, src: "bank" as const })));
  const orig = bank.find((b) => b.q === wrong.q);
  const type: QuizQuestion["type"] = orig?.type ?? (/^[OX] \(/.test(wrong.answer) ? "ox" : "mc");
  const ranked = bank
    .filter((b) => b.type === type && b.q !== wrong.q && answerLabel(b) !== wrong.answer)
    .map((b) => ({ b, s: similarity(b.q, wrong.q) }))
    .sort((x, y) => y.s - x.s);
  // 가장 비슷한 3개 중 하나 (풀 때마다 조금씩 달라지게)
  const near = ranked.slice(0, 3);
  if (near.length) return { q: shuffleChoices(near[Math.floor(Math.random() * near.length)].b), changed: true };
  if (orig) return { q: shuffleChoices(orig), changed: false };
  const any = shuffle(bank.length ? bank : offlineQuestions(topic))[0];
  return { q: shuffleChoices(any), changed: true };
}
const answerLabel = (q: QuizQuestion) => (q.type === "mc" ? q.choices[q.answer] : q.answer ? "O (맞다)" : "X (틀리다)");

// ───────── 스피드 퀴즈: 공부한 주제의 4지선다 ─────────
/** 주제들의 4지선다 모으기 (문제 은행 → 모자라면 연습 문제의 4지선다). 보기 순서는 섞음 */
export async function speedQuestions(topics: Topic[]): Promise<ExamItem[]> {
  const parts = await Promise.all(topics.map(async (topic) => {
    const bank = (await bankQuestions(topic.id)).filter((q) => q.type === "mc").map((q) => ({ ...q, src: "bank" as const }));
    const qs = bank.length >= 2 ? bank : [...bank, ...offlineQuestions(topic).filter((q) => q.type === "mc")];
    return distinct(qs).map((q) => ({ q: shuffleChoices(q), topic }));
  }));
  return shuffle(parts.flat());
}
