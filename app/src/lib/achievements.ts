import { topicMastery, userLevel } from "./rank";
import { dateKey, isBattleRecord, studyDays } from "./stats";
import type { StudyRecord } from "./types";

/** 업적: 공부 기록만으로 계산 (서버 저장 없음). 단계마다 목표치가 올라감 */
export type AchievementId = "streak" | "topics" | "perfect" | "engineer" | "battle" | "level";

export interface Achievement {
  id: AchievementId;
  title: string;
  /** {n} 자리에 다음 목표치 */
  desc: string;
  value: number;
  goals: number[];
  /** 달성한 단계 수 (0 = 아직 없음) */
  stage: number;
  /** 다음 목표 (다 깼으면 null) */
  next: number | null;
}

/** 지금까지 가장 길게 이어 간 연속 일수 */
export function bestStreak(records: StudyRecord[], kept: readonly string[] = []) {
  const days = [...studyDays(records, kept)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of days) {
    if (prev) {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      run = dateKey(d) === k ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

function make(id: AchievementId, title: string, desc: string, value: number, goals: number[]): Achievement {
  const stage = goals.filter((g) => value >= g).length;
  return { id, title, desc, value, goals, stage, next: stage < goals.length ? goals[stage] : null };
}

export function achievements(records: StudyRecord[], xp: number, kept: readonly string[] = []): Achievement[] {
  const topicIds = [...new Set(records.map((r) => r.topicId))];
  const engineers = topicIds.filter((id) => topicMastery(id, records).index >= 5).length;
  return [
    make("streak", "꾸준함", "{n}일 연속으로 공부하기", bestStreak(records, kept), [3, 7, 30, 100, 365]),
    make("topics", "탐험가", "서로 다른 주제 {n}개 공부하기", topicIds.length, [1, 10, 50, 150, 400]),
    make("perfect", "만점왕", "퀴즈 만점 {n}번 받기", records.filter((r) => r.total > 0 && r.score === r.total).length, [1, 5, 20, 50, 100]),
    make("engineer", "엔지니어", "엔지니어 랭크 주제 {n}개 만들기", engineers, [1, 5, 15, 40]),
    make("battle", "승부사", "배틀 {n}번 하기", records.filter(isBattleRecord).length, [1, 10, 30, 100]),
    make("level", "성장", "{n}레벨 달성하기", userLevel(xp).level, [5, 10, 30, 50, 100]),
  ];
}
