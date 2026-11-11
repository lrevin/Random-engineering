import { TOPICS, type Topic } from "@/data";
import { dateKey } from "./stats";
import type { StudyRecord } from "./types";

/**
 * 오늘의 주제: 날짜로 정해서 모든 사용자에게 같은 주제가 나옴 (관심 분야와 관계없이).
 * 오늘 그 주제를 공부해서 퀴즈까지 끝내면 톱니바퀴 보너스.
 */
export const DAILY_TOPIC_GEARS = 10;

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** 이 날의 주제 (어려운 Lv.3은 빼고 골라 누구나 해 볼 수 있게) */
export function dailyTopic(now = new Date()): Topic {
  const pool = TOPICS.filter((t) => t.lv < 3);
  return pool[hash("daily" + dateKey(now)) % pool.length];
}

export const dailyKey = (now = new Date()) => `daily-topic:${dateKey(now)}`;

/** 오늘 오늘의 주제를 공부했는지 */
export const dailyDone = (records: StudyRecord[], now = new Date()) => {
  const t = dailyTopic(now);
  const k = dateKey(now);
  return records.some((r) => r.topicId === t.id && dateKey(new Date(r.studiedAt)) === k);
};
