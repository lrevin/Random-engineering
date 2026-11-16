/**
 * 연속 기록 마일스톤: 연속 공부 7 · 30 · 100일을 달성하면 보상 상자(톱니바퀴) + 칭호.
 * 달성 여부는 "지금까지 가장 길게 이어 간 연속 일수"로 판단해서, 나중에 끊겨도 받을 수 있음.
 * 서버 api/mysql/special-reward-policy.mjs의 MILESTONES와 같아야 함.
 */
export interface Milestone {
  days: number;
  gears: number;
  /** 칭호 id (lib/skins.ts) */
  title: string;
}

export const MILESTONES: Milestone[] = [
  { days: 7, gears: 30, title: "t-streak7" },
  { days: 30, gears: 100, title: "t-streak30" },
  { days: 100, gears: 300, title: "t-streak100" },
];
