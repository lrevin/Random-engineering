import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { PlanCard } from "@/components/PlanCard";
import { GearCount } from "@/components/TimeUpSheet";
import { Btn, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, EXAM_TICKET_COST, FREE_BATTLE_TICKETS, FREEZE_COST, MAX_BOUGHT_TICKETS, MAX_EXAM_TICKETS, MAX_FREEZES } from "@/lib/economy";
import { addExamTicket, readExamStore } from "@/lib/exam";
import { addBoost, BOOST_COST, BOOST_MAX_MIN, BOOST_MIN, canStackBoost, fmtLeft, useBoost } from "@/lib/booster";
import { inset, radius, useColors } from "@/theme";

/** 아이템 상점: 톱니바퀴로 사는 보호권 · 배틀권 · 모의고사 1회권 · 경험치 부스터 */
export default function Items() {
  const { mode, walletBusy, walletNotice, gears, freezes, buyFreeze, premium, spendGears, memberAssets, purchaseItem, refreshWallet, battleTickets, freeTickets, boughtTickets, buyBattleTicket } = useApp();
  const c = useColors();
  const [notice, setNotice] = useState("");
  const full = freezes >= MAX_FREEZES;
  const [ticketNotice, setTicketNotice] = useState("");
  // 모의고사 1회권 (모의고사 화면에서 쓰고 오면 다시 읽음)
  const [guestExamTickets, setExamTickets] = useState(0);
  const examTickets = mode === "user" ? (memberAssets?.examTickets ?? 0) : guestExamTickets;
  const [examNotice, setExamNotice] = useState("");
  useFocusEffect(useCallback(() => { if (mode === "user") void refreshWallet().catch(() => {}); else void readExamStore().then((s) => setExamTickets(s.tickets)); }, [mode, refreshWallet]));
  const examFull = examTickets >= MAX_EXAM_TICKETS;
  const buyExamTicket = async () => {
    if (examFull) return;
    if (mode === "user") { if (!await purchaseItem("exam_ticket")) return; }
    else { if (!await spendGears(EXAM_TICKET_COST)) return; setExamTickets((await addExamTicket()).tickets); }
    setExamNotice("모의고사 1회권을 1개 샀어요");
  };
  const boost = useBoost();
  const [boostNotice, setBoostNotice] = useState("");
  const boostFull = !canStackBoost();
  const buyBoost = async () => {
    if (boostFull) return;
    if (mode === "user") { if (!await purchaseItem("xp_boost")) return; }
    else { if (!await spendGears(BOOST_COST)) return; addBoost(); }
    setBoostNotice(`부스터를 켰어요. ${BOOST_MIN}분 동안 퀴즈 경험치가 2배예요`);
  };
  const ticketsFull = boughtTickets >= MAX_BOUGHT_TICKETS;
  const buy = async () => {
    if (await buyFreeze()) setNotice("보호권을 1개 샀어요");
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">아이템 상점</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>
      {walletNotice ? <T color="accent">{walletNotice}</T> : null}

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
        <T size={14} color="ink2">하루 빠져도 연속 기록을 지켜 줘요.</T>
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
            <T size={13} color="success" weight="semibold">프리미엄은 무제한이에요</T>
          ) : (
            <View style={{ gap: 8 }}>
              <Btn
                title={ticketsFull ? `산 배틀권은 ${MAX_BOUGHT_TICKETS}개까지 가질 수 있어요` : `배틀권 사기 · 톱니바퀴 ${BATTLE_TICKET_COST}개`}
                variant="accent"
                icon={ticketsFull ? undefined : <Icon name="gear" size={22} />}
                onPress={async () => { if (await buyBattleTicket()) setTicketNotice("배틀권을 1개 샀어요"); }}
                disabled={ticketsFull || gears < BATTLE_TICKET_COST}
              />
              {!ticketsFull && gears < BATTLE_TICKET_COST && <T size={13} color="accent" center>톱니바퀴가 {BATTLE_TICKET_COST - gears}개 부족해요</T>}
              {ticketNotice ? <T size={13} color="success" center>{ticketNotice}</T> : null}
            </View>
          )
        }
      >
        <T size={14} color="ink2">랜덤 매칭 배틀 1번</T>
        {!premium && <T size={13} color="muted">이번 달 무료 {freeTickets} / {FREE_BATTLE_TICKETS} · 산 것 {boughtTickets}개</T>}
      </PlanCard>

      <PlanCard
        title="모의고사 1회권"
        art={
          <View style={{ alignItems: "center", gap: 4 }}>
            <Icon name="medal" size={64} />
            <T size={13} weight="bold" color="ink2">{premium ? "무제한" : `${examTickets} / ${MAX_EXAM_TICKETS}개`}</T>
          </View>
        }
        footer={
          premium ? (
            <T size={13} color="success" weight="semibold">프리미엄은 무제한이에요</T>
          ) : (
            <View style={{ gap: 8 }}>
              <Btn
                title={examFull ? `1회권은 ${MAX_EXAM_TICKETS}개까지 가질 수 있어요` : `1회권 사기 · 톱니바퀴 ${EXAM_TICKET_COST}개`}
                variant="accent"
                icon={examFull ? undefined : <Icon name="gear" size={22} />}
                onPress={buyExamTicket}
                disabled={walletBusy || examFull || gears < EXAM_TICKET_COST}
              />
              {!examFull && gears < EXAM_TICKET_COST && <T size={13} color="accent" center>톱니바퀴가 {EXAM_TICKET_COST - gears}개 부족해요</T>}
              {examNotice ? <T size={13} color="success" center>{examNotice}</T> : null}
              {examTickets > 0 && <Btn title="모의고사 보러 가기" size="sm" variant="ghost" onPress={() => router.push("/exam")} />}
            </View>
          )
        }
      >
        <T size={14} color="ink2">자격증 모의고사 1번 더 보기</T>
      </PlanCard>

      <PlanCard
        title="경험치 2배 부스터"
        art={
          <View style={{ alignItems: "center", gap: 4 }}>
            <Icon name="bolt" size={64} />
            <T size={13} weight="bold" color={boost.active ? "success" : "ink2"}>{boost.active ? fmtLeft(boost.left) : "꺼짐"}</T>
          </View>
        }
        footer={
          <View style={{ gap: 8 }}>
            <Btn
              title={boostFull ? `부스터는 ${BOOST_MAX_MIN}분까지 쌓을 수 있어요` : `${boost.active ? "시간 더하기" : "부스터 켜기"} · 톱니바퀴 ${BOOST_COST}개`}
              variant="accent"
              icon={boostFull ? undefined : <Icon name="gear" size={22} />}
              onPress={buyBoost}
              disabled={walletBusy || boostFull || gears < BOOST_COST}
            />
            {!boostFull && gears < BOOST_COST && <T size={13} color="accent" center>톱니바퀴가 {BOOST_COST - gears}개 부족해요</T>}
            {boostNotice ? <T size={13} color="success" center>{boostNotice}</T> : null}
          </View>
        }
      >
        <T size={14} color="ink2">{BOOST_MIN}분 동안 퀴즈 경험치 2배</T>
      </PlanCard>

    </Screen>
  );
}
