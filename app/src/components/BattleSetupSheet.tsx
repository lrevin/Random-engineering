import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { DOMAINS, TOPICS } from "@/data";
import { useApp } from "@/lib/app-state";
import { BATTLE_MINUTES, FREE_BATTLE_TICKETS } from "@/lib/economy";
import { loadQuiz } from "@/lib/quiz";
import { createBattle, socialMessage, type Friend } from "@/lib/social";
import { radius, shadow, useColors } from "@/theme";
import { Btn, Chip, Row, Segment, T } from "./ui";

/**
 * 친구에게 1:1 분야 배틀 신청: 분야와 공부 시간을 고르면 그 분야에서 주제를 하나 뽑고
 * 같은 퀴즈 7문제를 만들어 서버에 올립니다. 주제는 시작하는 순간 두 사람에게 동시에 공개됩니다.
 */
export function BattleSetupSheet({ friend, onClose }: { friend: Friend | null; onClose: () => void }) {
  const { premium, battleTickets, spendBattleTicket, refundBattleTicket } = useApp();
  const c = useColors();
  const [domain, setDomain] = useState("it");
  const [minutes, setMinutes] = useState<string>("10");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  if (!friend) return null;
  const noTicket = !premium && battleTickets <= 0;

  const send = async () => {
    if (sending) return;
    setErr("");
    const pool = TOPICS.filter((t) => t.domain === domain);
    if (!pool.length) return setErr("이 분야에는 아직 주제가 없어요.");
    if (!spendBattleTicket()) return setErr("배틀권이 없어요. 다음 달 1일에 다시 채워져요.");
    setSending(true);
    try {
      const topic = pool[Math.floor(Math.random() * pool.length)];
      const quiz = await loadQuiz(topic);
      const battle = await createBattle({
        opponentUid: friend.uid, domain, topicId: topic.id, studySec: Number(minutes) * 60,
        questions: quiz.questions,
      });
      onClose();
      router.push({ pathname: "/battle", params: { id: battle.id } });
    } catch (e) {
      refundBattleTicket();
      setErr(socialMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.45)" }} onPress={onClose} accessibilityLabel="닫기" />
      <View style={{ backgroundColor: c.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20, gap: 14, maxHeight: "85%", ...shadow(c, 3) }}>
        <T size={21} weight="bold">⚔️ {friend.nickname}님에게 배틀 신청</T>
        <T size={14} color="ink2">
          상대가 수락하면 두 사람에게 같은 주제가 동시에 뽑히고, 같은 시간 동안 공부한 뒤 같은 7문제를 풀어요.
          점수가 높은 사람이 진 사람 경험치의 5%(최대 100 XP)를 가져가요. 배틀 중에는 시간 추가가 안 돼요.
        </T>

        <T size={14} weight="semibold" color="ink2">분야</T>
        <ScrollView style={{ maxHeight: 190 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DOMAINS.filter((d) => d.available).map((d) => (
            <Chip key={d.id} label={`${d.emoji} ${d.name}`} selected={domain === d.id} onPress={() => setDomain(d.id)} />
          ))}
        </ScrollView>

        <Row style={{ justifyContent: "space-between" }}>
          <T size={14} weight="semibold" color="ink2">공부 시간</T>
          <Segment
            options={BATTLE_MINUTES.map((m) => ({ value: String(m), label: `${m}분` }))}
            value={minutes}
            onChange={setMinutes}
          />
        </Row>

        <View style={{ backgroundColor: c.chip, borderRadius: radius.md, padding: 12 }}>
          <T size={14} color="ink2">
            {premium ? "유료 버전이라 배틀권 걱정 없이 신청할 수 있어요." : `배틀권 1개를 써요 (남은 배틀권 ${battleTickets} / ${FREE_BATTLE_TICKETS}). 상대가 거절하면 돌려받아요.`}
          </T>
        </View>
        {err ? <T size={14} color="accent">{err}</T> : null}
        {noTicket ? (
          <Btn title="유료 버전 알아보기" variant="primary" size="lg" onPress={() => { onClose(); router.push("/shop"); }} />
        ) : (
          <Btn title={sending ? "문제 준비하는 중…" : "배틀 신청하기"} variant="accent" size="lg" loading={sending} onPress={send} />
        )}
        <Btn title="닫기" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}
