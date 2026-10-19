import { Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Badge, Btn, Field, levelTone, Row, Screen, T, tap } from "@/components/ui";
import { topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { calcStreak } from "@/lib/stats";
import { useColors } from "@/theme";

const STAR_LABELS = ["", "거의 설명하지 못했다", "많이 막혔다", "절반 정도 설명했다", "대체로 잘 설명했다", "막힘없이 설명했다"];

export default function Finish() {
  const { active } = useApp();
  // 저장 직후 active가 비워져도 축하 화면을 보여 주기 위해 처음 상태만 확인
  const [valid] = useState(!!active && active.stage === "finish");
  if (!valid) return <Redirect href="/" />;
  return <FinishInner />;
}

function FinishInner() {
  const { active, setActive, addRecord, records } = useApp();
  const c = useColors();
  const [a] = useState(active!); // 화면에 들어올 때의 상태
  const topic = topicById(a.topicId);
  const [rating, setRating] = useState(a.rating);
  const [good, setGood] = useState(a.good);
  const [stuck, setStuck] = useState(a.stuck);
  const [err, setErr] = useState("");
  const [savedStreak, setSavedStreak] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (!topic) return null;

  const save = async () => {
    if (!rating) return setErr("별점을 먼저 골라 주세요.");
    if (saving) return;
    setSaving(true);
    const before = calcStreak(records);
    await addRecord({
      topicId: topic.id, topicKo: topic.ko, domain: topic.domain, category: topic.category, level: topic.level,
      memo: a.memo, rating, good: good.trim(), stuck: stuck.trim(), studySec: a.studyUsed, explainSec: a.explainUsed,
    });
    setActive(null); // 저장했으니 진행 중인 주제 비우기 (중복 저장 방지)
    setSavedStreak(before.today ? before.streak : before.streak + 1);
  };

  const close = () => router.replace("/history");

  if (savedStreak !== null) {
    return (
      <Screen contentStyle={{ justifyContent: "center", alignItems: "center", gap: 18 }}>
        <T size={72}>🔥</T>
        <T size={40} weight="bold" color="flame">{savedStreak}일 연속!</T>
        <T size={17} color="ink2" center>오늘의 주제 “{topic.ko}” 공부 완료.{"\n"}내일도 하나 뽑아 볼까요?</T>
        <Btn title="기록 보기" variant="primary" size="lg" onPress={close} style={{ alignSelf: "stretch" }} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen scroll>
        <View style={{ alignItems: "center", gap: 6, marginTop: 8 }}>
          <Row gap={6} style={{ justifyContent: "center" }}>
            <Badge label={topic.categoryName} />
            <Badge label={topic.level} tone={levelTone(topic.level)} />
          </Row>
          <T size={28} weight="bold" center>{topic.ko}</T>
        </View>

        <View style={{ alignItems: "center", gap: 6 }}>
          <T weight="semibold" color="ink2">오늘 설명은 몇 점?</T>
          <Row gap={4} style={{ justifyContent: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityLabel={`${n}점`}
                accessibilityState={{ selected: rating === n }}
                onPress={() => {
                  tap();
                  setRating(n);
                  setErr("");
                  setActive((x) => (x ? { ...x, rating: n } : x));
                }}
                hitSlop={4}
              >
                <T size={44} style={{ lineHeight: 52, color: n <= rating ? c.accent : c.line2 }}>★</T>
              </Pressable>
            ))}
          </Row>
          <T size={14} color="muted">{rating ? `${rating}점 · ${STAR_LABELS[rating]}` : "별을 눌러 점수를 고르세요"}</T>
        </View>

        <Field label="잘 설명한 것" value={good} maxLength={300} placeholder="예: 정의와 예시는 막힘 없이 말했다"
          onChangeText={(v) => { setGood(v); setActive((x) => (x ? { ...x, good: v } : x)); }} />
        <Field label="막혔던 것" value={stuck} maxLength={300} placeholder="예: 동작 과정을 순서대로 설명하지 못했다"
          onChangeText={(v) => { setStuck(v); setActive((x) => (x ? { ...x, stuck: v } : x)); }} />

        {err ? <T color="accent" center>{err}</T> : null}
        <Btn title="기록 저장" variant="accent" size="lg" onPress={save} loading={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
