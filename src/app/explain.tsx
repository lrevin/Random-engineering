import { useKeepScreenOn } from "@/lib/useKeepScreenOn";
import { Redirect, router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Ring } from "@/components/Ring";
import { Badge, Btn, Card, levelTone, Row, Screen, T, tap } from "@/components/ui";
import { levelText, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { confirmQuit } from "@/lib/confirm";
import { useStageTimer } from "@/lib/useStageTimer";
import { radius, useColors } from "@/theme";

const GUIDE = ["이게 뭔지 한 문장으로", "왜 필요한지 / 어떻게 동작하는지", "예시 하나"];

export default function Explain() {
  const { active } = useApp();
  if (!active || active.stage !== "explain") return <Redirect href="/" />;
  return <ExplainInner />;
}

function ExplainInner() {
  useKeepScreenOn("explain");
  const { active, setActive } = useApp();
  const c = useColors();
  const { width } = useWindowDimensions();
  const topic = topicById(active!.topicId);
  const [peek, setPeek] = useState(false);

  const goFinish = useCallback(() => {
    setActive((a) => (a ? { ...a, stage: "finish", endAt: null } : a));
    router.replace("/finish");
  }, [setActive]);

  const timer = useStageTimer("explain", useCallback(() => {
    setActive((a) => (a ? { ...a, explainLeft: 0, explainUsed: a.explainTotal } : a));
    goFinish();
  }, [goFinish, setActive]));

  const done = () => {
    const { left, used } = timer.stop();
    setActive((a) => (a ? { ...a, explainLeft: left, explainUsed: used } : a));
    goFinish();
  };

  if (!topic) return null;
  const ringSize = Math.min(250, width * 0.6);
  const startLabel = timer.running ? "일시정지" : timer.left < timer.total - 0.5 ? "재개" : "설명 시작 ▶";

  return (
    <Screen scroll>
      <View style={{ alignSelf: "center", borderWidth: 1, borderColor: c.accent, backgroundColor: c.accentSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 2 }}>
        <T size={13} color="accent" weight="medium">메모 없이 · 소리 내어 설명하기</T>
      </View>

      <View style={{ alignItems: "center", gap: 6 }}>
        <Row gap={6} style={{ justifyContent: "center" }}>
          <Badge label={topic.categoryName} />
          <Badge label={levelText(topic.lv)} tone={levelTone(topic.level)} />
        </Row>
        <T size={32} weight="bold" center style={{ letterSpacing: -0.7, lineHeight: 42 }}>{topic.ko}</T>
      </View>

      <View style={{ alignItems: "center", gap: 14 }}>
        <Ring size={ringSize} left={timer.left} total={timer.total} running={timer.running} warnAt={30} />
        <Row style={{ justifyContent: "center" }}>
          <Btn title={startLabel} variant={timer.running ? "outline" : "primary"} size="lg" onPress={timer.toggle} />
          <Btn title="설명 끝 → 평가" size="lg" onPress={done} />
        </Row>
      </View>

      <Card style={{ gap: 8, paddingVertical: 14 }}>
        {GUIDE.map((g, i) => (
          <Row key={g} gap={10} style={{ flexWrap: "nowrap" }}>
            <T weight="bold" color="accent">{"①②③"[i]}</T>
            <T size={17} style={{ flexShrink: 1 }}>{g}</T>
          </Row>
        ))}
      </Card>

      {/* 누르고 있는 동안만 메모 보기 */}
      <Pressable
        accessibilityRole="button"
        accessibilityHint="누르고 있는 동안만 메모가 보여요"
        onPressIn={() => { tap(); setPeek(true); }}
        onPressOut={() => setPeek(false)}
        style={{ borderWidth: 1, borderStyle: "dashed", borderColor: c.line2, borderRadius: radius.md, padding: 14, backgroundColor: c.paper, minHeight: 64, justifyContent: "center" }}
      >
        {peek ? (
          <T size={15}>{active!.memo.trim() || "(적어 둔 메모가 없어요)"}</T>
        ) : (
          <T size={14} color="muted" center>👀 메모 보기 — 누르고 있는 동안만 보여요</T>
        )}
      </Pressable>

      <Pressable onPress={() => confirmQuit(() => { setActive(null); router.replace("/home"); })} style={{ alignSelf: "center" }} hitSlop={8}>
        <T size={14} color="muted" style={{ textDecorationLine: "underline" }}>그만두기</T>
      </Pressable>
    </Screen>
  );
}
