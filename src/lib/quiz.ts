import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOPICS, type Topic } from "@/data";
import { supabase } from "./supabase";

export type QuizQuestion =
  | { type: "mc"; q: string; choices: string[]; answer: number; explain: string }
  | { type: "ox"; q: string; answer: boolean; explain: string };

export interface QuizSet {
  topicId: string;
  /** ai: 서버에서 AI가 만든 문제 · offline: 서버 연결이 없을 때 앱 데이터로 만든 연습 문제 */
  source: "ai" | "offline";
  questions: QuizQuestion[];
}

export const QUIZ_LENGTH = 10;
const MC_COUNT = 7;

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

/** 문제 은행에서 이번에 풀 10문제를 고름: 4지선다 7 + OX 3 (부족하면 남는 유형으로 채움) */
export function pickQuestions(pool: QuizQuestion[], n = QUIZ_LENGTH): QuizQuestion[] {
  const mc = shuffle(pool.filter((q) => q.type === "mc"));
  const ox = shuffle(pool.filter((q) => q.type === "ox"));
  const wantMc = Math.min(mc.length, Math.max(MC_COUNT, n - ox.length));
  const chosen = [...mc.slice(0, wantMc), ...ox.slice(0, n - wantMc)];
  return shuffle(chosen).slice(0, n).map(shuffleChoices);
}

// ───────── 오프라인 연습 문제 (서버가 없을 때) ─────────
const josa = (word: string, withBatchim: string, without: string) => {
  const last = word.replace(/\s*\(.*?\)\s*$/, "").trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${withBatchim}(${without})`;
  return code % 28 ? withBatchim : without;
};

export function offlineQuiz(topic: Topic): QuizSet {
  const same = shuffle(TOPICS.filter((t) => t.category === topic.category && t.id !== topic.id && t.ko !== topic.ko));
  const others = shuffle(TOPICS.filter((t) => t.domain === topic.domain && t.category !== topic.category));
  const pick3 = (exclude: Topic) => shuffle([...same, ...others].filter((t) => t.id !== exclude.id && t.ko !== exclude.ko)).slice(0, 3);
  const qs: QuizQuestion[] = [];

  const hintToName = (t: Topic): QuizQuestion => ({
    type: "mc",
    q: `다음 설명에 해당하는 개념은?\n“${t.hint}”`,
    choices: [t.ko, ...pick3(t).map((x) => x.ko)],
    answer: 0,
    explain: `“${t.hint}”는 ${t.ko}에 대한 설명이에요.`,
  });

  qs.push(hintToName(topic));
  // 이름이 이미 영어 약어(예: DOM)라면 영어 이름 문제는 의미가 없으므로 관련 개념 문제로 대체
  const hasHangul = /[가-힣]/.test(topic.ko) && topic.ko.toLowerCase() !== topic.en.toLowerCase();
  if (hasHangul) qs.push({
    type: "mc",
    q: `‘${topic.ko}’의 영어 이름은?`,
    choices: [topic.en, ...pick3(topic).map((x) => x.en)],
    answer: 0,
    explain: `${topic.ko}${josa(topic.ko, "은", "는")} 영어로 ${topic.en}이에요.`,
  });
  if (hasHangul) qs.push({
    type: "mc",
    q: `‘${topic.en}’에 해당하는 한국어 개념은?`,
    choices: [topic.ko, ...pick3(topic).map((x) => x.ko)],
    answer: 0,
    explain: `${topic.en}${josa(topic.en, "은", "는")} ${topic.ko}예요.`,
  });
  // 같은 세부 분야의 관련 개념도 함께 복습
  for (const t of same.slice(0, hasHangul ? 4 : 6)) qs.push(hintToName(t));

  const wrongCat = others[0];
  qs.push({
    type: "ox",
    q: `‘${topic.ko}’${josa(topic.ko, "은", "는")} ${topic.categoryName} 분야의 개념이다.`,
    answer: true,
    explain: `맞아요. ${topic.ko}${josa(topic.ko, "은", "는")} ${topic.categoryName}에서 다루는 개념이에요.`,
  });
  if (wrongCat) {
    qs.push({
      type: "ox",
      q: `‘${topic.ko}’${josa(topic.ko, "은", "는")} ${wrongCat.categoryName} 분야의 개념이다.`,
      answer: false,
      explain: `${topic.ko}${josa(topic.ko, "은", "는")} ${topic.categoryName} 분야의 개념이에요.`,
    });
  }
  const decoy = same[4] ?? others[1];
  if (decoy) {
    qs.push({
      type: "ox",
      q: `‘${topic.ko}’에 대한 올바른 설명이다: “${decoy.hint}”`,
      answer: false,
      explain: `이 설명은 ${decoy.ko}에 대한 것이에요. ${topic.ko}${josa(topic.ko, "은", "는")} “${topic.hint}”.`,
    });
  }
  return { topicId: topic.id, source: "offline", questions: validQuestions(qs) };
}

// ───────── 불러오기 ─────────
const cacheKey = (id: string) => `pg.quiz.${id}`;

/**
 * 퀴즈 문제 은행을 가져옵니다.
 * 1) 이 휴대폰에 저장된 문제 → 2) 서버(AI가 만든 문제를 모든 사용자가 공유) → 3) 오프라인 연습 문제
 */
export async function loadQuiz(topic: Topic): Promise<QuizSet> {
  try {
    const cached = await AsyncStorage.getItem(cacheKey(topic.id));
    if (cached) {
      const qs = validQuestions(JSON.parse(cached));
      if (qs.length >= QUIZ_LENGTH) return { topicId: topic.id, source: "ai", questions: qs };
    }
  } catch {
    // 저장된 문제가 깨졌으면 무시
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", { body: { topicId: topic.id } });
      const qs = validQuestions((data as { questions?: unknown } | null)?.questions);
      if (!error && qs.length >= QUIZ_LENGTH) {
        AsyncStorage.setItem(cacheKey(topic.id), JSON.stringify(qs)).catch(() => {});
        return { topicId: topic.id, source: "ai", questions: qs };
      }
    } catch {
      // 네트워크 오류 → 오프라인 문제로
    }
  }
  return offlineQuiz(topic);
}

/** 공부를 시작할 때 미리 받아 두기 (15분 뒤 바로 퀴즈를 시작할 수 있게) */
export const prefetchQuiz = (topic: Topic) => {
  loadQuiz(topic).catch(() => {});
};
