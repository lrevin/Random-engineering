import AsyncStorage from "@react-native-async-storage/async-storage";
import { topicById, type Topic } from "@/data";
import type { ExamWrong } from "./exam";
import { variantQuestion, type QuizQuestion } from "./quiz";
import type { StudyRecord } from "./types";

/** 한 번에 다시 푸는 문제 수 */
export const REVIEW_LENGTH = 10;

/** 모아 둔 오답 하나 (퀴즈 기록 + 모의고사) */
export interface WrongItem { key: string; topic: Topic; q: string; answer: string; explain: string; at: string }
export interface ReviewItem { wrong: WrongItem; q: QuizQuestion; changed: boolean }

const keyOf = (topicId: string, q: string) => `${topicId}|${q}`;

/** 아직 해결하지 못한 오답: 같은 문제는 한 번만, 최근에 틀린 것부터 */
export function collectWrongs(records: StudyRecord[], examWrongs: ExamWrong[], done: DoneMap): WrongItem[] {
  const out = new Map<string, WrongItem>();
  const add = (topicId: string, w: { q: string; answer: string; explain: string }, at: string) => {
    const topic = topicById(topicId);
    const key = keyOf(topicId, w.q);
    // 해결한 뒤에 같은 문제를 또 틀렸으면 다시 오답으로 돌아옴
    if (!topic || (done[key] && done[key] >= at)) return;
    const prev = out.get(key);
    if (!prev || prev.at < at) out.set(key, { key, topic, q: w.q, answer: w.answer, explain: w.explain, at });
  };
  for (const r of records) for (const w of r.wrong) add(r.topicId, w, r.studiedAt);
  for (const w of examWrongs) add(w.topicId, w, w.at);
  return [...out.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** 이번에 풀 묶음: 오답에서 무작위로 골라 변형 문제로 바꿈 */
export async function buildReview(wrongs: WrongItem[], n = REVIEW_LENGTH): Promise<ReviewItem[]> {
  const picked = [...wrongs].sort(() => Math.random() - 0.5).slice(0, n);
  const items = await Promise.all(picked.map(async (wrong) => ({ wrong, ...(await variantQuestion(wrong.topic, wrong)) })));
  return items.filter((x) => !!x.q);
}

// ───────── 해결한 오답 (변형 문제를 맞히면 오답 목록에서 빠짐) ─────────
/** 문제 key → 해결한 시각 */
export type DoneMap = Record<string, string>;
const DONE_KEY = "pg.review.done2";
export async function readDone(): Promise<DoneMap> {
  try {
    const raw = await AsyncStorage.getItem(DONE_KEY);
    const x = raw ? JSON.parse(raw) : {};
    return x && typeof x === "object" && !Array.isArray(x) ? (x as DoneMap) : {};
  } catch {
    return {};
  }
}
export async function markDone(keys: string[]): Promise<DoneMap> {
  const at = new Date().toISOString();
  const next = { ...(await readDone()), ...Object.fromEntries(keys.map((k) => [k, at])) };
  await AsyncStorage.setItem(DONE_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}
