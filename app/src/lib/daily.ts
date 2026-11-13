import { inInterests, TOPICS, type Topic } from "@/data";
import { dateKey } from "./stats";
import type { StudyRecord } from "./types";

/**
 * 오늘의 주제: 사용자마다 다르게, 내 관심 분야(세부 분야 · 자격증) 안에서 날짜로 하나를 정함.
 * 같은 날 같은 사람에게는 늘 같은 주제가 나오고, 이 주제는 그날 슬롯머신 뽑기에서 빠짐.
 * 오늘 그 주제를 공부해서 퀴즈까지 끝내면 톱니바퀴 보너스.
 */
export const DAILY_TOPIC_GEARS = 10;

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** 이 사람의 이 날 주제 (관심 분야가 없으면 null) */
export function dailyTopic(uid: string, interests: string[], now = new Date()): Topic | null {
  const pool = TOPICS.filter((t) => inInterests(t, interests));
  if (!pool.length) return null;
  return pool[hash(`daily:${uid}:${dateKey(now)}`) % pool.length];
}

export const dailyKey = (now = new Date()) => `daily-topic:${dateKey(now)}`;

/** 오늘 오늘의 주제를 공부했는지 */
export const dailyDone = (topic: Topic | null, records: StudyRecord[], now = new Date()) => {
  if (!topic) return false;
  const k = dateKey(now);
  return records.some((r) => r.studyType !== "battle" && r.topicId === topic.id && dateKey(new Date(r.studiedAt)) === k);
};
