import type { LevelNum, Topic } from "@/data";
import { QUIZ_LENGTH } from "./quiz";
import type { StudyRecord } from "./types";

/** 주제별 숙련 랭크 단계 (사용자는 랭크 대신 1~100 레벨을 씁니다) */
export const TIERS = [
  { id: "bronze", name: "브론즈", color: "#a9714b" },
  { id: "silver", name: "실버", color: "#8e9aaf" },
  { id: "gold", name: "골드", color: "#d4a017" },
  { id: "platinum", name: "플래티넘", color: "#3fa7a0" },
  { id: "diamond", name: "다이아", color: "#4f7cff" },
  { id: "engineer", name: "엔지니어", color: "#b2342c" },
] as const;
export type Tier = (typeof TIERS)[number];

// ───────── 사용자 레벨: 누적 경험치(XP) ─────────
// 기록의 rp 필드에 그 퀴즈로 얻은 XP가 저장됩니다 (DB 열 이름은 그대로 rp)
export const MAX_LEVEL = 100;

/** 레벨 n → n+1에 필요한 XP: 1레벨 50, 레벨마다 10씩 늘어남 (100레벨까지 누적 53,460 XP, 퀴즈 한 번에 보통 50~110 XP) */
export const xpToNext = (level: number) => 50 + 10 * (level - 1);

export function userLevel(totalXp: number) {
  let level = 1;
  let floor = 0;
  while (level < MAX_LEVEL && totalXp >= floor + xpToNext(level)) {
    floor += xpToNext(level);
    level++;
  }
  const need = level < MAX_LEVEL ? xpToNext(level) : 0;
  return {
    level,
    xp: totalXp,
    /** 이번 레벨에서 모은 XP / 다음 레벨까지 필요한 XP */
    into: totalXp - floor,
    need,
    /** 다음 레벨까지 진행률 0~1 (MAX면 1) */
    progress: need ? (totalXp - floor) / need : 1,
    toNext: need ? floor + need - totalXp : 0,
  };
}

export const totalRp = (records: StudyRecord[]) => records.reduce((a, r) => a + (r.rp || 0), 0);

// ───────── 주제 숙련도: 화면에는 안 보이고, 홈의 '마스터한 주제 포함' 필터에만 씀 ─────────
/** 브론즈는 한 번 풀면 획득. 엔지니어는 누적 50문제 + 만점 1회 이상 (한 번에 7문제라 약 7~8번 풀면 엔지니어) */
export const TOPIC_TIER_MIN = [0, 10, 20, 30, 40, 50];

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

// ───────── 분야별 랭크: 그 분야(컴퓨터공학 · 전기공학 …)에서 맞힌 문제 수 누적 ─────────
/**
 * 분야 하나에 주제가 수십~수백 개라 기준을 크게 잡음. 퀴즈 한 번에 보통 5~7개를 맞히므로
 * 실버 약 6번 · 골드 약 20번 · 플래티넘 약 50번 · 다이아 약 100번 · 엔지니어 약 200번.
 * 엔지니어는 그 분야에서 서로 다른 주제 DOMAIN_ENGINEER_TOPICS개 이상도 공부해야 함.
 */
export const DOMAIN_TIER_MIN = [0, 30, 100, 250, 500, 1000];
export const DOMAIN_ENGINEER_TOPICS = 30;

export function domainMastery(domain: string, records: StudyRecord[]) {
  const rs = records.filter((r) => r.domain === domain);
  const points = rs.reduce((a, r) => a + Math.min(r.score, r.total), 0);
  const topics = new Set(rs.map((r) => r.topicId)).size;
  let i = -1; // -1 = 아직 안 풂
  if (rs.length) {
    i = 0;
    while (i + 1 < DOMAIN_TIER_MIN.length && points >= DOMAIN_TIER_MIN[i + 1]) i++;
    if (i === TIERS.length - 1 && topics < DOMAIN_ENGINEER_TOPICS) i--; // 엔지니어는 여러 주제를 고루 공부해야
  }
  const next = i >= 0 && i + 1 < DOMAIN_TIER_MIN.length ? DOMAIN_TIER_MIN[i + 1] : null;
  return { index: i, tier: i >= 0 ? TIERS[i] : null, attempts: rs.length, points, topics, next };
}

/** 공부한 분야마다 랭크 (높은 순) */
export function domainRanks(records: StudyRecord[]) {
  return [...new Set(records.map((r) => r.domain))]
    .map((d) => ({ domain: d, ...domainMastery(d, records) }))
    .sort((a, b) => b.index - a.index || b.points - a.points);
}

// ───────── 이번 퀴즈로 얻는 XP ─────────
/** 난이도별 정답 1개당 XP — 주제마다 얻는 점수가 다릅니다 */
export const RP_PER_CORRECT: Record<LevelNum, number> = { 1: 6, 2: 9, 3: 13 };

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
    { label: `정답 ${correct}개 × ${rate} XP (Lv.${topic.lv})${repeat < 1 ? ` × ${repeat} 복습` : ""}`, value: base },
  ];
  if (total > 0 && correct === total) parts.push({ label: "만점 보너스 +20%", value: Math.round(base * 0.2) });
  if (priorAttempts === 0 && correct >= Math.ceil(total * 0.6)) parts.push({ label: "첫 클리어", value: topic.lv * 10 });
  if (streak >= 3) parts.push({ label: `${streak}일 연속 보너스 +10%`, value: Math.round(base * 0.1) });
  return { total: parts.reduce((a, p) => a + p.value, 0), parts };
}

/** 주제 카드에 보여 줄 "최대 획득 XP" (처음 풀어서 만점일 때) */
export const maxRpFor = (topic: Topic, total = QUIZ_LENGTH) => {
  const base = total * RP_PER_CORRECT[topic.lv];
  return base + Math.round(base * 0.2) + topic.lv * 10;
};
