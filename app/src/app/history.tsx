import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn, Card, Row, Segment, T } from "@/components/ui";
import { ALL_CATEGORIES, domainById } from "@/data";
import { useApp } from "@/lib/app-state";
import { UserLevelBar, TierBadge } from "@/components/Rank";
import { domainMastery } from "@/lib/rank";
import { averageScore, calcStreak, fmtDate } from "@/lib/stats";
import type { StudyRecord } from "@/lib/types";
import { radius, raised, shadow, useColors } from "@/theme";
import { DomainIcon, Icon } from "@/components/Icon";
import { SectionTitle, StatGrid, StatTile } from "@/components/StatTile";

type Filter = "all" | "review";

/** 다시 볼 주제 기준: 정답률 60% 이하 */
const needsReview = (r: StudyRecord) => r.total > 0 && r.score / r.total <= 0.6;

function Score({ r }: { r: StudyRecord }) {
  const c = useColors();
  const ok = r.total > 0 && r.score / r.total > 0.6;
  return (
    <T size={15} weight="bold" style={{ color: ok ? c.success : c.accent }}>
      {r.score}<T size={12} color="muted">/{r.total}</T>
    </T>
  );
}

export default function History() {
  const { records, mode, xp, keptDays } = useApp();
  const c = useColors();
  const [filter, setFilter] = useState<Filter>("all");

  const { streak, today } = calcStreak(records, new Date(), keptDays);
  const avg = averageScore(records);
  const list = useMemo(
    () => [...records].filter((r) => filter === "all" || needsReview(r)).reverse(),
    [records, filter],
  );
  const bars = useMemo(() => {
    const counts = ALL_CATEGORIES.map((cat) => ({ ...cat, n: records.filter((r) => r.category === cat.id).length }));
    const max = Math.max(1, ...counts.map((x) => x.n));
    return { counts: counts.filter((x) => x.n > 0).sort((a, b) => b.n - a.n), max };
  }, [records]);

  const header = (
    <View style={{ gap: 14, paddingBottom: 10 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">공부 기록</T>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>

      {mode === "guest" && (
        <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent, gap: 8 }}>
          <T size={14} color="ink2">둘러보기 중이에요. 기록이 이 휴대폰에만 있어서 앱을 지우면 사라져요.</T>
          <Btn title="회원가입하고 기록 지키기" variant="accent" size="sm" onPress={() => router.push("/signup")} />
        </Card>
      )}

      <SectionTitle title="학습 현황" right={<Pressable onPress={() => router.push("/profile")} hitSlop={8}><T size={14} weight="semibold" color="accent">프로필 · 업적 ›</T></Pressable>} />
      <StatGrid>
        <StatTile icon={<Icon name="flame" size={30} />} value={`${streak}일`} label={streak && !today ? "연속 · 오늘 아직!" : "연속 공부"} dim={!streak} />
        <StatTile icon={<Icon name="calendar" size={30} />} value={`${records.length}회`} label="총 공부" />
        <StatTile icon={<Icon name="target" size={30} />} value={records.length ? `${avg.toFixed(1)}점` : "-"} label="평균 점수 (10점)" />
        <StatTile icon={<Icon name="bolt" size={30} />} value={`${xp.toLocaleString()}`} label="누적 XP" />
      </StatGrid>

      <Pressable onPress={() => router.push("/report")} accessibilityRole="button">
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="calendar" size={34} />
          <View style={{ flex: 1 }}>
            <T size={16} weight="bold">학습 리포트</T>
            <T size={13} color="muted">이번 주 요약 · 학습 캘린더</T>
          </View>
          <T size={18} color="muted">›</T>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push("/review")} accessibilityRole="button">
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="target" size={34} />
          <View style={{ flex: 1 }}>
            <T size={16} weight="bold">오답 다시 풀기</T>
            <T size={13} color="muted">틀린 문제를 변형 문제로 다시 풀어요</T>
          </View>
          <Icon name="crown" size={22} />
          <T size={18} color="muted">›</T>
        </Card>
      </Pressable>

      <Card style={{ gap: 6 }}>
        <T size={14} weight="semibold" color="ink2">내 레벨</T>
        <UserLevelBar xp={xp} />
      </Card>

      {bars.counts.length > 0 && (
        <Card style={{ gap: 8 }}>
          <T size={14} weight="semibold" color="ink2">분야별 횟수</T>
          {bars.counts.map((b) => (
            <Row key={b.id} gap={10} style={{ flexWrap: "nowrap" }}>
              <Row gap={6} style={{ width: 118, flexWrap: "nowrap" }}>
                <DomainIcon id={b.domain} size={20} />
                <T size={13} numberOfLines={1} style={{ flex: 1 }}>{b.name}</T>
              </Row>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
                <View style={{ width: `${(b.n / bars.max) * 100}%`, height: "100%", backgroundColor: b.id === "sec" ? c.accent : c.navy, borderRadius: 5 }} />
              </View>
              <T size={13} color="ink2" style={{ width: 24, textAlign: "right" }}>{b.n}</T>
            </Row>
          ))}
        </Card>
      )}

      <Row style={{ justifyContent: "space-between" }}>
        <Segment<Filter> value={filter} onChange={setFilter} options={[{ value: "all", label: "전체" }, { value: "review", label: "다시 볼 주제 (6점↓)" }]} />
        <T size={13} color="muted">{list.length}개</T>
      </Row>
    </View>
  );

  const item = ({ item: r }: { item: StudyRecord }) => (
    <Pressable
      onPress={() => router.push(`/record/${r.id}`)}
      style={({ pressed }) => ({
        backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: 14, marginBottom: 10,
        ...raised(c.paperEdge, pressed, 4), ...(!pressed ? shadow(c, 1) : null),
      })}
    >
      <View style={{ gap: 2 }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <T size={16} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{r.topicKo}</T>
          <Score r={r} />
        </Row>
        <T size={13} color="muted">
          {fmtDate(r.studiedAt)} · {ALL_CATEGORIES.find((x) => x.id === r.category)?.name ?? r.category} · +{r.rp} XP
          {!r.synced && mode === "user" ? " · 동기화 대기" : ""}
        </T>
        <Row gap={6}>
          <TierBadge index={domainMastery(r.domain, records).index} prefix={domainById(r.domain)?.name} size="sm" />
        </Row>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        renderItem={item}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 20, maxWidth: 640, width: "100%", alignSelf: "center" }}
        ListEmptyComponent={
          <T color="muted" center style={{ paddingVertical: 30 }}>
            {filter === "review" ? "퀴즈 6점 이하인 주제가 없어요. 잘하고 있어요!" : "아직 기록이 없어요.\n공부 탭에서 첫 주제를 뽑아 보세요."}
          </T>
        }
      />
    </SafeAreaView>
  );
}
