import { useKeepScreenOn } from "@/lib/useKeepScreenOn";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, useWindowDimensions, View } from "react-native";
import { Ring } from "@/components/Ring";
import { StudyReader, type ReaderPage } from "@/components/StudyReader";
import { EXTEND_COST, EXTEND_SECONDS, TimeUpSheet } from "@/components/TimeUpSheet";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, levelTone, Row, Screen, T } from "@/components/ui";
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
  const { active, setActive, gears, spendGears } = useApp();
  const c = useColors();
  const { width } = useWindowDimensions();
  const topic = topicById(active!.topicId);
  // 앱 안 문서 창 (웹에서는 react-native-webview가 없어서 새 탭으로 엶)
  const [reader, setReader] = useState<ReaderPage | null>(null);

  const goQuiz = useCallback(() => {
    setActive((a) => (a ? { ...a, stage: "quiz", endAt: null } : a));
    router.replace("/quiz");
  }, [setActive]);

  // 공부 시간이 끝나면 보고 있던 문서 창을 강제로 닫고 '시간 추가 / 퀴즈' 창을 띄움
  const timer = useStageTimer("study", useCallback(() => {
    setReader(null);
    setActive((a) => (a ? { ...a, studyLeft: 0, studyUsed: a.studyTotal } : a));
  }, [setActive]));
  // 앱을 껐다 켜도 시간이 끝난 상태면 같은 창이 다시 뜸
  const timeUp = !timer.running && timer.left <= 0;
  const extend = () => {
    if (spendGears(EXTEND_COST)) timer.extend(EXTEND_SECONDS);
  };

  // 처음 들어오면 바로 시작하고, 퀴즈를 미리 받아 둠 (공부 시작 버튼에서 이미 시작했으면 그대로 씀, 앱을 다시 켠 경우 대비)
  useEffect(() => {
    if (timer.fresh) timer.start();
    if (topic) prefetchQuiz(topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    const { left, used } = timer.stop();
    setActive((a) => (a ? { ...a, studyLeft: left, studyUsed: used } : a));
    goQuiz();
  };

  if (!topic) return null;
  const ringSize = Math.min(220, width * 0.5);

  return (
    <>
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
            <Btn title={timer.running ? "일시정지" : "공부 시작"} variant={timer.running ? "accent" : "primary"} onPress={timer.toggle} />
            <Btn title="공부 끝 → 퀴즈" onPress={skip} />
          </Row>
        </View>

        <TopicLinks topic={topic} onOpen={Platform.OS === "web" ? undefined : (url, title) => setReader({ url, title })} />


        <Pressable onPress={() => confirmQuit(() => { setActive(null); router.replace("/home"); })} style={{ alignSelf: "center" }} hitSlop={8}>
          <T size={14} color="muted" style={{ textDecorationLine: "underline" }}>그만두기</T>
        </Pressable>
      </Screen>
      <TimeUpSheet visible={timeUp} gears={gears} onExtend={extend} onQuiz={goQuiz} />
      <StudyReader page={reader} left={timer.left} total={timer.total} running={timer.running} onClose={() => setReader(null)} />
    </>
  );
}
