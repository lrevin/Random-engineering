import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn, Card, Row, Segment, T } from "@/components/ui";
import { ALL_CATEGORIES } from "@/data";
import { useApp } from "@/lib/app-state";
import { averageRating, calcStreak, fmtDate } from "@/lib/stats";
import type { StudyRecord } from "@/lib/types";
import { radius, useColors } from "@/theme";

type Filter = "all" | "review";

function Stars({ n }: { n: number }) {
  const c = useColors();
  return (
    <T size={14} style={{ letterSpacing: 1 }}>
      <T size={14} style={{ color: c.accent }}>{"★".repeat(n)}</T>
      <T size={14} style={{ color: c.line2 }}>{"★".repeat(5 - n)}</T>
    </T>
  );
}

export default function History() {
  const { records, mode } = useApp();
  const c = useColors();
  const [filter, setFilter] = useState<Filter>("all");

  const { streak, today } = calcStreak(records);
  const avg = averageRating(records);
  const list = useMemo(
    () => [...records].filter((r) => filter === "all" || r.rating <= 2).reverse(),
    [records, filter],
  );
  const bars = useMemo(() => {
    const counts = ALL_CATEGORIES.map((cat) => ({ ...cat, n: records.filter((r) => r.category === cat.id).length }));
    const max = Math.max(1, ...counts.map((x) => x.n));
    return { counts: counts.filter((x) => x.n > 0).sort((a, b) => b.n - a.n), max };
  }, [records]);

  const header = (
    <View style={{ gap: 14, paddingBottom: 10 }}>
      <T size={26} weight="bold">공부 기록</T>

      {mode === "guest" && (
        <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent, gap: 8 }}>
          <T size={14} color="ink2">둘러보기 중이에요. 기록이 이 휴대폰에만 있어서 앱을 지우면 사라져요.</T>
          <Btn title="회원가입하고 기록 지키기" variant="accent" size="sm" onPress={() => router.push("/signup")} />
        </Card>
      )}

      <Row gap={10} style={{ flexWrap: "nowrap" }}>
        {[
          { v: `${records.length}`, u: "회", l: "총 공부" },
          { v: `${streak}`, u: "일", l: streak && !today ? "연속 · 오늘 아직!" : "연속 공부" },
          { v: records.length ? avg.toFixed(1) : "-", u: records.length ? "점" : "", l: "평균 별점" },
        ].map((t) => (
          <Card key={t.l} style={{ flex: 1, padding: 12 }}>
            <T size={26} weight="bold">{t.v}<T size={14} color="ink2"> {t.u}</T></T>
            <T size={12} color="muted">{t.l}</T>
          </Card>
        ))}
      </Row>

      {bars.counts.length > 0 && (
        <Card style={{ gap: 8 }}>
          <T size={14} weight="semibold" color="ink2">분야별 횟수</T>
          {bars.counts.map((b) => (
            <Row key={b.id} gap={10} style={{ flexWrap: "nowrap" }}>
              <T size={13} style={{ width: 96 }} numberOfLines={1}>{b.emoji} {b.name}</T>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
                <View style={{ width: `${(b.n / bars.max) * 100}%`, height: "100%", backgroundColor: b.id === "sec" ? c.accent : c.navy, borderRadius: 5 }} />
              </View>
              <T size={13} color="ink2" style={{ width: 24, textAlign: "right" }}>{b.n}</T>
            </Row>
          ))}
        </Card>
      )}

      <Row style={{ justifyContent: "space-between" }}>
        <Segment<Filter> value={filter} onChange={setFilter} options={[{ value: "all", label: "전체" }, { value: "review", label: "다시 볼 주제 ★2↓" }]} />
        <T size={13} color="muted">{list.length}개</T>
      </Row>
    </View>
  );

  const item = ({ item: r }: { item: StudyRecord }) => (
    <Pressable onPress={() => router.push(`/record/${r.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={{ backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: 14, marginBottom: 8, gap: 2 }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <T size={16} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{r.topicKo}</T>
          <Stars n={r.rating} />
        </Row>
        <T size={13} color="muted">
          {fmtDate(r.studiedAt)} · {ALL_CATEGORIES.find((x) => x.id === r.category)?.name ?? r.category}
          {!r.synced && mode === "user" ? " · 동기화 대기" : ""}
        </T>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        renderItem={item}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 20, maxWidth: 640, width: "100%", alignSelf: "center" }}
        ListEmptyComponent={
          <T color="muted" center style={{ paddingVertical: 30 }}>
            {filter === "review" ? "별점 2점 이하인 주제가 없어요. 잘하고 있어요!" : "아직 기록이 없어요.\n공부 탭에서 첫 주제를 뽑아 보세요."}
          </T>
        }
      />
    </SafeAreaView>
  );
}
