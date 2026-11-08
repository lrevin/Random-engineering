import { dateKey, studyDays } from "./stats";
import type { StudyRecord } from "./types";

// ───────── 톱니바퀴(유료 재화) 쓰는 곳 ─────────
// 물가 기준 (2026-11): 부지런한 무료 사용자가 하루 약 30~35개를 벌어
// (출석 2 + 일일 퀘스트 약 8 + 주간·이달 퀘스트 하루치 약 6 + 광고 3번 30)
// 배틀권(50)은 하루 반에 한 판, 보호권(30)은 하루치 정도. 전부 다 하면 하루 최대 약 60개.
/** 연속 기록 보호권 1개 가격 · 최대 보유 수 */
export const FREEZE_COST = 30;
export const MAX_FREEZES = 2;
/** 보호권이 모자라 끊긴 날을 톱니바퀴로 복구: 하루당 가격 · 최대 복구 일수 */
export const RESTORE_COST_PER_DAY = 30;
export const MAX_RESTORE_DAYS = 2;

// ───────── 무료 / 유료 버전 ─────────
/** 무료 버전 배틀권: 매월 1일 00시에 이 개수로 다시 채움 (쌓이지 않음). 유료 버전은 무제한 */
export const FREE_BATTLE_TICKETS = 2;

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** 톱니바퀴로 사는 배틀권 1개 가격 (무료 버전). 산 배틀권은 달이 바뀌어도 남음 */
export const BATTLE_TICKET_COST = 50;
/** 사 둘 수 있는 배틀권 최대 개수 */
export const MAX_BOUGHT_TICKETS = 5;

export interface Tickets {
  /** 이번 달 무료 배틀권 */
  n: number;
  /** 톱니바퀴로 산 배틀권 (매달 초기화되지 않음) */
  bought?: number;
  /** 마지막으로 채운 달 "YYYY-MM" */
  month: string;
}

/** 달이 바뀌었으면 배틀권을 다시 채움 */
export const refillTickets = (t: Tickets | null, now = new Date()): Tickets =>
  !t || t.month !== monthKey(now) ? { n: FREE_BATTLE_TICKETS, month: monthKey(now), bought: t?.bought ?? 0 } : t;

// ───────── 1:1 배틀 ─────────
/** 진 사람 누적 경험치에서 이긴 사람에게 넘어가는 몫 */
export const BATTLE_XP_RATE = 0.05;
export const BATTLE_XP_MAX = 100;

/** 진 사람이 잃는(= 이긴 사람이 얻는) 경험치 */
export const battleXpTransfer = (loserXp: number) => Math.min(BATTLE_XP_MAX, Math.floor(Math.max(0, loserXp) * BATTLE_XP_RATE));

// ───────── 연속 기록 지키기 ─────────
export interface StreakRescue {
  /** 끊기기 전 연속 일수 */
  streak: number;
  /** 보호권으로 자동으로 지킬 날 (오래된 날부터) */
  auto: string[];
  /** 보호권이 모자라 톱니바퀴로 복구할 수 있는 날 */
  restore: string[];
  /** 복구할 수 없을 만큼 오래 빠졌는지 */
  tooLate: boolean;
}

/**
 * 앱을 열 때: 마지막 공부한 날(또는 지킨 날) 다음 날부터 어제까지 빠진 날을 찾아
 * 보호권을 먼저 쓰고, 그래도 남으면 톱니바퀴로 복구할 수 있는지 계산합니다. 빠진 날이 없거나 기록이 없으면 null.
 */
export function planStreakRescue(records: StudyRecord[], kept: readonly string[], freezes: number, now = new Date()): StreakRescue | null {
  const days = studyDays(records, kept);
  const today = dateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (days.has(today) || days.has(dateKey(yesterday))) return null; // 아직 끊기지 않음

  // 어제부터 거꾸로 가며 마지막으로 이어진 날을 찾음 (최대 1년)
  const missed: string[] = [];
  const d = new Date(yesterday);
  for (let i = 0; i < 366 && !days.has(dateKey(d)); i++) {
    missed.unshift(dateKey(d));
    d.setDate(d.getDate() - 1);
  }
  if (!days.has(dateKey(d))) return null; // 이어 갈 기록이 없음
  let streak = 0;
  while (days.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  const auto = missed.slice(0, Math.max(0, freezes));
  const rest = missed.slice(auto.length);
  const tooLate = rest.length > MAX_RESTORE_DAYS;
  return { streak, auto: tooLate ? [] : auto, restore: tooLate ? [] : rest, tooLate };
}
