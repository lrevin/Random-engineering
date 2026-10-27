import { useKeepScreenOn } from "@/lib/useKeepScreenOn";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, TextInput, useWindowDimensions, View } from "react-native";
import { Ring } from "@/components/Ring";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, FONT, levelTone, Row, Screen, T } from "@/components/ui";
import { levelText, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { confirmQuit } from "@/lib/confirm";
import { prefetchQuiz } from "@/lib/quiz";
import { useStageTimer } from "@/lib/useStageTimer";
import { radius, useColors } from "@/theme";

export default function Study() {
  const { active } = useApp();
  if (!active || active.stage !== "study") return <Redirect href="/" />;
  return <StudyInner />;
}

function StudyInner() {
  useKeepScreenOn("study");
  const { active, setActive } = useApp();
  const c = useColors();
  const { width } = useWindowDimensions();
  const topic = topicById(active!.topicId);
  const [memo, setMemo] = useState(active!.memo);
  const memoRef = useRef(memo);
  useLayoutEffect(() => {
    memoRef.current = memo;
  });
  const [saved, setSaved] = useState(true);
  const memoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goQuiz = useCallback(() => {
    setActive((a) => (a ? { ...a, stage: "quiz", endAt: null } : a));
    router.replace("/quiz");
  }, [setActive]);

  const timer = useStageTimer("study", useCallback(() => {
    setActive((a) => (a ? { ...a, memo: memoRef.current, studyLeft: 0, studyUsed: a.studyTotal } : a));
    goQuiz();
  }, [goQuiz, setActive]));

  // 처음 들어오면 바로 시작하고, 퀴즈를 미리 받아 둠
  useEffect(() => {
    if (timer.fresh) timer.start();
    if (topic) prefetchQuiz(topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (memoTimer.current) clearTimeout(memoTimer.current); }, []);

  const onMemo = (v: string) => {
    setMemo(v);
    setSaved(false);
    if (memoTimer.current) clearTimeout(memoTimer.current);
    memoTimer.current = setTimeout(() => {
      setActive((a) => (a ? { ...a, memo: v } : a));
      setSaved(true);
    }, 400);
  };

  const skip = () => {
    const { left, used } = timer.stop();
    setActive((a) => (a ? { ...a, memo, studyLeft: left, studyUsed: used } : a));
    goQuiz();
  };

  if (!topic) return null;
  const ringSize = Math.min(220, width * 0.5);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen scroll>
        <View style={{ alignSelf: "center", borderWidth: 1, borderColor: c.accent, backgroundColor: c.accentSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 2 }}>
          <T size={13} color="accent" weight="medium">AI 사용 금지 · 위키·백과사전만</T>
        </View>

        <View style={{ alignItems: "center", gap: 6 }}>
          <Row gap={6} style={{ justifyContent: "center" }}>
            <Badge label={topic.categoryName} />
            <Badge label={levelText(topic.lv)} tone={levelTone(topic.level)} />
          </Row>
          <T size={28} weight="bold" center style={{ letterSpacing: -0.6, lineHeight: 36 }}>{topic.ko}</T>
          <T size={14} color="muted" center>{topic.en}</T>
        </View>

        <View style={{ alignItems: "center", gap: 14 }}>
          <Ring size={ringSize} left={timer.left} total={timer.total} running={timer.running} />
          <Row style={{ justifyContent: "center" }}>
            <Btn title={timer.running ? "일시정지" : "재개"} variant="primary" onPress={timer.toggle} />
            <Btn title="공부 끝 → 퀴즈" onPress={skip} />
          </Row>
        </View>

        <TopicLinks topic={topic} />

        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T size={14} weight="semibold" color="ink2">공부 메모</T>
            <T size={12} color="muted">{saved ? "자동 저장됨 ✓" : "저장 중…"}</T>
          </Row>
          <TextInput
            value={memo}
            onChangeText={onMemo}
            multiline
            textAlignVertical="top"
            maxLength={5000}
            placeholder="정의, 동작 원리, 예시를 짧게 적어 두세요. 퀴즈를 푸는 동안에는 메모를 볼 수 없어요."
            placeholderTextColor={c.muted}
            style={{ minHeight: 150, borderWidth: 1, borderColor: c.line2, borderRadius: radius.md, backgroundColor: c.paper, padding: 12, fontSize: 16, lineHeight: 24, color: c.ink, fontFamily: FONT.regular }}
          />
        </View>

        <Pressable onPress={() => confirmQuit(() => { setActive(null); router.replace("/home"); })} style={{ alignSelf: "center" }} hitSlop={8}>
          <T size={14} color="muted" style={{ textDecorationLine: "underline" }}>그만두기</T>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
