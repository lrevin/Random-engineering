import type { LevelNum, Topic } from "@/data";
import type { StudyRecord } from "./types";

/** 랭크 단계 (사용자 전체 랭크와 주제별 숙련 랭크가 같은 이름을 씁니다) */
export const TIERS = [
  { id: "bronze", name: "브론즈", emoji: "🥉", color: "#a9714b" },
  { id: "silver", name: "실버", emoji: "🥈", color: "#8e9aaf" },
  { id: "gold", name: "골드", emoji: "🥇", color: "#d4a017" },
  { id: "platinum", name: "플래티넘", emoji: "💠", color: "#3fa7a0" },
  { id: "diamond", name: "다이아", emoji: "💎", color: "#4f7cff" },
  { id: "engineer", name: "엔지니어", emoji: "🛠️", color: "#b2342c" },
] as const;
export type Tier = (typeof TIERS)[number];

// ───────── 사용자 전체 랭크: 누적 RP ─────────
/** 각 랭크에 도달하는 데 필요한 누적 RP */
export const USER_TIER_MIN = [0, 300, 900, 2000, 4000, 7000];

export function userRank(totalRp: number) {
  let i = 0;
  while (i + 1 < USER_TIER_MIN.length && totalRp >= USER_TIER_MIN[i + 1]) i++;
  const next = i + 1 < USER_TIER_MIN.length ? USER_TIER_MIN[i + 1] : null;
  const floor = USER_TIER_MIN[i];
  return {
    index: i,
    tier: TIERS[i],
    rp: totalRp,
    next,
    /** 다음 랭크까지 진행률 0~1 (최고 랭크면 1) */
    progress: next === null ? 1 : (totalRp - floor) / (next - floor),
    toNext: next === null ? 0 : next - totalRp,
  };
}

export const totalRp = (records: StudyRecord[]) => records.reduce((a, r) => a + (r.rp || 0), 0);

// ───────── 주제별 숙련 랭크: 그 주제에서 맞힌 문제 수 누적 ─────────
/** 브론즈는 한 번 풀면 획득. 엔지니어는 누적 75문제 + 만점 1회 이상 */
export const TOPIC_TIER_MIN = [0, 15, 30, 45, 60, 75];

export function topicMastery(topicId: string, records: StudyRecord[]) {
  const rs = records.filter((r) => r.topicId === topicId);
  const points = rs.reduce((a, r) => a + Math.min(r.score, r.total), 0);
  const perfect = rs.some((r) => r.score === r.total && r.total > 0);
  let i = -1; // -1 = 아직 안 풂
  if (rs.length) {
    i = 0;
    while (i + 1 < TOPIC_TIER_MIN.length && points >= TOPIC_TIER_MIN[i + 1]) i++;
    if (i === TIERS.length - 1 && !perfect) i--; // 엔지니어는 만점 경험 필요
  }
  const next = i >= 0 && i + 1 < TOPIC_TIER_MIN.length ? TOPIC_TIER_MIN[i + 1] : null;
  return {
    index: i,
    tier: i >= 0 ? TIERS[i] : null,
    attempts: rs.length,
    points,
    best: rs.reduce((a, r) => Math.max(a, r.score), 0),
    perfect,
    next,
  };
}

// ───────── 이번 퀴즈로 얻는 RP ─────────
/** 난이도별 정답 1개당 RP — 주제마다 얻는 점수가 다릅니다 */
export const RP_PER_CORRECT: Record<LevelNum, number> = { 1: 4, 2: 6, 3: 9 };

export interface RpPart {
  label: string;
  value: number;
}

export function calcRp(opts: { topic: Topic; correct: number; total: number; priorAttempts: number; streak: number }) {
  const { topic, correct, total, priorAttempts, streak } = opts;
  const rate = RP_PER_CORRECT[topic.lv];
  const repeat = priorAttempts === 0 ? 1 : priorAttempts === 1 ? 0.7 : 0.5;
  const base = Math.round(correct * rate * repeat);
  const parts: RpPart[] = [
    { label: `정답 ${correct}개 × ${rate} RP (Lv.${topic.lv})${repeat < 1 ? ` × ${repeat} 복습` : ""}`, value: base },
  ];
  if (total > 0 && correct === total) parts.push({ label: "만점 보너스 +20%", value: Math.round(base * 0.2) });
  if (priorAttempts === 0 && correct >= Math.ceil(total * 0.6)) parts.push({ label: "첫 클리어", value: topic.lv * 10 });
  if (streak >= 3) parts.push({ label: `${streak}일 연속 보너스 +10%`, value: Math.round(base * 0.1) });
  return { total: parts.reduce((a, p) => a + p.value, 0), parts };
}

/** 주제 카드에 보여 줄 "최대 획득 RP" (처음 풀어서 만점일 때) */
export const maxRpFor = (topic: Topic, total = 10) => {
  const base = total * RP_PER_CORRECT[topic.lv];
  return base + Math.round(base * 0.2) + topic.lv * 10;
};
