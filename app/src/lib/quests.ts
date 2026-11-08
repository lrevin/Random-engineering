import type { IconName } from "@/components/Icon";
import { monthKey } from "./economy";
import { dateKey } from "./stats";
import type { StudyRecord } from "./types";

/**
 * 퀘스트 (톱니바퀴 보상): 일일 · 주간(월~일) · 이달의 퀘스트.
 *
 * 보상 크기 (톱니바퀴를 버는 곳은 퀘스트뿐):
 *  - 일일: 3개 2~4개 + 모두 완료 상자 2개 → 하루 최대 12개
 *  - 주간: 3개 10~14개 + 상자 8개 → 주 최대 약 48개
 *  - 이달: 3개 30~40개 + 상자 25개 → 달 최대 약 140개
 * 매일·매주·매달 다 깨는 사람도 한 달에 약 680개, 보통은 300개 안팎.
 * 쓰는 곳: 보호권 20 · 연속 기록 복구 하루 20 · 공부 시간 추가 10 · 배틀권 40.
 */
export type Period = "day" | "week" | "month";

export interface Quest {
  id: string;
  title: string;
  icon: IconName;
  goal: number;
  value: number;
  reward: number;
  done: boolean;
  /** 진행 막대 숫자 뒤에 붙는 단위 (분 · 일) */
  unit: string;
}

interface Ctx {
  /** 이 기간의 기록 */
  inPeriod: StudyRecord[];
  /** 전체 기록 (처음 푸는 주제 판별용) */
  all: StudyRecord[];
  start: Date;
}
type Def = Omit<Quest, "value" | "done" | "unit"> & { kind: string; measure: (x: Ctx) => number };

// 재는 방법
const finished = (x: Ctx) => x.inPeriod.length;
const correct = (x: Ctx) => x.inPeriod.reduce((a, r) => a + r.score, 0);
const perfect = (x: Ctx) => x.inPeriod.filter((r) => r.total > 0 && r.score === r.total).length;
const minutes = (x: Ctx) => Math.floor(x.inPeriod.reduce((a, r) => a + (r.studySec || 0), 0) / 60);
const days = (x: Ctx) => new Set(x.inPeriod.map((r) => dateKey(new Date(r.studiedAt)))).size;
const xpSum = (x: Ctx) => x.inPeriod.reduce((a, r) => a + Math.max(0, r.rp || 0), 0);
const hard = (lv: string[]) => (x: Ctx) => x.inPeriod.filter((r) => lv.includes(r.level)).length;
/** 이 기간에 처음 푼 주제 수 */
const newTopics = (x: Ctx) => {
  const first = new Map<string, string>();
  for (const r of x.all) {
    const f = first.get(r.topicId);
    if (!f || r.studiedAt < f) first.set(r.topicId, r.studiedAt);
  }
  const s = x.start.toISOString();
  return [...first.values()].filter((t) => t >= s).length;
};

export interface PeriodDef {
  title: string;
  tab: string;
  /** 위쪽 띠 색 */
  color: string;
  soft: string;
  bonus: number;
  fixed?: Def;
  pool: Def[];
}

export const PERIODS: Record<Period, PeriodDef> = {
  day: {
    title: "오늘의 퀘스트", tab: "일일", color: "#e0453a", soft: "#ffe9e4", bonus: 2,
    fixed: { id: "finish1", kind: "finish", title: "주제 1개 공부 끝내기", icon: "book", goal: 1, reward: 2, measure: finished },
    pool: [
      { id: "correct5", kind: "correct", title: "퀴즈 정답 5개 맞히기", icon: "check", goal: 5, reward: 3, measure: correct },
      { id: "correct10", kind: "correct", title: "퀴즈 정답 10개 맞히기", icon: "target", goal: 10, reward: 4, measure: correct },
      { id: "perfect1", kind: "perfect", title: "퀴즈 만점 1번 받기", icon: "medal", goal: 1, reward: 4, measure: perfect },
      { id: "study15", kind: "study", title: "15분 이상 공부하기", icon: "clock", goal: 15, reward: 3, measure: minutes },
      { id: "study30", kind: "study", title: "30분 이상 공부하기", icon: "hourglass", goal: 30, reward: 4, measure: minutes },
      { id: "hard1", kind: "hard", title: "Lv.2 이상 주제 1개 끝내기", icon: "star", goal: 1, reward: 3, measure: hard(["중급", "심화"]) },
      { id: "xp80", kind: "xp", title: "경험치 80 XP 모으기", icon: "bolt", goal: 80, reward: 3, measure: xpSum },
    ],
  },
  week: {
    title: "이번 주 퀘스트", tab: "주간", color: "#2f6fd0", soft: "#e2ecfb", bonus: 8,
    fixed: { id: "days4", kind: "days", title: "이번 주 4일 공부하기", icon: "calendar", goal: 4, reward: 12, measure: days },
    pool: [
      { id: "finish8", kind: "finish", title: "주제 8개 공부 끝내기", icon: "books", goal: 8, reward: 12, measure: finished },
      { id: "correct40", kind: "correct", title: "퀴즈 정답 40개 맞히기", icon: "target", goal: 40, reward: 12, measure: correct },
      { id: "perfect3", kind: "perfect", title: "퀴즈 만점 3번 받기", icon: "medal", goal: 3, reward: 14, measure: perfect },
      { id: "study90", kind: "study", title: "90분 이상 공부하기", icon: "hourglass", goal: 90, reward: 12, measure: minutes },
      { id: "deep2", kind: "hard", title: "Lv.3 심화 주제 2개 끝내기", icon: "star", goal: 2, reward: 14, measure: hard(["심화"]) },
      { id: "new5", kind: "new", title: "처음 보는 주제 5개 공부하기", icon: "globe", goal: 5, reward: 10, measure: newTopics },
    ],
  },
  month: {
    title: "이달의 퀘스트", tab: "이달", color: "#7d4bc7", soft: "#efe5fb", bonus: 25,
    fixed: { id: "days15", kind: "days", title: "이번 달 15일 공부하기", icon: "calendar", goal: 15, reward: 40, measure: days },
    pool: [
      { id: "finish30", kind: "finish", title: "주제 30개 공부 끝내기", icon: "books", goal: 30, reward: 35, measure: finished },
      { id: "correct150", kind: "correct", title: "퀴즈 정답 150개 맞히기", icon: "target", goal: 150, reward: 35, measure: correct },
      { id: "perfect10", kind: "perfect", title: "퀴즈 만점 10번 받기", icon: "medal", goal: 10, reward: 40, measure: perfect },
      { id: "study600", kind: "study", title: "10시간 이상 공부하기", icon: "hourglass", goal: 600, reward: 35, measure: minutes },
      { id: "new20", kind: "new", title: "처음 보는 주제 20개 공부하기", icon: "globe", goal: 20, reward: 30, measure: newTopics },
    ],
  },
};

/** 기간 시작 (일: 0시 · 주: 월요일 0시 · 달: 1일 0시) */
export function periodStart(p: Period, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (p === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (p === "month") d.setDate(1);
  return d;
}

export function periodEnd(p: Period, now = new Date()) {
  const d = periodStart(p, now);
  if (p === "day") d.setDate(d.getDate() + 1);
  if (p === "week") d.setDate(d.getDate() + 7);
  if (p === "month") d.setMonth(d.getMonth() + 1);
  return d;
}

/** 기간을 나타내는 키 (보상 받은 기록에 씀). 일일은 예전 형식 그대로 "YYYY-MM-DD" */
export function periodKey(p: Period, now = new Date()) {
  if (p === "day") return dateKey(now);
  if (p === "week") return "w" + dateKey(periodStart("week", now));
  return "m" + monthKey(now);
}

export const questKey = (p: Period, id: string, now = new Date()) => `quest:${periodKey(p, now)}:${id}`;

/** 같은 기간엔 늘 같은 퀘스트가 나오도록 기간 키로 만든 의사 난수 */
function seeded(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function questsFor(p: Period, records: StudyRecord[], now = new Date()): Quest[] {
  const def = PERIODS[p];
  const start = periodStart(p, now);
  const end = periodEnd(p, now);
  const inPeriod = records.filter((r) => {
    const t = new Date(r.studiedAt);
    return t >= start && t < end;
  });
  const rnd = seeded(p + periodKey(p, now));
  const pool = [...def.pool];
  const picked: Def[] = def.fixed ? [def.fixed] : [];
  while (picked.length < 3 && pool.length) {
    const d = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    // 같은 종류(정답 5·10개, 공부 15·30분 …)는 겹치지 않게
    if (picked.some((x) => x.kind === d.kind)) continue;
    picked.push(d);
  }
  const ctx: Ctx = { inPeriod, all: records, start };
  return picked.map(({ measure, kind: _kind, ...q }) => {
    const value = measure(ctx);
    return { ...q, value, done: value >= q.goal, unit: measure === minutes ? "분" : measure === days ? "일" : "" };
  });
}

/** 기간이 끝날 때까지 남은 시간 (예: "3일 4시간", "3시간 12분") */
export function untilEnd(p: Period, now = new Date()) {
  const m = Math.max(0, Math.round((periodEnd(p, now).getTime() - now.getTime()) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}일 ${h}시간`;
  return h > 0 ? `${h}시간 ${m % 60}분` : `${m}분`;
}
