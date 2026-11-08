import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { BattleSetupSheet } from "@/components/BattleSetupSheet";
import { LevelBadge } from "@/components/Rank";
import { Btn, Card, Row, Screen, T } from "@/components/ui";
import { domainById } from "@/data";
import { useApp } from "@/lib/app-state";
import { BATTLE_XP_MAX, FREE_BATTLE_TICKETS } from "@/lib/economy";
import {
  acceptBattle, declineBattle, getFriends, getInbox, socialEnabled, socialMessage,
  type Battle, type Friend,
} from "@/lib/social";
import { fmtStudyTime } from "@/lib/stats";
import { radius, useColors } from "@/theme";

/** 배틀 메뉴: 배틀권 · 받은 신청 · 진행 중인 배틀 · 친구에게 배틀 신청 */
export default function Arena() {
  const { premium, battleTickets, records } = useApp();
  const c = useColors();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Battle[]>([]);
  const [current, setCurrent] = useState<Battle | null>(null);
  const [target, setTarget] = useState<Friend | null>(null);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(() => {
    if (!socialEnabled) return;
    Promise.all([getFriends(), getInbox()])
      .then(([f, inbox]) => {
        setFriends(f.friends);
        setIncoming(inbox.incoming);
        setCurrent(inbox.current);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);

  // 이 탭을 보는 동안 5초마다 새로고침
  useFocusEffect(useCallback(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]));

  const answer = async (b: Battle, accept: boolean) => {
    setNotice("");
    try {
      const next = await (accept ? acceptBattle(b.id) : declineBattle(b.id));
      if (accept) router.push({ pathname: "/battle", params: { id: next.id } });
      else refresh();
    } catch (e) {
      setNotice(socialMessage(e));
    }
  };

  // 최근 배틀 기록 (배틀은 메모가 '⚔️ …님과 배틀'로 남음)
  const recent = records.filter((r) => r.memo.startsWith("⚔️")).slice(-5).reverse();

  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">배틀</T>

      {/* 배틀권 · 멤버십 */}
      <Pressable onPress={() => router.push("/shop")} accessibilityRole="button" accessibilityLabel="배틀권과 멤버십 보기">
        <Card style={{ gap: 6 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T size={16} weight="bold">⚔️ 남은 배틀권</T>
            <T size={20} weight="bold" color="accent">{premium ? "무제한" : `${battleTickets} / ${FREE_BATTLE_TICKETS}`}</T>
          </Row>
          <T size={13} color="muted">
            {premium ? "유료 멤버십 사용 중이에요." : `무료 버전은 매월 1일 00시에 ${FREE_BATTLE_TICKETS}회로 다시 채워져요. 유료 멤버십은 무제한 ›`}
          </T>
        </Card>
      </Pressable>

      {!socialEnabled ? (
        <Card><T size={15} color="ink2">배틀 서버가 아직 연결되지 않았어요. (개발용: app/.env.local 에 EXPO_PUBLIC_SOCIAL_URL)</T></Card>
      ) : (
        <>
          {offline && <T size={13} color="accent">서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.</T>}
          {notice ? <T size={13} color="accent">{notice}</T> : null}

          {current && (
            <Pressable onPress={() => router.push({ pathname: "/battle", params: { id: current.id } })}>
              <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent, paddingVertical: 12 }}>
                <T weight="semibold" color="accent">
                  {current.status === "pending" ? "보낸 배틀 신청의 응답을 기다리는 중 → 보기" : "진행 중인 배틀이 있어요 → 이어서 하기"}
                </T>
              </Card>
            </Pressable>
          )}

          {incoming.length > 0 && (
            <Card style={{ gap: 12 }}>
              <T size={16} weight="bold">받은 배틀 신청</T>
              {incoming.map((b) => {
                const d = domainById(b.domain);
                return (
                  <View key={b.id} style={{ gap: 8 }}>
                    <T size={15} weight="semibold">{b.from.nickname}님 · {d ? `${d.emoji} ${d.name}` : ""} · 공부 {fmtStudyTime(b.studySec)}</T>
                    <Row gap={8} style={{ flexWrap: "nowrap" }}>
                      <Btn title="거절" size="sm" style={{ flex: 1 }} onPress={() => answer(b, false)} />
                      <Btn title="수락하고 시작" size="sm" variant="accent" style={{ flex: 2 }} onPress={() => answer(b, true)} />
                    </Row>
                  </View>
                );
              })}
            </Card>
          )}

          <Card style={{ gap: 12 }}>
            <T size={16} weight="bold">친구에게 배틀 신청</T>
            {!friends.length && (
              <View style={{ gap: 10 }}>
                <T size={14} color="muted">배틀은 친구끼리만 할 수 있어요. 친구 탭에서 UID로 친구를 먼저 추가해 주세요.</T>
                <Btn title="친구 추가하러 가기" size="sm" onPress={() => router.push("/friends")} />
              </View>
            )}
            {friends.map((f) => (
              <Row key={f.uid} gap={10} style={{ flexWrap: "nowrap" }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f.online ? c.success : c.line2 }} />
                <View style={{ flex: 1 }}>
                  <T size={15} weight="semibold" numberOfLines={1}>{f.nickname}</T>
                  <T size={12} color="muted">{f.online ? "접속 중" : "접속 안 함"}</T>
                </View>
                <LevelBadge level={f.level} size="sm" />
                <Btn title="⚔️ 신청" size="sm" variant="accent" onPress={() => setTarget(f)} />
              </Row>
            ))}
            {friends.length > 0 && <T size={12} color="muted">상대도 앱을 켜 두고 있어야 신청을 바로 받을 수 있어요.</T>}
          </Card>

          {recent.length > 0 && (
            <Card style={{ gap: 8 }}>
              <T size={16} weight="bold">최근 배틀</T>
              {recent.map((r) => (
                <Row key={r.id} style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <T size={14} numberOfLines={1} style={{ flex: 1 }}>{r.topicKo} · {r.memo.replace("⚔️ ", "")}</T>
                  <T size={14} weight="semibold">{r.score} / {r.total}</T>
                </Row>
              ))}
            </Card>
          )}
        </>
      )}

      <View style={{ backgroundColor: c.chip, borderRadius: radius.md, padding: 14, gap: 4 }}>
        <T size={14} weight="semibold">배틀 규칙</T>
        <T size={13} color="ink2">
          수락하면 두 사람에게 같은 주제가 동시에 뽑히고, 같은 시간 동안 공부한 뒤 같은 7문제를 풀어요.
          배틀 중에는 시간을 추가할 수 없어요. 점수가 높은 사람이 진 사람 경험치의 5%(최대 {BATTLE_XP_MAX} XP)를 가져가요.
        </T>
      </View>

      <BattleSetupSheet friend={target} onClose={() => setTarget(null)} />
    </Screen>
  );
}
