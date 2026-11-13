import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { AdRewardButton } from "@/components/AdRewardButton";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { GearCount } from "@/components/TimeUpSheet";
import { Btn, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, EXAM_TICKET_COST, MAX_EXAM_TICKETS, FREE_BATTLE_TICKETS, FREE_EXAMS_PER_DAY, PREMIUM_BONUS_GEARS, FREE_MAX_STUDY_MIN, PREMIUM_MAX_STUDY_MIN, FREEZE_COST, MAX_BOUGHT_TICKETS, MAX_FREEZES } from "@/lib/economy";
import { addExamTicket, readExamStore } from "@/lib/exam";
import { addBoost, BOOST_COST, BOOST_MAX_MIN, BOOST_MIN, canStackBoost, fmtLeft, useBoost } from "@/lib/booster";
import { useSkins } from "@/lib/skins";
import { inset, radius, raised, shadow, useColors } from "@/theme";

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
  const { gears, freezes, buyFreeze, premium, setPremium, purchasePremium, spendGears, battleTickets, freeTickets, boughtTickets, buyBattleTicket } = useApp();
  const c = useColors();
  const [askUpgrade, setAskUpgrade] = useState(false);
  const [notice, setNotice] = useState("");
  const full = freezes >= MAX_FREEZES;
  const [ticketNotice, setTicketNotice] = useState("");
  const [bonusNotice, setBonusNotice] = useState("");
  // 모의고사 1회권 (모의고사 화면에서 쓰고 오면 다시 읽음)
  const [examTickets, setExamTickets] = useState(0);
  const [examNotice, setExamNotice] = useState("");
  useFocusEffect(useCallback(() => { readExamStore().then((s) => setExamTickets(s.tickets)); }, []));
  const examFull = examTickets >= MAX_EXAM_TICKETS;
  const buyExamTicket = async () => {
    if (examFull || !spendGears(EXAM_TICKET_COST)) return;
    setExamTickets((await addExamTicket()).tickets);
    setExamNotice("모의고사 1회권을 1개 샀어요");
  };
  const skins = useSkins();
  const boost = useBoost();
  const [boostNotice, setBoostNotice] = useState("");
  const boostFull = !canStackBoost();
  const buyBoost = () => {
    if (boostFull || !spendGears(BOOST_COST)) return;
    addBoost();
    setBoostNotice(`부스터를 켰어요. ${BOOST_MIN}분 동안 퀴즈 경험치가 2배예요`);
  };
  const ticketsFull = boughtTickets >= MAX_BOUGHT_TICKETS;

  const buy = () => {
    if (buyFreeze()) setNotice("보호권을 1개 샀어요");
  };

  return (
    <Screen scroll edges={["top"]}>
      <T size={26} weight="bold">상점</T>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>

      {/* 광고 보고 톱니바퀴 (배틀 탭과 같은 버튼, 하루 횟수도 같이 셈) */}
      <AdRewardButton />

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
                onPress={() => { if (buyBattleTicket()) setTicketNotice("배틀권을 1개 샀어요"); }}
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
                disabled={examFull || gears < EXAM_TICKET_COST}
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
              disabled={boostFull || gears < BOOST_COST}
            />
            {!boostFull && gears < BOOST_COST && <T size={13} color="accent" center>톱니바퀴가 {BOOST_COST - gears}개 부족해요</T>}
            {boostNotice ? <T size={13} color="success" center>{boostNotice}</T> : null}
          </View>
        }
      >
        <T size={14} color="ink2">{BOOST_MIN}분 동안 퀴즈 경험치 2배</T>
      </PlanCard>

      <SectionTitle title="꾸미기" />
      <Pressable
        onPress={() => router.push("/skins")}
        accessibilityRole="button"
        accessibilityLabel="스킨과 칭호 보러 가기"
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 2,
          borderColor: c.line, backgroundColor: c.paper, ...raised(c.paperEdge, pressed, 5), ...(!pressed ? shadow(c, 2) : null),
        })}
      >
        <View style={{ backgroundColor: c.chip, borderRadius: radius.md, padding: 6 }}><Icon name="slot" size={46} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={19} weight="bold">스킨 · 칭호</T>
          <T size={13} color="ink2">지금 {skins.active.name}</T>
          <T size={12} color="muted">시즌 한정 판매 중</T>
        </View>
        <T size={22} color="muted">›</T>
      </Pressable>

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
                <T size={13} color="ink2">지금은 결제 없이 시험용으로 켜져요.</T>
                <Row gap={8} style={{ flexWrap: "nowrap" }}>
                  <Btn title="취소" size="sm" onPress={() => setAskUpgrade(false)} style={{ flex: 1 }} />
                  <Btn title="시험용으로 켜기" variant="accent" size="sm" onPress={async () => {
                    const got = await purchasePremium();
                    setBonusNotice(got ? `결제 보너스로 톱니바퀴 ${got}개를 받았어요!` : "이번 달 결제 보너스는 이미 받았어요.");
                    setAskUpgrade(false);
                  }} style={{ flex: 1 }} />
                </Row>
              </View>
            )}
            {bonusNotice ? <T size={13} color="success" weight="semibold" center>{bonusNotice}</T> : null}
            {premium && <Btn title="무료 버전으로 돌아가기 (시험용)" size="sm" variant="ghost" onPress={() => setPremium(false)} />}
          </>
        }
      >
        <Perk>결제하는 순간 톱니바퀴 {PREMIUM_BONUS_GEARS}개 지급</Perk>
        <Perk>자격증 모의고사 무제한</Perk>
        <Perk>오답 다시 풀기 (틀린 문제를 변형해서 출제)</Perk>
        <Perk>랜덤 매칭 배틀 무제한</Perk>
        <Perk>한 번에 최대 {PREMIUM_MAX_STUDY_MIN}분까지 공부</Perk>
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
        <Perk>자격증 모의고사 하루 {FREE_EXAMS_PER_DAY}회 (톱니바퀴 {EXAM_TICKET_COST}개로 더 보기)</Perk>
        <Perk>한 번에 최대 {FREE_MAX_STUDY_MIN}분까지 공부</Perk>
        <Perk>친구 추가 · 친구 목록</Perk>
        <Perk>공부 기록 · 업적 모두 이용</Perk>
      </PlanCard>

      <T size={13} color="muted">무료 배틀권은 매월 1일에 {FREE_BATTLE_TICKETS}회로 채워져요.</T>
    </Screen>
  );
}
