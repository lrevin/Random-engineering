import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AdRewardButton } from "@/components/AdRewardButton";
import { Icon } from "@/components/Icon";
import { Perk, PlanCard } from "@/components/PlanCard";
import { SectionTitle } from "@/components/StatTile";
import { GearCount } from "@/components/TimeUpSheet";
import { Btn, Row, Screen, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, EXAM_TICKET_COST, FREE_BATTLE_TICKETS, FREE_EXAMS_PER_DAY, PREMIUM_BONUS_GEARS, FREE_MAX_STUDY_MIN, PREMIUM_MAX_STUDY_MIN } from "@/lib/economy";
import { THEMES, TITLES } from "@/lib/skins";
import { inset, radius, raised, shadow, useColors } from "@/theme";

/** 상점 분류 버튼: 큰 그림 + 이름 + 설명, 누르면 그 상점으로 */
function ShopDoor({ title, sub, art, onPress }: { title: string; sub: string; art: ReactNode; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flex: 1, alignItems: "center", gap: 10, paddingVertical: 20, paddingHorizontal: 12, borderRadius: radius.lg, borderWidth: 2,
        borderColor: c.line, backgroundColor: c.paper, ...raised(c.paperEdge, pressed, 6), ...(!pressed ? shadow(c, 2) : null),
      })}
    >
      {art}
      <T size={19} weight="bold" center>{title}</T>
      <T size={13} color="muted" center>{sub}</T>
    </Pressable>
  );
}

/** 톱니바퀴 쓰는 곳 + 무료/유료 버전 */
export default function Shop() {
  const { mode, walletNotice, gears, premium, setPremium, purchasePremium, refreshWallet, battleTickets } = useApp();
  const c = useColors();
  const [askUpgrade, setAskUpgrade] = useState(false);
  const [bonusNotice, setBonusNotice] = useState("");
  useFocusEffect(useCallback(() => { if (mode === "user") void refreshWallet().catch(() => {}); }, [mode, refreshWallet]));

  return (
    <Screen scroll edges={["top"]}>
      <T size={26} weight="bold">상점</T>
      {walletNotice ? <T color="accent">{walletNotice}</T> : null}
      {mode === "user" ? <T size={13} color="muted">구매한 이용권·꾸미기·부스터는 회원 계정에 저장돼요. 실제 결제 기능은 아직 준비 중이에요.</T> : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>

      {/* 광고 보고 톱니바퀴 (배틀 탭과 같은 버튼, 하루 횟수도 같이 셈) */}
      <AdRewardButton />

      {/* 분류: 누르면 각 상점 화면으로 */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <ShopDoor
          title="아이템 상점"
          sub={"보호권 · 배틀권\n모의고사권 · 부스터"}
          art={<Icon name="chest" size={64} />}
          onPress={() => router.push("/items")}
        />
        <ShopDoor
          title="꾸미기 상점"
          sub={`테마 ${THEMES.length - 1}종\n칭호 ${TITLES.length}종`}
          art={
            <View style={{ width: 64, height: 64, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: c.line2, flexDirection: "row" }}>
              {[{ backgroundColor: c.bg, ...(c.grad.bg ? { experimental_backgroundImage: c.grad.bg } : null) },
                { backgroundColor: c.slot, ...(c.grad.hero ? { experimental_backgroundImage: c.grad.hero } : null) },
                { backgroundColor: c.accent, ...(c.grad.accent ? { experimental_backgroundImage: c.grad.accent } : null) }].map((st, i) => <View key={i} style={{ flex: 1, ...st }} />)}
            </View>
          }
          onPress={() => router.push("/cosmetics")}
        />
      </View>

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
                <T size={13} color="ink2">{mode === "user" ? "회원 계정은 결제 연동 후 이용할 수 있어요." : "게스트 모드에서만 시험용으로 켤 수 있어요."}</T>
                <Row gap={8} style={{ flexWrap: "nowrap" }}>
                  <Btn title="취소" size="sm" onPress={() => setAskUpgrade(false)} style={{ flex: 1 }} />
                  <Btn title="시험용으로 켜기" disabled={mode === "user"} variant="accent" size="sm" onPress={async () => {
                    const got = await purchasePremium();
                    setBonusNotice(`${got ? `결제 보너스로 톱니바퀴 ${got}개를 받았어요!` : "이번 달 결제 보너스는 이미 받았어요."} 프리미엄 전용 테마 '프리즘 오팔'도 열렸어요.`);
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
        <Perk>프리미엄 전용 테마 &apos;프리즘 오팔&apos; 바로 사용</Perk>
        <Perk>자격증 모의고사 무제한</Perk>
        <Perk>오답 다시 풀기 (틀린 문제를 변형해서 출제)</Perk>
        <Perk>로드맵에서 원하는 주제 골라 바로 공부</Perk>
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
