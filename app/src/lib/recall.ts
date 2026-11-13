import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCAL_KEYS } from "./local-data";
import { topicById, type Topic } from "@/data";
import { examQuestions, type ExamItem } from "./quiz";
import { dateKey } from "./stats";
import type { StudyRecord } from "./types";

/**
 * 복습 (간격 반복): 공부했거나 복습한 지 RECALL_DAYS일이 지난 주제를 짧은 퀴즈로 다시 물어봄.
 * 망각 곡선: 배운 직후 빠르게 잊으므로, 잊기 전에 다시 꺼내 보면 오래 기억에 남음.
 * 간격은 2일로 고정 (주제를 마지막으로 본 날로부터 2일 뒤에 다시 복습 대상이 됨).
 */
export const RECALL_DAYS = 2;
/** 한 번에 복습하는 주제 수 · 주제마다 문제 수 */
export const RECALL_TOPICS = 5;
export const RECALL_PER_TOPIC = 3;

const KEY = LOCAL_KEYS.recall.key;
/** 주제 id → 마지막으로 복습한 시각 */
export type RecallLog = Record<string, string>;

export async function readRecallLog(): Promise<RecallLog> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const x = raw ? JSON.parse(raw) : {};
    return x && typeof x === "object" && !Array.isArray(x) ? (x as RecallLog) : {};
  } catch {
    return {};
  }
}

export async function markRecalled(topicIds: string[]): Promise<RecallLog> {
  const at = new Date().toISOString();
  const next = { ...(await readRecallLog()), ...Object.fromEntries(topicIds.map((id) => [id, at])) };
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

/** 두 날짜 사이 날 수 (달력 기준) */
const dayDiff = (a: Date, b: Date) => {
  const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((y - x) / 86400000);
};

export interface RecallItem { topic: Topic; last: Date; overdue: number }

/** 주제마다 마지막으로 본 날 (공부 기록과 복습 기록 중 늦은 쪽) */
function lastTouched(records: StudyRecord[], log: RecallLog) {
  const last = new Map<string, Date>();
  const put = (id: string, iso: string) => {
    const d = new Date(iso);
    const prev = last.get(id);
    if (!prev || d > prev) last.set(id, d);
  };
  for (const r of records) put(r.topicId, r.studiedAt);
  for (const [id, iso] of Object.entries(log)) put(id, iso);
  return last;
}

/** 이 날짜에 복습할 주제: 마지막으로 본 지 RECALL_DAYS일 이상 지난 주제 (오래된 것부터) */
export function dueTopics(records: StudyRecord[], log: RecallLog, on = new Date()): RecallItem[] {
  const out: RecallItem[] = [];
  for (const [id, last] of lastTouched(records, log)) {
    const topic = topicById(id);
    const gap = dayDiff(last, on);
    if (topic && gap >= RECALL_DAYS) out.push({ topic, last, overdue: gap - RECALL_DAYS });
  }
  return out.sort((a, b) => a.last.getTime() - b.last.getTime());
}

/** 이번 복습 묶음: 주제마다 RECALL_PER_TOPIC문제 (문제 은행 → 없으면 연습 문제) */
export async function buildRecall(items: RecallItem[]): Promise<ExamItem[]> {
  const parts = await Promise.all(items.slice(0, RECALL_TOPICS).map((x) => examQuestions([x.topic], RECALL_PER_TOPIC)));
  return parts.flat();
}

export const todayKey = () => dateKey(new Date());
