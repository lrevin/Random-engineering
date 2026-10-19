import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { InterestPicker } from "@/components/InterestPicker";
import { TimeStepper } from "@/components/TimeStepper";
import { Btn, Field, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { requestNotificationPermission } from "@/lib/notify";
import { useColors } from "@/theme";

const STEPS = ["닉네임", "관심 분야", "매일 알림"];

export default function Onboarding() {
  const { prefs, updatePrefs, mode } = useApp();
  const c = useColors();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState(prefs.nickname);
  const [interests, setInterests] = useState<string[]>(prefs.interests);
  const [time, setTime] = useState(prefs.reminderTime);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const next = () => {
    setErr("");
    if (step === 0) {
      const n = nickname.trim();
      if (n.length < 1 || n.length > 20) return setErr("닉네임은 1~20자로 정해 주세요.");
      setNickname(n);
    }
    if (step === 1 && interests.length === 0) return setErr("관심 분야를 하나 이상 골라 주세요.");
    setStep(step + 1);
  };

  const finish = async (withReminder: boolean) => {
    setBusy(true);
    setErr("");
    try {
      const granted = withReminder ? await requestNotificationPermission() : false;
      await updatePrefs(
        { nickname: nickname.trim(), interests, reminderTime: time, reminderEnabled: withReminder && granted },
        { finishOnboarding: true },
      );
    } catch {
      setErr("저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        {/* 진행 표시 */}
        <Row gap={6} style={{ flexWrap: "nowrap" }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? c.accent : c.line }} />
              <T size={12} color={i === step ? "accent" : "muted"} weight={i === step ? "semibold" : "regular"}>{s}</T>
            </View>
          ))}
        </Row>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <T size={26} weight="bold">반가워요! 👋{"\n"}뭐라고 불러 드릴까요?</T>
              <Field label="닉네임" value={nickname} onChangeText={setNickname} maxLength={20} placeholder="예: 보안꿈나무" autoFocus onSubmitEditing={next} returnKeyType="next" />
            </>
          )}
          {step === 1 && (
            <>
              <View style={{ gap: 4 }}>
                <T size={26} weight="bold">어떤 주제를 뽑을까요?</T>
                <T color="ink2">고른 분야에서만 랜덤 주제가 나와요. 설정에서 언제든 바꿀 수 있어요.</T>
              </View>
              <InterestPicker value={interests} onChange={setInterests} />
            </>
          )}
          {step === 2 && (
            <>
              <View style={{ gap: 4 }}>
                <T size={26} weight="bold">매일 언제 알려 드릴까요? 🔔</T>
                <T color="ink2">하루 한 주제씩, 연속 기록을 이어 가도록 알려 드려요. 그날 이미 공부했다면 알림은 오지 않아요.</T>
              </View>
              <TimeStepper value={time} onChange={setTime} />
            </>
          )}
        </ScrollView>

        {err ? <T color="accent">{err}</T> : null}
        {step < 2 ? (
          <Row style={{ flexWrap: "nowrap" }}>
            {step > 0 && <Btn title="이전" onPress={() => setStep(step - 1)} style={{ flex: 1 }} size="lg" />}
            <Btn title={step === 1 ? `다음 (${interests.length}개 선택)` : "다음"} variant="primary" size="lg" onPress={next} style={{ flex: 2 }} />
          </Row>
        ) : (
          <View style={{ gap: 8 }}>
            <Btn title="알림 받고 시작하기" variant="accent" size="lg" onPress={() => finish(true)} loading={busy} />
            <Btn title="알림 없이 시작" variant="ghost" onPress={() => finish(false)} disabled={busy} />
          </View>
        )}
        {mode === "guest" && step === 0 && <T size={12} color="muted" center>둘러보기 중이에요. 기록은 이 휴대폰에만 저장돼요.</T>}
      </Screen>
    </KeyboardAvoidingView>
  );
}
