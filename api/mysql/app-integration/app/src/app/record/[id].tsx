import { useState } from "react";
import { AUTH_PROVIDER } from "@/lib/auth";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Platform, View } from "react-native";
import { TierBadge } from "@/components/Rank";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, Card, Field, levelTone, Row, Screen, T } from "@/components/ui";
import { levelText, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { topicMastery } from "@/lib/rank";
import { fmtDate, fmtDuration } from "@/lib/stats";
import { useColors } from "@/theme";

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, removeRecord, active, setActive, updateRecordMemo } = useApp();
  const c = useColors();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
          {fmtDate(r.studiedAt)} · {r.studySec ? `공부 ${fmtDuration(r.studySec)}` : "퀴즈만 풂"} · +{r.rp} XP
          {r.quizSource === "offline" ? " · 오프라인 연습 퀴즈" : ""}
        </T>
        <T size={40} weight="bold" style={{ lineHeight: 50, color: ok ? c.success : c.accent }}>
          {r.score}<T size={20} color="muted"> / {r.total}</T>
        </T>
      </View>

      <Card style={{ gap: 6 }}>
        <T size={13} weight="semibold" color="muted">공부 메모</T>
        {AUTH_PROVIDER === "mysql" ? <>
          <Field label="메모 내용" multiline maxLength={5000} value={draft ?? r.memo} onChangeText={setDraft} />
          <Btn title={saving ? "저장 중…" : "메모 저장"} disabled={saving} onPress={async () => {
            setSaving(true);
            try { await updateRecordMemo(r.id, draft ?? r.memo); setDraft(null); }
            catch { Alert.alert("저장하지 못했어요", "다시 시도해 주세요."); }
            finally { setSaving(false); }
          }} />
          {r.memoPending && <T size={13} color="muted">기기에 저장됨 · 연결되면 서버에 반영해요.</T>}
          {r.memoConflict && <>
            <T size={13} color="accent">다른 기기에서 메모가 바뀌었어요. 저장할 내용을 선택해 주세요.</T>
            <T>{r.memoConflict.memo}</T>
            <Btn title="서버 메모 사용" onPress={() => { setDraft(null); updateRecordMemo(r.id, r.memo, "server"); }} />
            <Btn title="내 메모로 다시 저장" onPress={() => { setDraft(null); updateRecordMemo(r.id, draft ?? r.memo, "local"); }} />
          </>}
        </> : <T size={16} color={r.memo ? "ink" : "muted"}>{r.memo || "-"}</T>}
        {!r.synced && AUTH_PROVIDER === "mysql" && <T size={13} color="muted">{r.syncError === "incomplete_record" ? "이전 기록은 전체 답안이 없어 기기에만 보관해요." : "아직 서버에 반영되지 않은 기록이에요. XP는 임시 값이에요."}</T>}
      </Card>

      {r.wrong.length > 0 && (
        <Btn title={`오답 문제 보러 가기 (${r.wrong.length}개)`} onPress={() => router.push(`/wrong/${r.id}`)} />
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
