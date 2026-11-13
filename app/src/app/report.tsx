import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { DomainIcon, Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Card, Row, Screen, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { monthCalendar, reportText, weekReport } from "@/lib/report";
import { radius, useColors } from "@/theme";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

/** 학습 캘린더 + 주간 리포트 */
export default function Report() {
  const { records, keptDays, prefs } = useApp();
  const c = useColors();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const cal = useMemo(() => monthCalendar(records, keptDays, ym.y, ym.m), [records, keptDays, ym]);
  const thisWeek = useMemo(() => weekReport(records), [records]);
  const lastWeek = useMemo(() => weekReport(records, new Date(), 1), [records]);
  const rate = thisWeek.total ? Math.round((thisWeek.correct / thisWeek.total) * 100) : 0;
  const lastRate = lastWeek.total ? Math.round((lastWeek.correct / lastWeek.total) * 100) : 0;
  const maxDay = Math.max(1, ...thisWeek.perDay);

  const move = (d: number) => {
    tap();
    setYm(({ y, m }) => {
      const x = new Date(y, m + d, 1);
      return { y: x.getFullYear(), m: x.getMonth() };
    });
  };
  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();
  // 공부 횟수에 따라 칸 색 진하기 (깃허브 잔디처럼)
  const shade = (n: number) => (n >= 3 ? c.success : n === 2 ? c.success + "bb" : n === 1 ? c.success + "66" : c.chip);

  const diff = (a: number, b: number, unit = "") => {
    if (!b && !a) return null;
    const d = a - b;
    if (!d) return <T size={11} color="muted">지난주와 같아요</T>;
    return <T size={11} weight="semibold" color={d > 0 ? "success" : "accent"}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}{unit}</T>;
  };

  const tile = (icon: Parameters<typeof Icon>[0]["name"], value: string, label: string, delta: ReturnType<typeof diff>) => (
    <View style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: 12, borderRadius: radius.md, backgroundColor: c.chip }}>
      <Icon name={icon} size={24} />
      <T size={18} weight="bold">{value}</T>
      <T size={11} color="muted">{label}</T>
      {delta}
    </View>
  );

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">학습 리포트</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>

      {/* 주간 리포트 */}
      <SectionTitle
        title="이번 주"
        right={
          <Pressable onPress={() => { tap(); Share.share({ message: reportText(thisWeek, prefs.nickname) }).catch(() => {}); }} hitSlop={8} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="share" size={16} color={c.accent} />
            <T size={13} weight="semibold" color="accent">공유</T>
          </Pressable>
        }
      />
      <Card style={{ gap: 14 }}>
        <T size={12} color="muted">{thisWeek.start.getMonth() + 1}월 {thisWeek.start.getDate()}일(월)부터 · 지난주와 비교</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {tile("calendar", `${thisWeek.days}일`, "공부한 날", diff(thisWeek.days, lastWeek.days, "일"))}
          {tile("hourglass", `${thisWeek.minutes}분`, "공부 시간", diff(thisWeek.minutes, lastWeek.minutes, "분"))}
          {tile("target", `${rate}%`, "정답률", diff(rate, lastRate, "%"))}
        </View>

        {/* 요일별 막대 */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90 }}>
          {thisWeek.perDay.map((n, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <T size={11} weight="bold" color={n ? "ink" : "muted"}>{n || ""}</T>
              <View style={{ width: "70%", height: Math.max(4, (n / maxDay) * 54), borderRadius: 5, backgroundColor: n ? c.success : c.chip }} />
              <T size={11} color="muted">{WEEK[i]}</T>
            </View>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Row gap={8} style={{ flexWrap: "nowrap" }}>
            <Icon name="star" size={18} />
            <T size={14} style={{ flex: 1 }}>공부한 주제 <T size={14} weight="bold">{thisWeek.sessions}개</T> · 얻은 경험치 <T size={14} weight="bold">+{thisWeek.xp} XP</T></T>
          </Row>
          {thisWeek.top && (
            <Row gap={8} style={{ flexWrap: "nowrap" }}>
              <DomainIcon id={thisWeek.top.domain} size={18} />
              <T size={14} style={{ flex: 1 }}>가장 많이 본 분야 <T size={14} weight="bold">{thisWeek.top.name}</T> ({thisWeek.top.count}번)</T>
            </Row>
          )}
          {thisWeek.weak && (
            <Row gap={8} style={{ flexWrap: "nowrap" }}>
              <Icon name="target" size={18} />
              <T size={14} style={{ flex: 1 }}>더 볼 분야 <T size={14} weight="bold" color="accent">{thisWeek.weak.name}</T> (정답률 {thisWeek.weak.rate}%)</T>
            </Row>
          )}
          {!thisWeek.sessions && <T size={13} color="muted">이번 주에는 아직 공부한 주제가 없어요.</T>}
        </View>
      </Card>

      {/* 학습 캘린더 */}
      <SectionTitle title="학습 캘린더" right={<T size={13} color="muted">이번 달 {cal.studied}일 공부</T>} />
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="이전 달"><T size={22} weight="bold" color="ink2">‹</T></Pressable>
          <T size={16} weight="bold">{ym.y}년 {ym.m + 1}월</T>
          <Pressable onPress={() => !isThisMonth && move(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="다음 달" disabled={isThisMonth}>
            <T size={22} weight="bold" color={isThisMonth ? "muted" : "ink2"}>›</T>
          </Pressable>
        </Row>
        <View style={{ flexDirection: "row" }}>
          {DOW.map((d, i) => <T key={d} size={11} color={i === 0 ? "accent" : "muted"} center style={{ flex: 1 }}>{d}</T>)}
        </View>
        <View style={{ gap: 6 }}>
          {Array.from({ length: cal.cells.length / 7 }, (_, w) => (
            <View key={w} style={{ flexDirection: "row", gap: 6 }}>
              {cal.cells.slice(w * 7, w * 7 + 7).map((d, i) => (
                <View
                  key={d?.key ?? `e${w}-${i}`}
                  style={{
                    flex: 1, aspectRatio: 1, borderRadius: 8, alignItems: "center", justifyContent: "center",
                    backgroundColor: !d ? "transparent" : d.kept && !d.count ? c.gold + "55" : shade(d.count),
                    borderWidth: d?.today ? 2 : 0, borderColor: c.accent, opacity: d?.future ? 0.4 : 1,
                  }}
                >
                  {d && <T size={12} weight={d.count ? "bold" : "regular"} style={{ color: d.count >= 2 ? "#ffffff" : c.ink2 }}>{d.day}</T>}
                </View>
              ))}
            </View>
          ))}
        </View>
        <Row gap={6} style={{ justifyContent: "center" }}>
          <T size={11} color="muted">적게</T>
          {[0, 1, 2, 3].map((n) => <View key={n} style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: shade(n) }} />)}
          <T size={11} color="muted">많이</T>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: c.gold + "55", marginLeft: 8 }} />
          <T size={11} color="muted">보호권</T>
        </Row>
      </Card>
    </Screen>
  );
}
