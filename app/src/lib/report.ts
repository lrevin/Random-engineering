import { domainById } from "@/data";
import { dateKey, isBattleRecord } from "./stats";
import type { StudyRecord } from "./types";

/** 이 달 달력 칸: 그날 공부 횟수 (0이면 안 함, 보호권으로 지킨 날은 kept) */
export interface CalendarDay { key: string; day: number; count: number; kept: boolean; today: boolean; future: boolean }

/** 달력: 일요일부터 시작하는 주 단위 칸 (앞뒤 빈칸은 null) */
export function monthCalendar(records: StudyRecord[], kept: readonly string[], year: number, month: number, now = new Date()) {
  const counts = new Map<string, number>();
  for (const r of records) {
    const k = dateKey(new Date(r.studiedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const keptSet = new Set(kept);
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(now);
  const cells: (CalendarDay | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const key = dateKey(date);
    cells.push({ key, day: d, count: counts.get(key) ?? 0, kept: keptSet.has(key), today: key === todayKey, future: date > now && key !== todayKey });
  }
  while (cells.length % 7) cells.push(null);
  const studied = cells.filter((c) => c && c.count > 0).length;
  return { cells, studied };
}

/** 주간 리포트: 이번 주(월~일)와 지난주 비교 */
export interface WeekReport {
  start: Date;
  days: number;
  sessions: number;
  minutes: number;
  correct: number;
  total: number;
  xp: number;
  /** 정답률이 가장 낮은 분야 (2번 이상 푼 분야 중) */
  weak: { domain: string; name: string; rate: number } | null;
  /** 가장 많이 공부한 분야 */
  top: { domain: string; name: string; count: number } | null;
  /** 요일별 공부 횟수 (월~일) */
  perDay: number[];
}

export function weekStart(now = new Date(), offsetWeeks = 0) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - offsetWeeks * 7);
  return d;
}

export function weekReport(records: StudyRecord[], now = new Date(), offsetWeeks = 0): WeekReport {
  const start = weekStart(now, offsetWeeks);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const rs = records.filter((r) => {
    const t = new Date(r.studiedAt);
    return t >= start && t < end && !isBattleRecord(r);
  });
  const perDay = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rs) perDay[(new Date(r.studiedAt).getDay() + 6) % 7]++;

  const byDomain = new Map<string, { n: number; c: number; t: number }>();
  for (const r of rs) {
    const x = byDomain.get(r.domain) ?? { n: 0, c: 0, t: 0 };
    x.n++;
    x.c += r.score;
    x.t += r.total;
    byDomain.set(r.domain, x);
  }
  const entries = [...byDomain.entries()];
  const topE = entries.sort((a, b) => b[1].n - a[1].n)[0];
  // 더 볼 분야는 두 분야 이상 공부했을 때만 (한 분야뿐이면 가장 많이 본 분야와 같아서)
  const weakE = entries.length >= 2 ? entries.filter(([, x]) => x.n >= 2 && x.t > 0).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)[0] : undefined;

  return {
    start,
    days: perDay.filter((n) => n > 0).length,
    sessions: rs.length,
    minutes: Math.round(rs.reduce((a, r) => a + (r.studySec || 0), 0) / 60),
    correct: rs.reduce((a, r) => a + r.score, 0),
    total: rs.reduce((a, r) => a + r.total, 0),
    xp: rs.reduce((a, r) => a + Math.max(0, r.rp || 0), 0),
    top: topE ? { domain: topE[0], name: domainById(topE[0])?.name ?? topE[0], count: topE[1].n } : null,
    weak: weakE ? { domain: weakE[0], name: domainById(weakE[0])?.name ?? weakE[0], rate: Math.round((weakE[1].c / weakE[1].t) * 100) } : null,
    perDay,
  };
}

/** 공유용 한 줄 요약 */
export function reportText(r: WeekReport, nickname: string) {
  const rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
  return [
    `[뽑공] ${nickname || "나"}의 이번 주 공부`,
    `공부한 날 ${r.days}일 · 주제 ${r.sessions}개 · ${r.minutes}분`,
    `퀴즈 정답률 ${rate}% · +${r.xp} XP`,
    r.top ? `가장 많이 본 분야: ${r.top.name}` : "",
  ].filter(Boolean).join("\n");
}
