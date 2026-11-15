/** Shared quest calendar. Device/server local time zones do not change reward dates. */
export const QUEST_TIME_ZONE = "Asia/Seoul";
type QuestPeriod = "day" | "week" | "month" | "premium";
const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: QUEST_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function questDateKey(now = new Date()) {
  const parts = calendar.formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export const questMonthKey = (now = new Date()) => questDateKey(now).slice(0, 7);

function calendarDay(now: Date) {
  return new Date(questDateKey(now) + "T00:00:00Z");
}
function seoulMidnight(day: Date) {
  // Current Korean standard time is UTC+09:00; UTC calendar arithmetic avoids host DST.
  return new Date(day.toISOString().slice(0, 10) + "T00:00:00+09:00");
}
export function questPeriodStart(period: QuestPeriod, now = new Date()) {
  const day = calendarDay(now);
  if (period === "week" || period === "premium") day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  if (period === "month") day.setUTCDate(1);
  return seoulMidnight(day);
}
export function questPeriodEnd(period: QuestPeriod, now = new Date()) {
  const day = calendarDay(questPeriodStart(period, now));
  if (period === "month") day.setUTCMonth(day.getUTCMonth() + 1);
  else day.setUTCDate(day.getUTCDate() + (period === "day" ? 1 : 7));
  return seoulMidnight(day);
}
