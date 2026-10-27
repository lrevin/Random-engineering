import type { StudyRecord } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
};

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

export const fmtDuration = (sec: number) => (sec ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : "-");

export function studiedToday(records: StudyRecord[], now = new Date()) {
  const k = dateKey(now);
  return records.some((r) => dateKey(new Date(r.studiedAt)) === k);
}

/** 연속 공부 일수. 오늘 아직 안 했으면 어제까지의 연속 일수를 돌려줍니다. */
export function calcStreak(records: StudyRecord[], now = new Date()) {
  const days = new Set(records.map((r) => dateKey(new Date(r.studiedAt))));
  const d = new Date(now);
  const today = days.has(dateKey(d));
  if (!today) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return { streak: n, today };
}

/** 최근 7일 (오래된 날 → 오늘) 공부 여부 */
export function lastWeek(records: StudyRecord[], now = new Date()) {
  const days = new Set(records.map((r) => dateKey(new Date(r.studiedAt))));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return { label: DOW[d.getDay()], done: days.has(dateKey(d)), isToday: i === 6 };
  });
}

/** 평균 퀴즈 점수 (10점 만점 기준) */
export function averageScore(records: StudyRecord[]) {
  const rs = records.filter((r) => r.total > 0);
  if (!rs.length) return 0;
  return rs.reduce((a, r) => a + (r.score / r.total) * 10, 0) / rs.length;
}
