import { router, useLocalSearchParams } from "expo-router";
import { Alert, Platform, View } from "react-native";
import { TierBadge } from "@/components/Rank";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, Card, levelTone, Row, Screen, T } from "@/components/ui";
import { levelText, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { topicMastery } from "@/lib/rank";
import { fmtDate, fmtDuration } from "@/lib/stats";
import { useColors } from "@/theme";

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, removeRecord, active, setActive } = useApp();
  const c = useColors();
  const r = records.find((x) => x.id === id);
  if (!r) {
    return (
      <Screen>
        <T color="muted">기록을 찾을 수 없어요.</T>
        <Btn title="닫기" onPress={() => router.back()} />
      </Screen>
    );
  }
  const topic = topicById(r.topicId);
  const mastery = topicMastery(r.topicId, records);

  const del = () => {
    const run = async () => {
      try {
        await removeRecord(r.id);
        router.back();
      } catch {
        Alert.alert("삭제하지 못했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      }
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`"${r.topicKo}" 기록을 삭제할까요?`)) run();
      return;
    }
    Alert.alert("기록 삭제", `"${r.topicKo}" 기록을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: run },
    ]);
  };

  /** 공부 없이 이 주제 퀴즈만 다시 풀기 (주제 숙련 랭크 올리기) */
  const retryQuiz = () => {
    if (!topic) return;
    if (active) {
      Alert.alert("진행 중인 주제가 있어요", "먼저 끝내거나 그만둔 뒤 다시 풀 수 있어요.");
      return;
    }
    setActive({
      topicId: topic.id, stage: "quiz", memo: "", studyTotal: 0, studyLeft: 0, studyUsed: 0,
      quizOnly: true, quiz: null, result: null, startedAt: new Date().toISOString(), endAt: null,
    });
    router.replace("/quiz");
  };

  const ok = r.total > 0 && r.score / r.total > 0.6;

  return (
    <Screen scroll>
      <View style={{ gap: 6 }}>
        <Row gap={6}>
          <Badge label={topic?.categoryName ?? r.category} />
          <Badge label={levelText(r.level)} tone={levelTone(r.level)} />
          <TierBadge index={mastery.index} size="sm" />
        </Row>
        <T size={26} weight="bold">{r.topicKo}</T>
        <T size={14} color="muted">
          {fmtDate(r.studiedAt)} · {r.studySec ? `공부 ${fmtDuration(r.studySec)}` : "퀴즈만 풂"} · +{r.rp} RP
          {r.quizSource === "offline" ? " · 오프라인 연습 퀴즈" : ""}
        </T>
        <T size={40} weight="bold" style={{ lineHeight: 50, color: ok ? c.success : c.accent }}>
          {r.score}<T size={20} color="muted"> / {r.total}</T>
        </T>
      </View>

      <Card style={{ gap: 6 }}>
        <T size={13} weight="semibold" color="muted">공부 메모</T>
        <T size={16} color={r.memo ? "ink" : "muted"}>{r.memo || "-"}</T>
      </Card>

      {r.wrong.length > 0 && (
        <Card style={{ gap: 12 }}>
          <T size={15} weight="bold">틀린 문제 {r.wrong.length}개</T>
          {r.wrong.map((w, i) => (
            <View key={i} style={{ gap: 3 }}>
              <T size={14} weight="semibold">{w.q}</T>
              <T size={13} color="success">정답: {w.answer}</T>
              <T size={13} color="muted">{w.explain}</T>
            </View>
          ))}
        </Card>
      )}

      {topic && (
        <View style={{ gap: 8 }}>
          <T size={14} weight="semibold" color="ink2">다시 찾아보기</T>
          <TopicLinks topic={topic} />
        </View>
      )}

      <View style={{ gap: 8, marginTop: 8 }}>
        {topic && <Btn title="이 주제 퀴즈 다시 풀기" variant="accent" onPress={retryQuiz} />}
        <Btn title="닫기" variant="primary" onPress={() => router.back()} />
        <Btn title="이 기록 삭제" variant="ghost" onPress={del} />
      </View>
    </Screen>
  );
}
