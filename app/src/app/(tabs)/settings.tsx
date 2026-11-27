import Constants from "expo-constants";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Linking, Platform, Pressable, Switch, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { TimeStepper } from "@/components/TimeStepper";
import { Btn, Card, Row, Screen, Segment, T, tap } from "@/components/ui";
import { interestName } from "@/data";
import { useApp } from "@/lib/app-state";
import { useProfileLook } from "@/lib/profile-look";
import { Avatar } from "@/components/ProfileLook";
import { FREE_MAX_STUDY_MIN, PREMIUM_MAX_STUDY_MIN, studyMinutesFor } from "@/lib/economy";
import { notificationsSupported, requestNotificationPermission } from "@/lib/notify";
import { authErrorMessage } from "@/lib/auth";
import { radius, raised, shadow, useColors } from "@/theme";
import { Icon, type IconName } from "@/components/Icon";
import { HomeIntro } from "@/components/HomeIntro";
import { userLevel } from "@/lib/rank";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={13} weight="semibold" color="muted" style={{ marginLeft: 4 }}>{title}</T>
      <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>{children}</Card>
    </View>
  );
}

function Item({ label, sub, right, onPress, last, icon }: { label: string; sub?: string; right?: ReactNode; onPress?: () => void; last?: boolean; icon?: IconName }) {
  const c = useColors();
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => { tap(); onPress?.(); }}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line,
        backgroundColor: pressed ? c.chip : "transparent", marginHorizontal: -16, paddingHorizontal: 16,
      })}
    >
      {icon && (
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={22} color={c.ink2} />
        </View>
      )}
      <View style={{ flex: 1, gap: 1 }}>
        <T size={16} weight="semibold">{label}</T>
        {sub ? <T size={12} color="muted" numberOfLines={2}>{sub}</T> : null}
      </View>
      {right ?? (onPress ? (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>
          <T size={15} weight="bold" color="ink2" style={{ lineHeight: 18 }}>›</T>
        </View>
      ) : null)}
    </Pressable>
  );
}

/** 공부 묶음의 큰 버튼 (세 개 나란히) */
function BigButton({ icon, label, sub, onPress }: { icon: IconName; label: string; sub: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1, alignItems: "center", gap: 4, paddingVertical: 14, paddingHorizontal: 6,
        borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.paper,
        ...raised(c.paperEdge, pressed, 4), ...(!pressed ? shadow(c, 1) : null),
      })}
    >
      <Icon name={icon} size={34} />
      <T size={15} weight="bold" center>{label}</T>
      <T size={11} color="muted" center numberOfLines={2}>{sub}</T>
    </Pressable>
  );
}

function Minutes({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const c = useColors();
  const btn = (label: string, d: number) => {
    const off = d > 0 ? value >= max : value <= min;
    return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d > 0 ? "늘리기" : "줄이기"}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => { tap(); onChange(Math.min(max, Math.max(min, value + d))); }}
      style={({ pressed }) => ({ opacity: off ? 0.3 : 1, width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.line2, backgroundColor: c.paper, alignItems: "center", justifyContent: "center", ...raised(c.paperEdge, pressed, 3), ...(!pressed ? shadow(c, 1) : null) })}
    >
      <T size={18} weight="semibold">{label}</T>
    </Pressable>
    );
  };
  return (
    <Row gap={8} style={{ flexWrap: "nowrap" }}>
      {btn("−", -1)}
      <T size={16} weight="semibold" style={{ minWidth: 44, textAlign: "center" }}>{value}분</T>
      {btn("+", 1)}
    </Row>
  );
}

/** "2026-12-27T.." → "12월 27일" (한국 시간) */
const fmtUntil = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

const confirm = (title: string, msg: string, ok: string, run: () => void) =>
  showDialog({ title, message: msg, buttons: [{ text: "취소", style: "cancel" }, { text: ok, style: "destructive", onPress: run }] });

export default function Settings() {
  const { prefs, updatePrefs, mode, signOut, deleteAccount, premium, xp, uid, premiumTickets, premiumUntil, redeemPremiumTicket } = useApp();
  const c = useColors();
  const look = useProfileLook();
  const [notice, setNotice] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [intro, setIntro] = useState(false);

  const toggleReminder = async (on: boolean) => {
    if (on && !notificationsSupported) {
      setNotice(Platform.OS === "web" ? "웹에서는 알림을 보낼 수 없어요." : "Expo Go(안드로이드)에서는 알림을 시험할 수 없어요. 실제 설치한 앱에서는 작동해요.");
      updatePrefs({ reminderEnabled: true }).catch(() => {});
      return;
    }
    if (on && !(await requestNotificationPermission())) {
      setNotice("알림 권한이 꺼져 있어요. 휴대폰 설정에서 알림을 허용해 주세요.");
      if (Platform.OS !== "web") Linking.openSettings().catch(() => {});
      return;
    }
    setNotice("");
    updatePrefs({ reminderEnabled: on }).catch(() => {});
  };

  const interestNames = prefs.interests.map(interestName);

  /** 프리미엄 티켓 사용: 한 번 묻고, 서버가 켜면 화면이 바로 프리미엄으로 바뀜 */
  const askTicket = () => {
    tap();
    showDialog({
      icon: "crown",
      title: "프리미엄 티켓을 쓸까요?",
      message: premiumUntil ? `지금 프리미엄 기간에 30일이 더해져요.
남는 티켓 ${premiumTickets - 1}장` : `지금부터 30일 동안 뽑공 프리미엄을 써요.
남는 티켓 ${premiumTickets - 1}장`,
      buttons: [{ text: "취소", style: "cancel" }, { text: "사용하기", onPress: () => { void spendTicket(); } }],
    });
  };
  const spendTicket = async () => {
    setTicketBusy(true);
    try {
      if (await redeemPremiumTicket()) showDialog({ icon: "crown", title: "뽑공 프리미엄 시작!", message: "모의고사 · 오답 다시 풀기 · 배틀 무제한, 로드맵에서 바로 공부하기를 쓸 수 있어요." });
    } finally {
      setTicketBusy(false);
    }
  };

  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">설정</T>
      {notice ? <T size={14} color="accent">{notice}</T> : null}

      {/* 내 프로필 */}
      <Pressable
        onPress={() => { tap(); router.push("/profile"); }}
        accessibilityRole="button"
        accessibilityLabel="내 프로필 보기"
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 14, padding: 16, paddingTop: premium ? 20 : 16, borderRadius: radius.lg,
          borderWidth: premium ? 2.5 : 1, borderColor: premium ? c.gold : c.line,
          backgroundColor: c.paper, ...raised(c.paperEdge, pressed), ...(!pressed ? shadow(c, 2) : null),
        })}
      >
        <View style={{ borderRadius: 31, borderWidth: 3, borderColor: premium ? c.gold : c.goldSoft }}>
          <Avatar id={look.avatar} name={prefs.nickname || "나"} size={56} />
          {/* 프리미엄이면 글 대신 왕관만 얹음 */}
          {premium && (
            <View pointerEvents="none" style={{ position: "absolute", top: -22, left: 0, right: 0, alignItems: "center" }}>
              <Icon name="crown" size={30} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={18} weight="bold" numberOfLines={1}>{prefs.nickname || "나"}</T>
          <T size={13} color="muted">{userLevel(xp).level}레벨 · @{uid}</T>
        </View>
        <T size={14} weight="semibold" color="accent">프로필 ›</T>
      </Pressable>

      {/* 유료 멤버십: 무료 회원에게만 업그레이드 안내 (프리미엄은 프로필 테두리 · 왕관으로만 표시) */}
      {!premium && (
        <Card accent style={{ gap: 10 }}>
          <Row gap={8}><Icon name="crown" size={28} /><T size={17} weight="bold">유료 멤버십</T></Row>
          <T size={14} color="ink2">모의고사 · 오답 다시 풀기 · 배틀 무제한, 결제 즉시 톱니바퀴 300개.</T>
          <Btn title="유료 멤버십으로 업그레이드" variant="accent" size="lg" onPress={() => router.push("/shop")} />
        </Card>
      )}

      {mode !== "user" && (
        <Section title="계정">
          <Item icon="user-plus" label="둘러보기 중" sub="회원가입하면 기록이 안전하게 보관돼요" onPress={() => router.push("/signup")} last />
        </Section>
      )}

      <View style={{ gap: 8 }}>
        <T size={13} weight="semibold" color="muted" style={{ marginLeft: 4 }}>공부</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <BigButton icon="calendar" label="공부 기록" sub="리포트 · 캘린더 · 지난 기록" onPress={() => router.push("/history")} />
          <BigButton icon="tree" label="로드맵" sub="분야별 주제 지도" onPress={() => router.push("/roadmap")} />
          <BigButton icon="medal" label="자격증" sub="디데이 · 과목별 진도" onPress={() => router.push("/certs")} />
        </View>
      </View>

      <Section title="공부 설정">
        <Item icon="target" label="관심 분야" sub={interestNames.length > 4 ? `${interestNames.slice(0, 4).join(", ")} 외 ${interestNames.length - 4}개` : interestNames.join(", ")} onPress={() => router.push("/interests")} />
        <View style={{ paddingVertical: 13, gap: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <View>
            <T size={16} weight="semibold">기본 난이도</T>
            <T size={12} color="muted">주제 뽑기 화면의 처음 필터</T>
          </View>
          <Segment<"0" | "1" | "2" | "3">
            value={String(prefs.level) as "0" | "1" | "2" | "3"}
            onChange={(v) => updatePrefs({ level: Number(v) as 0 | 1 | 2 | 3 })}
            options={[{ value: "0", label: "전체" }, { value: "1", label: "Lv.1 기초" }, { value: "2", label: "Lv.2 중급" }, { value: "3", label: "Lv.3 심화" }]}
          />
        </View>
        <Item icon="hourglass" label="공부 시간" sub={premium ? `최대 ${PREMIUM_MAX_STUDY_MIN}분` : `무료는 최대 ${FREE_MAX_STUDY_MIN}분`} right={<Minutes value={studyMinutesFor(prefs.studyMinutes, premium)} min={1} max={premium ? PREMIUM_MAX_STUDY_MIN : FREE_MAX_STUDY_MIN} onChange={(v) => updatePrefs({ studyMinutes: v })} />} last />
      </Section>

      {mode === "user" && (
        <Section title="뽑공 프리미엄 티켓">
          <View style={{ paddingVertical: 14, gap: 12 }}>
            <Row gap={12} style={{ flexWrap: "nowrap" }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.goldSoft }}>
                <Icon name="ticket" size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <T size={16} weight="semibold">보유한 티켓 {premiumTickets}장</T>
                <T size={12} color="muted">
                  {premiumUntil ? `${fmtUntil(premiumUntil)}까지 프리미엄 · 쓰면 30일 연장` : "1장을 쓰면 30일 동안 뽑공 프리미엄"}
                </T>
              </View>
            </Row>
            <Btn title={ticketBusy ? "확인하는 중…" : "티켓 사용하기"} variant="premium" icon={<Icon name="crown" size={24} />}
              disabled={ticketBusy || premiumTickets < 1} onPress={askTicket} />
          </View>
        </Section>
      )}

      <Section title="매일 알림">
        <Item
          icon="bell"
          label="공부 알림 받기"
          sub="그날 이미 공부했으면 알림이 오지 않아요"
          right={<Switch value={prefs.reminderEnabled} onValueChange={toggleReminder} trackColor={{ true: c.accent, false: c.line2 }} thumbColor={c.paper} />}
          last={!prefs.reminderEnabled}
        />
        {prefs.reminderEnabled && (
          <View style={{ paddingVertical: 14 }}>
            <TimeStepper value={prefs.reminderTime} onChange={(v) => updatePrefs({ reminderTime: v })} />
          </View>
        )}
      </Section>

      <HomeIntro open={intro} onClose={() => setIntro(false)} />
      <Section title="정보">
        <Item icon="book" label="사용법 다시 보기" sub="뽑기 · 공부 · 퀴즈 · 퀘스트 · 상점 안내" onPress={() => setIntro(true)} />
        <Item icon="shield" label="개인정보처리방침" onPress={() => router.push("/privacy")} />
        <Item icon="doc" label="이용약관" onPress={() => router.push("/privacy?doc=terms")} />
        <Item icon="gear" label="버전" right={<T color="muted">{Constants.expoConfig?.version ?? "-"}</T>} last />
      </Section>

      <View style={{ gap: 6, marginTop: 4 }}>
        {mode === "user" && (
          <Btn title="로그아웃" onPress={() => confirm("로그아웃", "이 휴대폰에서 로그아웃할까요? 기록은 계정에 남아 있어요.", "로그아웃", signOut)} />
        )}
        <Btn
          title={mode === "user" ? "회원 탈퇴" : "둘러보기 데이터 지우기"}
          variant="ghost"
          onPress={() =>
            confirm(
              mode === "user" ? "회원 탈퇴" : "데이터 지우기",
              mode === "user" ? "즉시 이용이 중지되고 30일 후 서버 데이터가 모두 삭제돼요. 30일 안에 다시 로그인하면 탈퇴가 취소돼요. 구독 중이면 다음 결제부터 멈춰요. 이 기기의 데이터는 신청 후 지워져요." : "이 휴대폰의 기록과 설정이 모두 지워져요.",
              mode === "user" ? "탈퇴하기" : "지우기",
              () => deleteAccount().catch((e) => setNotice(authErrorMessage(e))),
            )
          }
        />
      </View>
    </Screen>
  );
}
