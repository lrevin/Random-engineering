import { router } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { CertPicker } from "@/components/CertPicker";
import { InterestPicker, domainsOf } from "@/components/InterestPicker";
import { Btn, Screen, Segment, T } from "@/components/ui";
import { CERTS, DOMAINS, isCertId } from "@/data";
import { useApp } from "@/lib/app-state";

type Tab = "eng" | "sci" | "cert";

export default function Interests() {
  const { prefs, updatePrefs } = useApp();
  const [value, setValue] = useState(prefs.interests);
  const [err, setErr] = useState("");
  // 공학 · 과학 · 자격증을 탭으로 나눠 한 번에 한 묶음만 (스크롤이 너무 길어서)
  const [tab, setTab] = useState<Tab>("eng");
  const count = (g: string) => domainsOf(value).filter((d) => DOMAINS.find((x) => x.id === d)?.group === g).length;
  const certN = value.filter((id) => isCertId(id) && CERTS.some((c) => c.id === id)).length;

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
      <Segment<Tab> fill value={tab} onChange={setTab} options={[
        { value: "eng", label: count("eng") ? `공학 ${count("eng")}` : "공학" },
        { value: "sci", label: count("sci") ? `과학 ${count("sci")}` : "과학" },
        { value: "cert", label: certN ? `자격증 ${certN}` : "자격증" },
      ]} />
      <ScrollView key={tab} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
        {tab === "cert" ? (
          <>
            <T size={13} color="ink2" style={{ marginBottom: 12 }}>고르면 그 자격증 시험 과목의 주제도 랜덤 주제에 나와요.</T>
            <CertPicker value={value} onChange={setValue} />
          </>
        ) : (
          <InterestPicker value={value} onChange={setValue} group={tab} />
        )}
      </ScrollView>
      {err ? <T color="accent">{err}</T> : null}
      <Btn title={`저장 (분야 ${domainsOf(value).length}개${value.some(isCertId) ? ` · 자격증 ${value.filter(isCertId).length}개` : ""})`} variant="primary" size="lg" onPress={save} />
      <Btn title="취소" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
