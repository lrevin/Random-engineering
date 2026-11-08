import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { GearCount } from "@/components/TimeUpSheet";
import { Badge, Btn, Card, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { FREE_BATTLE_TICKETS, FREEZE_COST, MAX_FREEZES, RESTORE_COST_PER_DAY, MAX_RESTORE_DAYS } from "@/lib/economy";
import { inset, radius, useColors } from "@/theme";

/** 톱니바퀴 쓰는 곳 + 무료/유료 버전 */
export default function Shop() {
  const { gears, freezes, buyFreeze, premium, setPremium, battleTickets } = useApp();
  const c = useColors();
  const [askUpgrade, setAskUpgrade] = useState(false);
  const [notice, setNotice] = useState("");
  const full = freezes >= MAX_FREEZES;

  const buy = () => {
    if (buyFreeze()) setNotice("보호권을 1개 샀어요 🛡️");
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={24} weight="bold">상점 · 멤버십</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <T size={22} color="muted">✕</T>
        </Pressable>
      </Row>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>

      {/* 연속 기록 보호권 */}
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={18} weight="bold">🛡️ 연속 기록 보호권</T>
          <Badge label={`${freezes} / ${MAX_FREEZES}개`} tone={freezes ? "navy" : "outline"} />
        </Row>
        <T size={14} color="ink2">
          공부를 하루 빠뜨리면 다음에 앱을 열 때 자동으로 1개를 써서 연속 기록을 지켜 줘요.
          보호권이 다 떨어진 뒤 빠진 날은 하루에 톱니바퀴 {RESTORE_COST_PER_DAY}개로 최대 {MAX_RESTORE_DAYS}일까지 복구할 수 있어요.
        </T>
        <Btn
          title={full ? "보호권을 가득 갖고 있어요" : `보호권 사기 (톱니바퀴 ${FREEZE_COST}개)`}
          variant="accent"
          icon={full ? undefined : <Ionicons name="cog" size={18} color={c.accentInk} />}
          onPress={buy}
          disabled={full || gears < FREEZE_COST}
        />
        {!full && gears < FREEZE_COST && <T size={13} color="accent" center>톱니바퀴가 {FREEZE_COST - gears}개 부족해요</T>}
        {notice ? <T size={13} color="success" center>{notice}</T> : null}
      </Card>

      {/* 멤버십 */}
      <Card accent={premium} style={{ gap: 12 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={18} weight="bold">⭐ 멤버십</T>
          <Badge label={premium ? "유료 버전 사용 중" : "무료 버전"} tone={premium ? "accent" : "outline"} />
        </Row>
        <View style={{ borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: c.line }}>
          {[
            ["", "무료", "유료"],
            ["랜덤 매칭 배틀", `매월 ${FREE_BATTLE_TICKETS}회`, "무제한"],
            ["친구 추가", "가능", "가능"],
          ].map((row, i) => (
            <View key={i} style={{ flexDirection: "row", backgroundColor: i === 0 ? c.chip : c.paper, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              {row.map((cell, k) => (
                <T key={k} size={14} weight={i === 0 || k === 0 ? "semibold" : "regular"} color={k === 2 && i ? "accent" : "ink"}
                  style={{ flex: k === 0 ? 1.6 : 1, paddingVertical: 9, paddingHorizontal: 10, textAlign: k ? "center" : "left" }}>
                  {cell}
                </T>
              ))}
            </View>
          ))}
        </View>
        <T size={13} color="muted">
          무료 버전 배틀권은 매월 1일 00시에 {FREE_BATTLE_TICKETS}회로 다시 채워져요. 랜덤 매칭은 매칭을 돌리는 두 사람 모두
          배틀권을 1개씩 쓰고, 취소하거나 상대를 못 찾으면 돌려받아요.
        </T>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, ...inset(c) }}>
          <T size={14} color="ink2">남은 배틀권</T>
          <T size={16} weight="bold">{premium ? "무제한" : `${battleTickets} / ${FREE_BATTLE_TICKETS}회`}</T>
        </View>

        {!premium && !askUpgrade && <Btn title="유료 버전으로 업그레이드" variant="primary" size="lg" onPress={() => setAskUpgrade(true)} />}
        {!premium && askUpgrade && (
          <View style={{ gap: 10, borderWidth: 1.5, borderColor: c.gold, borderRadius: radius.md, padding: 14, backgroundColor: c.goldSoft }}>
            <T size={14} weight="semibold">앱스토어 · 구글 플레이 결제는 아직 연결 전이에요.</T>
            <T size={13} color="ink2">지금은 시험용으로 결제 없이 유료 버전 기능을 켜 볼 수 있어요. 결제가 연결되면 이 단계가 실제 결제로 바뀌어요.</T>
            <Row gap={8} style={{ flexWrap: "nowrap" }}>
              <Btn title="취소" size="sm" onPress={() => setAskUpgrade(false)} style={{ flex: 1 }} />
              <Btn title="시험용으로 켜기" variant="accent" size="sm" onPress={() => { setPremium(true); setAskUpgrade(false); }} style={{ flex: 1 }} />
            </Row>
          </View>
        )}
        {premium && <Btn title="무료 버전으로 돌아가기 (시험용)" size="sm" variant="ghost" onPress={() => setPremium(false)} />}
      </Card>
    </Screen>
  );
}
