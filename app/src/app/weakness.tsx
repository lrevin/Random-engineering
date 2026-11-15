import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, DomainIcon } from "@/components/Icon";
import { showDialog } from "@/components/Dialog";
import { SectionTitle } from "@/components/StatTile";
import { Card, Row, T } from "@/components/ui";
import { topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { prefetchQuiz } from "@/lib/quiz";
import { studyMinutesFor } from "@/lib/economy";
import { domainWeakness, topicWeakness } from "@/lib/weakness";
import { radius, useColors } from "@/theme";

const pct = (a: number): `${number}%` => `${Math.round(a * 100)}%`;
const barColor = (a: number, c: ReturnType<typeof useColors>) => (a < 0.5 ? c.accent : a < 0.8 ? c.gold : c.success);

export default function Weakness() {
  const { records, active, setActive, premium, prefs } = useApp();
  const c = useColors();

  const domains = useMemo(() => domainWeakness(records), [records]);
  const topics = useMemo(() => topicWeakness(records, 1).slice(0, 8), [records]);

  const retry = (topicId: string) => {
    const t = topicById(topicId);
    if (!t) return;
    if (active) {
      showDialog({ icon: "hourglass", title: "진행 중인 주제가 있어요", message: "먼저 끝내거나 그만둔 뒤 시작할 수 있어요." });
      return;
    }
    const min = studyMinutesFor(prefs.studyMinutes, premium);
    prefetchQuiz(t);
    setActive({
      topicId: t.id, stage: "study", memo: "",
      studyTotal: min * 60, studyLeft: min * 60, studyUsed: 0,
      quizOnly: false, quiz: null, result: null, startedAt: new Date().toISOString(), endAt: null,
    });
    router.replace("/study");
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 640, width: "100%", alignSelf: "center", gap: 14 }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <T size={26} weight="bold">약점 분석</T>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={24} color={c.muted} />
          </Pressable>
        </Row>
        <T size={13} color="muted">지금까지 푼 퀴즈를 분야·주제별로 모아 정답률이 낮은 곳부터 보여줘요.</T>

        {domains.length === 0 ? (
          <Card><T size={14} color="muted">아직 분석할 기록이 없어요. 퀴즈를 몇 번 풀면 여기에 나와요.</T></Card>
        ) : (
          <>
            <SectionTitle title="분야별 정답률" />
            <Card style={{ gap: 10 }}>
              {domains.map((d) => (
                <Row key={d.domain} gap={10} style={{ flexWrap: "nowrap" }}>
                  <Row gap={6} style={{ width: 118, flexWrap: "nowrap" }}>
                    <DomainIcon id={d.domain} size={20} />
                    <T size={13} numberOfLines={1} style={{ flex: 1 }}>{d.name}</T>
                  </Row>
                  <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
                    <View style={{ width: pct(d.accuracy), height: "100%", backgroundColor: barColor(d.accuracy, c), borderRadius: 5 }} />
                  </View>
                  <T size={13} color="ink2" style={{ width: 70, textAlign: "right" }}>{pct(d.accuracy)} · {d.attempts}회</T>
                </Row>
              ))}
            </Card>

            <SectionTitle title="가장 약한 주제" />
            <Card style={{ gap: 10 }}>
              {topics.length === 0 ? (
                <T size={14} color="muted">주제별 데이터가 더 쌓이면 보여드려요.</T>
              ) : (
                topics.map((t) => (
                  <Row key={t.topicId} gap={10} style={{ flexWrap: "nowrap", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <T size={14} weight="semibold" numberOfLines={1}>{t.name}</T>
                      <T size={12} color="muted">{t.domainName} · {pct(t.accuracy)} 정답 · {t.attempts}회</T>
                    </View>
                    <Pressable onPress={() => retry(t.topicId)} style={{ borderRadius: radius.sm, borderWidth: 2, borderColor: c.line, paddingHorizontal: 12, paddingVertical: 8 }} accessibilityRole="button">
                      <T size={13} weight="semibold" color="accent">다시 풀기</T>
                    </Pressable>
                  </Row>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
