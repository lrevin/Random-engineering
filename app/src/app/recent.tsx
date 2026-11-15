import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { DomainIcon, Icon } from "@/components/Icon";
import { Row, Screen, Segment, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { fmtDate } from "@/lib/stats";
import type { StudyRecord } from "@/lib/types";
import { radius, useColors } from "@/theme";

type Filter = "all" | "review";

/** 다시 볼 주제 기준: 정답률 60% 이하 */
const needsReview = (r: StudyRecord) => r.total > 0 && r.score / r.total <= 0.6;

/** 최근 공부한 주제: 한 줄씩 간단히 (누르면 기록 상세) */
export default function Recent() {
  const { records } = useApp();
  const c = useColors();
  const [filter, setFilter] = useState<Filter>("all");
  const list = useMemo(() => [...records].filter((r) => filter === "all" || needsReview(r)).reverse(), [records, filter]);
  const reviewCount = useMemo(() => records.filter(needsReview).length, [records]);

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">최근 공부한 주제</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        <Segment<Filter> value={filter} onChange={setFilter} options={[{ value: "all", label: "전체" }, { value: "review", label: `다시 볼 주제 ${reviewCount}` }]} />
        <T size={13} color="muted">{list.length}개</T>
      </Row>

      {list.length ? (
        <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper, overflow: "hidden" }}>
          {list.map((r, i) => {
            const ok = r.total > 0 && r.score / r.total > 0.6;
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/record/${r.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${r.topicKo}, ${r.score}점`}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14,
                  backgroundColor: pressed ? c.chip : c.paper, borderTopWidth: i ? 1 : 0, borderTopColor: c.line,
                })}
              >
                <DomainIcon id={r.domain} size={28} />
                <View style={{ flex: 1 }}>
                  <T size={15} weight="semibold" numberOfLines={1}>{r.topicKo}</T>
                  <T size={12} color="muted">{fmtDate(r.studiedAt)}</T>
                </View>
                <T size={15} weight="bold" style={{ color: ok ? c.success : c.accent }}>
                  {r.score}<T size={12} color="muted">/{r.total}</T>
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <T color="muted" center style={{ paddingVertical: 30 }}>
          {filter === "review" ? "6점 이하인 주제가 없어요. 잘하고 있어요!" : "아직 기록이 없어요."}
        </T>
      )}
    </Screen>
  );
}
