import type { IconName } from "@/components/Icon";
import { dateKey } from "./stats";
import type { StudyRecord } from "./types";

/**
 * 오늘의 퀘스트 (톱니바퀴 보상).
 *
 * 보상 크기: 톱니바퀴를 얻는 곳이 퀘스트뿐이라, 매일 다 깨면 하루 8~12개
 * (기본 2개 + 골라진 두 퀘스트 3~4개씩 + 모두 깨면 상자 2개). 보호권(20개)은 이틀에 하나 정도,
 * 공부 시간 추가(10개)는 하루 한 번 정도 쓸 수 있는 수준이라 쌓이기만 하지 않음.
 */
export const QUEST_BONUS = 2;

export interface Quest {
  id: string;
  title: string;
  icon: IconName;
  goal: number;
  value: number;
  /** 진행 막대 옆 단위 (예: "분", "개") */
  unit: string;
  reward: number;
  done: boolean;
}

type Def = Omit<Quest, "value" | "done"> & { measure: (today: StudyRecord[]) => number };

/** 매일 나오는 기본 퀘스트 */
const BASE: Def = { id: "finish1", title: "주제 1개 공부 끝내기", icon: "book", goal: 1, unit: "개", reward: 2, measure: (t) => t.length };

/** 날마다 이 중 2개가 골라짐 */
const POOL: Def[] = [
  { id: "correct5", title: "퀴즈 정답 5개 맞히기", icon: "check", goal: 5, unit: "개", reward: 3, measure: (t) => t.reduce((a, r) => a + r.score, 0) },
  { id: "correct10", title: "퀴즈 정답 10개 맞히기", icon: "target", goal: 10, unit: "개", reward: 4, measure: (t) => t.reduce((a, r) => a + r.score, 0) },
  { id: "perfect1", title: "퀴즈 만점 1번 받기", icon: "medal", goal: 1, unit: "번", reward: 4, measure: (t) => t.filter((r) => r.total > 0 && r.score === r.total).length },
  { id: "study15", title: "15분 이상 공부하기", icon: "clock", goal: 15, unit: "분", reward: 3, measure: (t) => Math.floor(t.reduce((a, r) => a + (r.studySec || 0), 0) / 60) },
  { id: "study30", title: "30분 이상 공부하기", icon: "hourglass", goal: 30, unit: "분", reward: 4, measure: (t) => Math.floor(t.reduce((a, r) => a + (r.studySec || 0), 0) / 60) },
  { id: "hard1", title: "Lv.2 이상 주제 1개 끝내기", icon: "star", goal: 1, unit: "개", reward: 3, measure: (t) => t.filter((r) => r.level === "중급" || r.level === "심화").length },
  { id: "xp80", title: "경험치 80 XP 모으기", icon: "bolt", goal: 80, unit: "XP", reward: 3, measure: (t) => t.reduce((a, r) => a + Math.max(0, r.rp || 0), 0) },
];

/** 날짜로 정해지는 의사 난수 (같은 날엔 늘 같은 퀘스트) */
function seeded(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function dailyQuests(records: StudyRecord[], now = new Date()): Quest[] {
  const day = dateKey(now);
  const today = records.filter((r) => dateKey(new Date(r.studiedAt)) === day);
  const rnd = seeded(day);
  const pool = [...POOL];
  const picked: Def[] = [];
  while (picked.length < 2 && pool.length) {
    const d = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    // 같은 종류(정답 5·10, 공부 15·30분, 주제 1·2개)가 겹치지 않게
    if (picked.some((p) => p.id.replace(/\d+$/, "") === d.id.replace(/\d+$/, ""))) continue;
    picked.push(d);
  }
  return [BASE, ...picked].map(({ measure, ...q }) => {
    const value = measure(today);
    return { ...q, value, done: value >= q.goal };
  });
}

export const questKey = (id: string, now = new Date()) => `quest:${dateKey(now)}:${id}`;

/** 오늘 자정까지 남은 시간 (예: "3시간 12분") */
export function untilMidnight(now = new Date()) {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const m = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}
