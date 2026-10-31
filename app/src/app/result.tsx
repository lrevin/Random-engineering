import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LevelBadge, TierBadge, UserLevelBar } from "@/components/Rank";
import { Btn, Card, Row, Screen, T } from "@/components/ui";
import { topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { TIERS, TOPIC_TIER_MIN, topicMastery, totalRp } from "@/lib/rank";
import { useColors } from "@/theme";

const scoreMessage = (score: number, total: number) => {
  const p = total ? score / total : 0;
  if (p === 1) return "완벽해요! 이 주제는 확실히 알고 있어요 🎉";
  if (p >= 0.8) return "아주 잘했어요! 거의 다 알고 있어요";
  if (p >= 0.6) return "좋아요. 틀린 문제만 한 번 더 보면 돼요";
  if (p >= 0.4) return "절반 정도 이해했어요. 다시 공부해 볼까요?";
  return "어려운 주제였네요. 다음에 한 번 더 도전해요";
};

export default function Result() {
  const { active } = useApp();
  // 화면에 들어올 때의 결과를 고정 (완료를 누르면 active가 비워짐)
  const [snapshot] = useState(active);
  if (!snapshot || snapshot.stage !== "result" || !snapshot.result) return <Redirect href="/" />;
  return <ResultInner snapshot={snapshot} />;
}

function ResultInner({ snapshot }: { snapshot: NonNullable<ReturnType<typeof useApp>["active"]> }) {
  const { records, setActive } = useApp();
  const c = useColors();
  const r = snapshot.result!;
  const topic = topicById(snapshot.topicId);
  const mastery = topicMastery(snapshot.topicId, records);
  const levelUp = (r.userLevelAfter ?? 0) > (r.userLevelBefore ?? 0);
  const topicUp = r.topicTierAfter > r.topicTierBefore;
  const pct = r.total ? r.score / r.total : 0;

  const done = (to: "/home" | "/history") => {
    setActive(null);
    router.replace(to);
  };
  const retry = () => {
    setActive({ ...snapshot, stage: "quiz", quizOnly: true, quiz: null, result: null, studyUsed: 0, endAt: null, startedAt: new Date().toISOString() });
    router.replace("/quiz");
  };

  return (
    <Screen scroll>
      {levelUp && (
        <Card style={{ backgroundColor: c.goldSoft, borderColor: c.gold, alignItems: "center", gap: 8 }}>
          <LevelBadge level={r.userLevelAfter} size="lg" />
          <T size={20} weight="bold" center>레벨 업! {r.userLevelAfter}레벨 달성</T>
        </Card>
      )}

      <View style={{ alignItems: "center", gap: 6, marginTop: 8 }}>
        <T size={15} color="muted">{topic?.ko ?? snapshot.topicId}</T>
        <T size={64} weight="bold" style={{ lineHeight: 74, color: pct >= 0.6 ? c.success : c.accent }}>
          {r.score}<T size={30} color="muted"> / {r.total}</T>
        </T>
        <T size={16} color="ink2" center>{scoreMessage(r.score, r.total)}</T>
        {r.streak > 0 && <T size={15} weight="semibold" color="flame">🔥 {r.streak}일 연속 공부</T>}
      </View>

      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={16} weight="bold">획득 경험치</T>
          <T size={22} weight="bold" color="accent">+{r.rp} XP</T>
        </Row>
        {r.parts.filter((p) => p.value > 0).map((p) => (
          <Row key={p.label} style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <T size={13} color="muted" style={{ flex: 1 }}>{p.label}</T>
            <T size={13} color="ink2">+{p.value}</T>
          </Row>
        ))}
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 4 }} />
        <T size={13} weight="semibold" color="ink2">내 레벨</T>
        <UserLevelBar xp={totalRp(records)} />
      </Card>

      <Card style={{ gap: 8 }}>
        <Row gap={8}>
          <T size={16} weight="bold">[{topic?.categoryName ?? "주제"}]</T>
          <TierBadge index={r.topicTierAfter} />
        </Row>
        <T size={13} color="ink2">{topic?.ko ?? snapshot.topicId}</T>
        {topicUp && r.topicTierBefore >= 0 && (
          <T size={14} color="success" weight="semibold">{TIERS[r.topicTierBefore].name} → {TIERS[r.topicTierAfter].name} 승급!</T>
        )}
        <T size={13} color="muted">
          누적 정답 {mastery.points}개 · {mastery.attempts}번 풂
          {mastery.next !== null ? ` · 다음 단계까지 ${Math.max(0, mastery.next - mastery.points)}개` : ""}
          {mastery.index === TIERS.length - 2 && mastery.points >= TOPIC_TIER_MIN[TIERS.length - 1] && !mastery.perfect ? " · 엔지니어는 만점 1회 필요" : ""}
        </T>
      </Card>

      {r.score < r.total && (
        <Btn
          title={`오답 문제 보러 가기 (${r.total - r.score}개)`}
          variant="accent"
          onPress={() => {
            // 이전 버전에서 저장된 결과에는 기록 id가 없으므로 그 주제의 최근 기록을 사용
            const id = r.recordId ?? [...records].reverse().find((x) => x.topicId === snapshot.topicId)?.id;
            if (id) router.push(`/wrong/${id}`);
          }}
        />
      )}

      <View style={{ gap: 8 }}>
        <Btn title="완료" variant="primary" size="lg" onPress={() => done("/home")} />
        <Row style={{ flexWrap: "nowrap" }}>
          <Btn title="퀴즈 다시 풀기" onPress={retry} style={{ flex: 1 }} />
          <Btn title="기록 보기" onPress={() => done("/history")} style={{ flex: 1 }} />
        </Row>
      </View>
    </Screen>
  );
}
