import { router } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { InterestPicker } from "@/components/InterestPicker";
import { Btn, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";

export default function Interests() {
  const { prefs, updatePrefs } = useApp();
  const [value, setValue] = useState(prefs.interests);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!value.length) return setErr("관심 분야를 하나 이상 골라 주세요.");
    try {
      await updatePrefs({ interests: value });
      router.back();
    } catch {
      setErr("저장하지 못했어요.");
    }
  };

  return (
    <Screen>
      <T size={24} weight="bold">관심 분야</T>
      <T color="ink2">고른 분야에서만 랜덤 주제가 나와요.</T>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
        <InterestPicker value={value} onChange={setValue} />
      </ScrollView>
      {err ? <T color="accent">{err}</T> : null}
      <Btn title={`저장 (${value.length}개)`} variant="primary" size="lg" onPress={save} />
      <Btn title="취소" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
