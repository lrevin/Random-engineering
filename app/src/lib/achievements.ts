import type { IconName } from "@/components/Icon";
import { domainById } from "@/data";
import type { ExamResult } from "./exam";
import { domainRanks, userLevel } from "./rank";
import { dateKey, isBattleRecord, studyDays } from "./stats";
import type { StudyRecord } from "./types";

/**
 * 업적 30개: 공부 기록 + (모의고사 결과 · 해결한 오답 · 퀘스트 보상 횟수)로 계산 (서버 저장 없음).
 * 단계마다 목표치가 올라가고, 묶음(group)별로 프로필에 보여 줍니다.
 */
export type AchievementGroup = "steady" | "explore" | "skill" | "challenge" | "cert";
export const ACHIEVEMENT_GROUPS: { id: AchievementGroup; title: string }[] = [
  { id: "steady", title: "꾸준함" },
  { id: "explore", title: "탐험" },
  { id: "skill", title: "실력" },
  { id: "challenge", title: "도전" },
  { id: "cert", title: "자격증 · 복습" },
];

export interface Achievement {
  id: string;
  group: AchievementGroup;
  title: string;
  /** {n} 자리에 다음 목표치 */
  desc: string;
  icon: IconName;
  color: string;
  deep: string;
  value: number;
  goals: number[];
  /** 달성한 단계 수 (0 = 아직 없음) */
  stage: number;
  /** 다음 목표 (다 깼으면 null) */
  next: number | null;
}

/** 기록 말고 다른 곳에 저장된 값 (없으면 0으로 계산) */
export interface AchievementExtra {
  exams?: ExamResult[];
  /** 오답 다시 풀기로 해결한 오답 수 */
  solved?: number;
  /** 퀘스트 보상을 받은 횟수 */
  questClaims?: number;
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

type Look = [icon: IconName, color: string, deep: string];

function make(id: string, group: AchievementGroup, title: string, desc: string, look: Look, value: number, goals: number[]): Achievement {
  const stage = goals.filter((g) => value >= g).length;
  return { id, group, title, desc, icon: look[0], color: look[1], deep: look[2], value, goals, stage, next: stage < goals.length ? goals[stage] : null };
}

const count = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

export function achievements(records: StudyRecord[], xp: number, kept: readonly string[] = [], extra: AchievementExtra = {}): Achievement[] {
  const topicIds = [...new Set(records.map((r) => r.topicId))];
  const tiers = domainRanks(records).map((d) => d.index);
  const isPerfect = (r: StudyRecord) => r.total > 0 && r.score === r.total;
  const hour = (r: StudyRecord) => new Date(r.studiedAt).getHours();
  const dow = (r: StudyRecord) => new Date(r.studiedAt).getDay();
  // 만점을 연속으로 받은 최고 기록
  let perfectRun = 0;
  let run = 0;
  for (const r of [...records].sort((a, b) => (a.studiedAt < b.studiedAt ? -1 : 1))) {
    run = isPerfect(r) ? run + 1 : 0;
    perfectRun = Math.max(perfectRun, run);
  }
  // 하루에 가장 많이 끝낸 주제 수
  const perDay = new Map<string, number>();
  for (const r of records) {
    const k = dateKey(new Date(r.studiedAt));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const dayMax = Math.max(0, ...perDay.values());
  const exams = extra.exams ?? [];

  return [
    // ── 꾸준함
    make("streak", "steady", "꾸준함", "{n}일 연속으로 공부하기", ["flame", "#ff8a1f", "#c4600c"], bestStreak(records, kept), [3, 7, 30, 100, 365]),
    make("days", "steady", "출석부", "공부한 날 {n}일 채우기", ["calendar", "#2f8f5b", "#1f6b42"], studyDays(records).size, [7, 30, 100, 200, 365]),
    make("sessions", "steady", "개근", "공부를 {n}번 끝내기", ["book", "#3d6fd8", "#2a4fa3"], records.length, [10, 50, 200, 500, 1000]),
    make("minutes", "steady", "몰입", "모두 합쳐 {n}분 공부하기", ["hourglass", "#16a39a", "#0f7770"], Math.floor(records.reduce((a, r) => a + (r.studySec || 0), 0) / 60), [60, 300, 1000, 3000, 10000]),
    make("early", "steady", "아침형", "오전 9시 전에 {n}번 공부하기", ["bell", "#f2a900", "#c07f00"], count(records, (r) => hour(r) >= 5 && hour(r) < 9), [1, 10, 30, 100]),
    make("night", "steady", "올빼미", "밤 10시 이후에 {n}번 공부하기", ["clock", "#5b5bd6", "#3f3fa6"], count(records, (r) => hour(r) >= 22 || hour(r) < 4), [1, 10, 30, 100]),
    make("weekend", "steady", "주말 공부", "주말에 {n}번 공부하기", ["party", "#d14d8b", "#a33468"], count(records, (r) => dow(r) === 0 || dow(r) === 6), [2, 10, 30, 80]),
    make("keeper", "steady", "지킴이", "보호권·복구로 연속 기록 {n}일 지키기", ["shield", "#3d8bdf", "#2a67ad"], kept.length, [1, 3, 7, 15]),
    // ── 탐험
    make("topics", "explore", "탐험가", "서로 다른 주제 {n}개 공부하기", ["book", "#3d8bdf", "#2a67ad"], topicIds.length, [1, 10, 50, 150, 400]),
    make("domains", "explore", "박학다식", "서로 다른 분야 {n}개 공부하기", ["globe", "#2f8f5b", "#1f6b42"], new Set(records.map((r) => r.domain)).size, [2, 4, 8, 12, 16]),
    make("categories", "explore", "세부 탐험", "세부 분야 {n}개 공부하기", ["tree", "#16a39a", "#0f7770"], new Set(records.map((r) => r.category)).size, [3, 10, 25, 50, 80]),
    make("science", "explore", "기초 과학", "수학·과학 주제를 {n}번 공부하기", ["books", "#a05bd1", "#7a3fa6"], count(records, (r) => domainById(r.domain)?.group === "sci"), [1, 10, 30, 80]),
    make("basic", "explore", "기초 탄탄", "Lv.1 기초 주제를 {n}번 끝내기", ["star", "#6b7a90", "#4c586b"], count(records, (r) => r.level === "기초"), [5, 20, 60, 150]),
    make("deep", "explore", "심화 도전", "Lv.3 심화 주제를 {n}번 끝내기", ["bolt", "#e0453a", "#b02d26"], count(records, (r) => r.level === "심화"), [1, 10, 30, 80]),
    make("retry", "explore", "재도전", "공부했던 주제를 {n}번 다시 공부하기", ["dice", "#e07a1f", "#b05c10"], records.length - topicIds.length, [3, 15, 50, 150]),
    // ── 실력
    make("perfect", "skill", "만점왕", "퀴즈 만점 {n}번 받기", ["target", "#e0453a", "#b02d26"], count(records, isPerfect), [1, 5, 20, 50, 100]),
    make("perfectRun", "skill", "연속 만점", "만점을 {n}번 연속으로 받기", ["medal", "#f2a900", "#c07f00"], perfectRun, [2, 3, 5, 10]),
    make("correct", "skill", "정답 수집가", "퀴즈 정답 {n}개 맞히기", ["check", "#2f8f5b", "#1f6b42"], records.reduce((a, r) => a + r.score, 0), [50, 300, 1000, 3000, 10000]),
    make("high", "skill", "고득점", "정답률 80% 이상인 퀴즈 {n}번", ["chart", "#3d6fd8", "#2a4fa3"], count(records, (r) => r.total > 0 && r.score / r.total >= 0.8), [5, 30, 100, 300]),
    make("gold", "skill", "골드 수집", "골드 랭크 이상 분야 {n}개 만들기", ["trophy", "#d4a017", "#a57a0c"], count(tiers, (t) => t >= 2), [1, 2, 4, 8]),
    make("engineer", "skill", "엔지니어", "엔지니어 랭크 분야 {n}개 만들기", ["gear", "#6b7a90", "#4c586b"], count(tiers, (t) => t >= 5), [1, 2, 3, 5]),
    make("level", "skill", "성장", "{n}레벨 달성하기", ["star", "#f2a900", "#c07f00"], userLevel(xp).level, [5, 10, 30, 50, 100]),
    make("xp", "skill", "경험치 부자", "누적 경험치 {n} XP 모으기", ["bolt", "#f2a900", "#c07f00"], Math.max(0, xp), [500, 2000, 10000, 30000, 100000]),
    // ── 도전
    make("battle", "challenge", "승부사", "배틀 {n}번 하기", ["swords", "#a05bd1", "#7a3fa6"], count(records, isBattleRecord), [1, 10, 30, 100]),
    make("dayMax", "challenge", "몰아치기", "하루에 주제 {n}개 끝내기", ["flame", "#e0453a", "#b02d26"], dayMax, [2, 3, 5, 8]),
    make("quest", "challenge", "퀘스트 사냥꾼", "퀘스트 보상 {n}번 받기", ["chest", "#e07a1f", "#b05c10"], extra.questClaims ?? 0, [5, 30, 80, 150]),
    // ── 자격증 · 복습
    make("exam", "cert", "수험생", "자격증 모의고사 {n}번 끝내기", ["doc", "#3d6fd8", "#2a4fa3"], exams.length, [1, 5, 10, 30]),
    make("examPass", "cert", "합격권", "모의고사에서 합격권 {n}번 받기", ["medal", "#2f8f5b", "#1f6b42"], count(exams, (e) => e.pass), [1, 3, 10, 20]),
    make("examCerts", "cert", "다관왕", "서로 다른 자격증 {n}종에서 합격권 받기", ["crown", "#7d4bc7", "#55309a"], new Set(exams.filter((e) => e.pass).map((e) => e.certId)).size, [1, 2, 4, 7, 10]),
    make("review", "cert", "오답 정복", "오답 다시 풀기로 오답 {n}개 해결하기", ["target", "#16a39a", "#0f7770"], extra.solved ?? 0, [5, 30, 100, 300]),
  ];
}
