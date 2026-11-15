import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { TierBadge } from "@/components/Rank";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, Card, Field, levelTone, Row, Screen, T } from "@/components/ui";
import { domainById, levelText, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { studyMinutesFor } from "@/lib/economy";
import { prefetchQuiz } from "@/lib/quiz";
import { domainMastery } from "@/lib/rank";
import { fmtDate, fmtDuration } from "@/lib/stats";
import { useColors } from "@/theme";

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, removeRecord, active, setActive, prefs, premium, updateRecordMemo } = useApp();
  const c = useColors();
  const [draft,setDraft]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
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
  const mastery = domainMastery(r.domain, records);

  const del = () => {
    const run = async () => {
      try {
        await removeRecord(r.id);
        router.back();
      } catch {
        showDialog({ icon: "offline", title: "삭제하지 못했어요", message: "인터넷 연결을 확인하고 다시 시도해 주세요." });
      }
    };
    showDialog({
      icon: "trash",
      title: "기록을 삭제할까요?",
      message: `"${r.topicKo}" 기록이 지워지고 되돌릴 수 없어요.`,
      buttons: [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: run }],
    });
  };

  /** 이 주제를 처음부터 다시 공부 → 퀴즈 (전에 틀린 문제는 빼고 새 문제 위주로) */
  const restudy = () => {
    if (!topic) return;
    if (active) {
      showDialog({ icon: "hourglass", title: "진행 중인 주제가 있어요", message: "먼저 끝내거나 그만둔 뒤 다시 공부할 수 있어요." });
      return;
    }
    const seen = records.filter((x) => x.topicId === topic.id).flatMap((x) => x.wrong.map((w) => w.q));
    const min = studyMinutesFor(prefs.studyMinutes, premium);
    prefetchQuiz(topic, seen);
    setActive({
      topicId: topic.id, stage: "study", memo: "",
      studyTotal: min * 60, studyLeft: min * 60, studyUsed: 0,
      quizOnly: false, quiz: null, result: null, startedAt: new Date().toISOString(), endAt: null,
    });
    router.dismissAll();
    router.push("/study");
  };

  /** 공부 없이 이 주제 퀴즈만 다시 풀기 (주제 숙련 랭크 올리기) */
  const retryQuiz = () => {
    if (!topic) return;
    if (active) {
      showDialog({ icon: "hourglass", title: "진행 중인 주제가 있어요", message: "먼저 끝내거나 그만둔 뒤 다시 풀 수 있어요." });
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
          <TierBadge index={mastery.index} prefix={domainById(r.domain)?.name} size="sm" />
        </Row>
        <T size={26} weight="bold">{r.topicKo}</T>
        <T size={14} color="muted">
          {fmtDate(r.studiedAt)} · {r.studySec ? `공부 ${fmtDuration(r.studySec)}` : "퀴즈만 풂"} · {r.rp >= 0 ? "+" : ""}{r.rp} XP
          {r.quizSource === "offline" ? " · 오프라인 연습 퀴즈" : ""}
        </T>
        <T size={40} weight="bold" style={{ lineHeight: 50, color: ok ? c.success : c.accent }}>
          {r.score}<T size={20} color="muted"> / {r.total}</T>
        </T>
      </View>

      <Card style={{ gap: 6 }}>
        <T size={13} weight="semibold" color="muted">공부 메모</T>
        {<>
          <Field label="메모 내용" multiline maxLength={5000} value={draft??r.memo} onChangeText={setDraft}/>
          <Btn title="메모 저장" loading={saving} onPress={async()=>{setSaving(true);try{await updateRecordMemo(r.id,draft??r.memo);setDraft(null);}catch{showDialog({title:"저장하지 못했어요",message:"다시 시도해 주세요."});}finally{setSaving(false);}}}/>
          {r.memoPending&&<T size={13} color="muted">기기에 저장됨 · 연결되면 서버에 반영해요.</T>}
          {r.memoConflict&&<>
            <T color="accent">다른 기기에서 메모가 변경됐어요. 사용할 내용을 선택해 주세요.</T>
            <T>{r.memoConflict.memo}</T>
            <Btn title="서버 메모 사용" onPress={()=>{setDraft(null);updateRecordMemo(r.id,r.memo,"server");}}/>
            <Btn title="내 메모로 다시 저장" onPress={()=>{setDraft(null);updateRecordMemo(r.id,draft??r.memo,"local");}}/>
          </>}
        </>}
        {!r.synced&&<T size={13} color="muted">{r.syncError==="incomplete_record"?"전체 답안이 없는 이전 기록은 기기에만 보관해요.":"아직 서버에 반영되지 않은 기록이에요. XP는 임시 값이에요."}</T>}
      </Card>

      {r.studyType === "battle" && <Card style={{gap:8}}>
        <T weight="bold">배틀 풀이 기록</T>
        <T>본 문제 정답 {r.rankScore ?? 0} / 5 · {r.countsAsStudy === false ? "학습 실적 제외" : "분야 랭크·학습일 반영"}</T>
        <T color="muted">승패와 XP 정산이 연결되어 있어 배틀 기록은 개별 삭제할 수 없어요.</T>
        {r.items?.map((item,i)=><View key={i} style={{gap:4}}>
          <T weight="semibold">{i+1}. {item.stage === "overtime" ? "[연장전] " : ""}{item.question.q}</T>
          <T size={14}>내 답: {item.answer === null ? "미응답" : item.question.type === "mc" ? item.question.choices[item.answer as number] : item.answer ? "O" : "X"}</T>
          <T size={14}>정답: {item.question.type === "mc" ? item.question.choices[item.question.answer] : item.question.answer ? "O" : "X"}</T>
          <T size={14} color="muted">{item.question.explain}</T>
        </View>)}
      </Card>}
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
        {topic && <Btn title="이 주제 공부 다시 하기" variant="accent" icon={<Icon name="book" size={22} />} onPress={restudy} />}
        {topic && !ok && <T size={12} color="muted" center>다시 공부하고 나면 전에 틀린 문제는 빼고 새 문제로 퀴즈를 풀어요.</T>}
        {topic && <Btn title="공부 없이 퀴즈만 다시 풀기" onPress={retryQuiz} />}
        <Btn title="닫기" variant="primary" onPress={() => router.back()} />
        {r.studyType !== "battle" && <Btn title="이 기록 삭제" variant="ghost" onPress={del} />}
      </View>
    </Screen>
  );
}
