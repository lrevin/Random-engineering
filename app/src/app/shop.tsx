import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { GearCount } from "@/components/TimeUpSheet";
import { Btn, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, FREE_BATTLE_TICKETS, FREEZE_COST, MAX_BOUGHT_TICKETS, MAX_FREEZES, MAX_RESTORE_DAYS, RESTORE_COST_PER_DAY } from "@/lib/economy";
import { inset, radius, shadow, useColors } from "@/theme";

/** 체크 표시 한 줄 */
function Perk({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Row gap={10} style={{ flexWrap: "nowrap" }}>
      <Icon name="check" size={16} color={c.success} />
      <T size={15} style={{ flex: 1 }}>{children}</T>
    </Row>
  );
}

/** 요금제·아이템 카드: (있으면) 위에 색 띠 + 이름 + 설명 + 오른쪽 그림 + 아래 버튼 */
function PlanCard({ ribbon, title, art, children, footer, highlight }: {
  ribbon?: string; title: string; art: ReactNode; children: ReactNode; footer?: ReactNode; highlight?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{
      borderRadius: radius.lg, borderWidth: 2, borderColor: highlight ? c.accent : c.line, borderBottomWidth: 5,
      borderBottomColor: highlight ? c.accentDeep : c.paperEdge, backgroundColor: c.paper, overflow: "hidden", ...shadow(c, 2),
    }}>
      {ribbon ? (
        <View style={{ height: 34, justifyContent: "center", paddingHorizontal: 16 }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={highlight ? "ribA" : "ribB"} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={highlight ? "#e0453a" : "#1d2742"} />
                <Stop offset="1" stopColor={highlight ? "#f7b500" : "#46506b"} />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="10" fill={highlight ? "url(#ribA)" : "url(#ribB)"} />
          </Svg>
          </View>
          <T size={14} weight="bold" style={{ color: "#ffffff" }}>{ribbon}</T>
        </View>
      ) : null}
      <View style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 10 }}>
            <T size={21} weight="bold">{title}</T>
            {children}
          </View>
          <View style={{ paddingTop: 4 }}>{art}</View>
        </View>
        {footer}
      </View>
    </View>
  );
}

/** 톱니바퀴 쓰는 곳 + 무료/유료 버전 */
export default function Shop() {
  const { gears, freezes, buyFreeze, premium, setPremium, battleTickets, freeTickets, boughtTickets, buyBattleTicket } = useApp();
  const c = useColors();
  const [askUpgrade, setAskUpgrade] = useState(false);
  const [notice, setNotice] = useState("");
  const full = freezes >= MAX_FREEZES;
  const [ticketNotice, setTicketNotice] = useState("");
  const ticketsFull = boughtTickets >= MAX_BOUGHT_TICKETS;

  const buy = () => {
    if (buyFreeze()) setNotice("보호권을 1개 샀어요");
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">상점</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>

      <SectionTitle title="아이템" />
      <PlanCard
        title="연속 기록 보호권"
        art={
          <View style={{ alignItems: "center", gap: 4 }}>
            <Icon name="shield" size={64} />
            <T size={13} weight="bold" color="ink2">{freezes} / {MAX_FREEZES}개</T>
          </View>
        }
        footer={
          <View style={{ gap: 8 }}>
            <Btn
              title={full ? "보호권을 가득 갖고 있어요" : `보호권 사기 · 톱니바퀴 ${FREEZE_COST}개`}
              variant="accent"
              icon={full ? undefined : <Icon name="gear" size={22} />}
              onPress={buy}
              disabled={full || gears < FREEZE_COST}
            />
            {!full && gears < FREEZE_COST && <T size={13} color="accent" center>톱니바퀴가 {FREEZE_COST - gears}개 부족해요</T>}
            {notice ? <T size={13} color="success" center>{notice}</T> : null}
          </View>
        }
      >
        <T size={14} color="ink2">공부를 하루 빠뜨리면 다음에 앱을 열 때 자동으로 1개를 써서 연속 기록을 지켜 줘요.</T>
        <T size={13} color="muted">
          보호권이 다 떨어진 뒤 빠진 날은 하루에 톱니바퀴 {RESTORE_COST_PER_DAY}개로 최대 {MAX_RESTORE_DAYS}일까지 복구할 수 있어요.
        </T>
      </PlanCard>

      <PlanCard
        title="배틀권"
        art={
          <View style={{ alignItems: "center", gap: 4 }}>
            <Icon name="ticket" size={64} />
            <T size={13} weight="bold" color="ink2">{premium ? "무제한" : `${battleTickets}개`}</T>
          </View>
        }
        footer={
          premium ? (
            <T size={13} color="success" weight="semibold">프리미엄이라 배틀권 없이 매칭할 수 있어요.</T>
          ) : (
            <View style={{ gap: 8 }}>
              <Btn
                title={ticketsFull ? `산 배틀권은 ${MAX_BOUGHT_TICKETS}개까지 가질 수 있어요` : `배틀권 사기 · 톱니바퀴 ${BATTLE_TICKET_COST}개`}
                variant="accent"
                icon={ticketsFull ? undefined : <Icon name="gear" size={22} />}
                onPress={() => { if (buyBattleTicket()) setTicketNotice("배틀권을 1개 샀어요"); }}
                disabled={ticketsFull || gears < BATTLE_TICKET_COST}
              />
              {!ticketsFull && gears < BATTLE_TICKET_COST && <T size={13} color="accent" center>톱니바퀴가 {BATTLE_TICKET_COST - gears}개 부족해요</T>}
              {ticketNotice ? <T size={13} color="success" center>{ticketNotice}</T> : null}
            </View>
          )
        }
      >
        <T size={14} color="ink2">랜덤 매칭 배틀을 한 번 더 할 수 있어요. 매칭을 취소하거나 상대를 못 찾으면 돌려받아요.</T>
        {!premium && <T size={13} color="muted">이번 달 무료 {freeTickets} / {FREE_BATTLE_TICKETS} · 산 배틀권 {boughtTickets}개 (산 배틀권은 달이 바뀌어도 남아요)</T>}
      </PlanCard>

      <SectionTitle title="요금제 비교" />
      <PlanCard
        highlight
        ribbon={premium ? "사용 중" : "권장"}
        title="뽑공 프리미엄"
        art={<Icon name="crown" size={72} />}
        footer={
          <>
            {!premium && !askUpgrade && <Btn title="프리미엄으로 업그레이드" variant="accent" size="lg" onPress={() => setAskUpgrade(true)} />}
            {!premium && askUpgrade && (
              <View style={{ gap: 10, borderWidth: 1.5, borderColor: c.gold, borderRadius: radius.md, padding: 14, backgroundColor: c.goldSoft }}>
                <T size={14} weight="semibold">앱스토어 · 구글 플레이 결제는 아직 연결 전이에요.</T>
                <T size={13} color="ink2">지금은 시험용으로 결제 없이 프리미엄 기능을 켜 볼 수 있어요. 결제가 연결되면 이 단계가 실제 결제로 바뀌어요.</T>
                <Row gap={8} style={{ flexWrap: "nowrap" }}>
                  <Btn title="취소" size="sm" onPress={() => setAskUpgrade(false)} style={{ flex: 1 }} />
                  <Btn title="시험용으로 켜기" variant="accent" size="sm" onPress={() => { setPremium(true); setAskUpgrade(false); }} style={{ flex: 1 }} />
                </Row>
              </View>
            )}
            {premium && <Btn title="무료 버전으로 돌아가기 (시험용)" size="sm" variant="ghost" onPress={() => setPremium(false)} />}
          </>
        }
      >
        <Perk>랜덤 매칭 배틀 무제한</Perk>
        <Perk>친구 추가 · 친구 목록</Perk>
        <Perk>공부 기록 · 업적 모두 이용</Perk>
      </PlanCard>

      <PlanCard
        ribbon={premium ? undefined : "사용 중"}
        title="무료"
        art={<Icon name="ticket" size={60} />}
        footer={
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, ...inset(c) }}>
            <T size={14} color="ink2">남은 배틀권</T>
            <T size={16} weight="bold">{premium ? "무제한" : `${battleTickets}개`}</T>
          </View>
        }
      >
        <Perk>랜덤 매칭 배틀 매월 {FREE_BATTLE_TICKETS}회 (톱니바퀴 {BATTLE_TICKET_COST}개로 더 하기)</Perk>
        <Perk>친구 추가 · 친구 목록</Perk>
        <Perk>공부 기록 · 업적 모두 이용</Perk>
      </PlanCard>

      <T size={13} color="muted">
        무료 버전 배틀권은 매월 1일 00시에 {FREE_BATTLE_TICKETS}회로 다시 채워져요. 랜덤 매칭은 매칭을 돌리는 두 사람 모두
        배틀권을 1개씩 쓰고, 취소하거나 상대를 못 찾으면 돌려받아요.
      </T>
    </Screen>
  );
}
