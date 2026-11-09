import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { CertPicker } from "@/components/CertPicker";
import { InterestPicker } from "@/components/InterestPicker";
import { Btn, Screen, T } from "@/components/ui";
import { isCertId } from "@/data";
import { useApp } from "@/lib/app-state";

export default function Interests() {
  const { prefs, updatePrefs } = useApp();
  const [value, setValue] = useState(prefs.interests);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!value.length) return setErr("관심 분야나 자격증을 하나 이상 골라 주세요.");
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
        <View style={{ gap: 4, marginTop: 26, marginBottom: 10 }}>
          <T size={20} weight="bold">준비 중인 자격증</T>
          <T size={13} color="ink2">고르면 그 자격증 시험 과목의 주제도 랜덤 주제에 나와요.</T>
        </View>
        <CertPicker value={value} onChange={setValue} />
      </ScrollView>
      {err ? <T color="accent">{err}</T> : null}
      <Btn title={`저장 (분야 ${value.filter((id) => !isCertId(id)).length}개${value.some(isCertId) ? ` · 자격증 ${value.filter(isCertId).length}개` : ""})`} variant="primary" size="lg" onPress={save} />
      <Btn title="취소" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
