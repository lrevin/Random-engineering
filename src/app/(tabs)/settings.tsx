import Constants from "expo-constants";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, Linking, Platform, Pressable, Switch, View } from "react-native";
import { TimeStepper } from "@/components/TimeStepper";
import { Btn, Card, Field, Row, Screen, Segment, T, tap } from "@/components/ui";
import { categoryById } from "@/data";
import { useApp } from "@/lib/app-state";
import { notificationsSupported, requestNotificationPermission } from "@/lib/notify";
import { authErrorMessage } from "@/lib/supabase";
import { radius, useColors } from "@/theme";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={13} weight="semibold" color="muted" style={{ marginLeft: 4 }}>{title}</T>
      <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>{children}</Card>
    </View>
  );
}

function Item({ label, sub, right, onPress, last }: { label: string; sub?: string; right?: ReactNode; onPress?: () => void; last?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flex: 1 }}>
        <T size={16}>{label}</T>
        {sub ? <T size={13} color="muted">{sub}</T> : null}
      </View>
      {right ?? (onPress ? <T color="muted">›</T> : null)}
    </Pressable>
  );
}

function Minutes({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const c = useColors();
  const btn = (label: string, d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d > 0 ? "늘리기" : "줄이기"}
      onPress={() => { tap(); onChange(Math.min(max, Math.max(min, value + d))); }}
      style={{ width: 34, height: 34, borderRadius: radius.sm, borderWidth: 1, borderColor: c.line2, alignItems: "center", justifyContent: "center" }}
    >
      <T size={18} weight="semibold">{label}</T>
    </Pressable>
  );
  return (
    <Row gap={8} style={{ flexWrap: "nowrap" }}>
      {btn("−", -1)}
      <T size={16} weight="semibold" style={{ minWidth: 44, textAlign: "center" }}>{value}분</T>
      {btn("+", 1)}
    </Row>
  );
}

const confirm = (title: string, msg: string, ok: string, run: () => void) => {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n${msg}`)) run();
    return;
  }
  Alert.alert(title, msg, [{ text: "취소", style: "cancel" }, { text: ok, style: "destructive", onPress: run }]);
};

export default function Settings() {
  const { prefs, updatePrefs, mode, email, signOut, deleteAccount } = useApp();
  const c = useColors();
  const [nick, setNick] = useState(prefs.nickname);
  const [notice, setNotice] = useState("");

  const saveNick = () => {
    const n = nick.trim();
    if (!n || n.length > 20) return setNotice("닉네임은 1~20자로 정해 주세요.");
    updatePrefs({ nickname: n }).then(() => setNotice("닉네임을 바꿨어요.")).catch(() => setNotice("저장하지 못했어요."));
  };

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

  const interestNames = prefs.interests.map((id) => categoryById(id)?.name).filter(Boolean);

  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">설정</T>
      {notice ? <T size={14} color="accent">{notice}</T> : null}

      <Section title="계정">
        <View style={{ paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Field label="닉네임" value={nick} onChangeText={setNick} maxLength={20} onSubmitEditing={saveNick} returnKeyType="done" />
          {nick.trim() !== prefs.nickname && <Btn title="닉네임 저장" size="sm" variant="primary" onPress={saveNick} />}
        </View>
        {mode === "user" ? (
          <Item label="로그인 계정" sub={email ?? ""} last />
        ) : (
          <Item label="둘러보기 중" sub="회원가입하면 기록이 안전하게 보관돼요" onPress={() => router.push("/signup")} last />
        )}
      </Section>

      <Section title="공부">
        <Item label="관심 분야" sub={interestNames.length > 4 ? `${interestNames.slice(0, 4).join(", ")} 외 ${interestNames.length - 4}개` : interestNames.join(", ")} onPress={() => router.push("/interests")} />
        <View style={{ paddingVertical: 13, gap: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <View>
            <T size={16}>기본 난이도</T>
            <T size={13} color="muted">주제 뽑기 화면의 처음 필터</T>
          </View>
          <Segment<"0" | "1" | "2" | "3">
            value={String(prefs.level) as "0" | "1" | "2" | "3"}
            onChange={(v) => updatePrefs({ level: Number(v) as 0 | 1 | 2 | 3 })}
            options={[{ value: "0", label: "골고루" }, { value: "1", label: "Lv.1 기초" }, { value: "2", label: "Lv.2 중급" }, { value: "3", label: "Lv.3 심화" }]}
          />
        </View>
        <Item label="공부 시간" sub="기본 15분 · 끝나면 퀴즈 10문제" right={<Minutes value={prefs.studyMinutes} min={1} max={120} onChange={(v) => updatePrefs({ studyMinutes: v })} />} last />
      </Section>

      <Section title="매일 알림">
        <Item
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

      <Section title="정보">
        <Item label="개인정보처리방침" onPress={() => router.push("/privacy")} />
        <Item label="이용약관" onPress={() => router.push("/privacy?doc=terms")} />
        <Item label="버전" right={<T color="muted">{Constants.expoConfig?.version ?? "-"}</T>} last />
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
              mode === "user" ? "계정과 모든 공부 기록이 영구 삭제되고 되돌릴 수 없어요." : "이 휴대폰의 기록과 설정이 모두 지워져요.",
              mode === "user" ? "탈퇴하기" : "지우기",
              () => deleteAccount().catch((e) => setNotice(authErrorMessage(e))),
            )
          }
        />
      </View>
    </Screen>
  );
}
