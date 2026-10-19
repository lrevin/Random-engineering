import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { DomainPicker } from "@/components/DomainPicker";
import { InterestPicker } from "@/components/InterestPicker";
import { LevelPicker } from "@/components/LevelPicker";
import { TimeStepper } from "@/components/TimeStepper";
import { Btn, Field, Row, Screen, T } from "@/components/ui";
import { categoryById, domainById } from "@/data";
import { useApp } from "@/lib/app-state";
import { requestNotificationPermission } from "@/lib/notify";
import type { Prefs } from "@/lib/types";
import { useColors } from "@/theme";

const STEPS = ["닉네임", "분야", "세부 분야", "난이도", "알림"];

export default function Onboarding() {
  const { prefs, updatePrefs, mode } = useApp();
  const c = useColors();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState(prefs.nickname);
  const [domains, setDomains] = useState<string[]>(() => [
    ...new Set(prefs.interests.map((id) => categoryById(id)?.domain).filter((d): d is string => !!d)),
  ]);
  const [interests, setInterests] = useState<string[]>(prefs.interests);
  const [level, setLevel] = useState<Prefs["level"]>(prefs.level);
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
    if (step === 1) {
      if (!domains.length) return setErr("공부할 분야를 하나 이상 골라 주세요.");
      // 고른 분야의 세부 분야만 남기고, 새로 고른 분야는 세부 분야를 모두 선택해 둠
      const kept = interests.filter((id) => domains.includes(categoryById(id)?.domain ?? ""));
      const added = domains
        .filter((d) => !kept.some((id) => categoryById(id)?.domain === d))
        .flatMap((d) => domainById(d)?.categories.map((x) => x.id) ?? []);
      setInterests([...kept, ...added]);
    }
    if (step === 2 && interests.length === 0) return setErr("세부 분야를 하나 이상 골라 주세요.");
    setStep(step + 1);
  };

  const finish = async (withReminder: boolean) => {
    setBusy(true);
    setErr("");
    try {
      const granted = withReminder ? await requestNotificationPermission() : false;
      await updatePrefs(
        { nickname: nickname.trim(), interests, level, reminderTime: time, reminderEnabled: withReminder && granted },
        { finishOnboarding: true },
      );
    } catch {
      setErr("저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  const nextLabel =
    step === 1 ? `다음 (${domains.length}개 분야)` : step === 2 ? `다음 (${interests.length}개 선택)` : "다음";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        {/* 진행 표시 */}
        <Row gap={5} style={{ flexWrap: "nowrap" }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? c.accent : c.line }} />
              <T size={11} color={i === step ? "accent" : "muted"} weight={i === step ? "semibold" : "regular"} numberOfLines={1}>{s}</T>
            </View>
          ))}
        </Row>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <T size={26} weight="bold">반가워요! 👋{"\n"}뭐라고 불러 드릴까요?</T>
              <Field label="닉네임" value={nickname} onChangeText={setNickname} maxLength={20} placeholder="예: 공대생" autoFocus onSubmitEditing={next} returnKeyType="next" />
            </>
          )}
          {step === 1 && (
            <>
              <View style={{ gap: 4 }}>
                <T size={26} weight="bold">어떤 분야를 공부할까요?</T>
                <T color="ink2">여러 개 골라도 좋아요. 고른 분야에서 매일 랜덤 주제가 나와요.</T>
              </View>
              <DomainPicker value={domains} onChange={setDomains} />
            </>
          )}
          {step === 2 && (
            <>
              <View style={{ gap: 4 }}>
                <T size={26} weight="bold">세부 분야를 골라 주세요</T>
                <T color="ink2">처음에는 모두 선택되어 있어요. 빼고 싶은 것만 눌러 끄세요.</T>
              </View>
              <InterestPicker value={interests} onChange={setInterests} domains={domains} />
            </>
          )}
          {step === 3 && (
            <>
              <View style={{ gap: 4 }}>
                <T size={26} weight="bold">어느 난이도부터 시작할까요?</T>
                <T color="ink2">주제마다 Lv.1~3 난이도가 있어요. 공부 화면에서 언제든 바꿀 수 있어요.</T>
              </View>
              <LevelPicker value={level} onChange={setLevel} interests={interests} />
            </>
          )}
          {step === 4 && (
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
        {step < 4 ? (
          <Row style={{ flexWrap: "nowrap" }}>
            {step > 0 && <Btn title="이전" onPress={() => { setErr(""); setStep(step - 1); }} style={{ flex: 1 }} size="lg" />}
            <Btn title={nextLabel} variant="primary" size="lg" onPress={next} style={{ flex: 2 }} />
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
