import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { DAILY_TOPIC_GEARS, dailyDone, dailyKey, dailyTopic } from "@/lib/daily";
import { studyMinutesFor } from "@/lib/economy";
import { prefetchQuiz } from "@/lib/quiz";
import { dueTopics, readRecallLog, type RecallLog } from "@/lib/recall";
import { radius, raised, shadow, useColors } from "@/theme";
import { showDialog } from "./Dialog";
import { DomainIcon, Icon } from "./Icon";
import { T, tap } from "./ui";

/** 홈의 두 칸: 오늘의 주제 · 오늘의 복습 */
export function TodayRow() {
  const { records, active, setActive, prefs, premium, questClaims, claimQuest, uid } = useApp();
  const c = useColors();
  const day = new Date().toDateString();
  const topic = useMemo(() => dailyTopic(uid, prefs.interests), [uid, prefs.interests, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = dailyDone(topic, records);
  const claimed = questClaims.includes(dailyKey());
  const [log, setLog] = useState<RecallLog>({});
  useFocusEffect(useCallback(() => { readRecallLog().then(setLog); }, []));
  const due = useMemo(() => dueTopics(records, log).length, [records, log]);

  const onDaily = () => {
    tap();
    if (!topic) return router.push("/interests");
    if (done && !claimed) {
      claimQuest(dailyKey(), DAILY_TOPIC_GEARS);
      return;
    }
    if (done || active) return;
    const min = studyMinutesFor(prefs.studyMinutes, premium);
    showDialog({
      icon: "star",
      title: `오늘의 주제: ${topic.ko}`,
      message: `${topic.categoryName} · ${topic.hint}\n${min}분 공부하고 퀴즈까지 끝내면 톱니바퀴 ${DAILY_TOPIC_GEARS}개를 받아요.`,
      buttons: [
        { text: "나중에", style: "cancel" },
        {
          text: "공부 시작",
          onPress: () => {
            prefetchQuiz(topic);
            setActive({
              topicId: topic.id, stage: "study", memo: "",
              studyTotal: min * 60, studyLeft: min * 60, studyUsed: 0,
              quizOnly: false, quiz: null, result: null, startedAt: new Date().toISOString(), endAt: null,
            });
            router.push("/study");
          },
        },
      ],
    });
  };

  const tile = (pressed: boolean, hot: boolean) => ({
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: hot ? c.accent : c.line, backgroundColor: c.paper,
    ...raised(hot ? c.accentDeep : c.paperEdge, pressed, 3), ...(!pressed ? shadow(c, 1) : null),
  });

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {!topic ? (
      <Pressable onPress={onDaily} accessibilityRole="button" accessibilityLabel="관심 분야 고르기" style={({ pressed }) => tile(pressed, false)}>
        <Icon name="star" size={30} />
        <View style={{ flex: 1 }}>
          <T size={11} color="muted">오늘의 주제</T>
          <T size={14} weight="bold" numberOfLines={1}>관심 분야 필요</T>
          <T size={11} weight="semibold" color="accent">고르러 가기 ›</T>
        </View>
      </Pressable>
      ) : (
      <Pressable onPress={onDaily} accessibilityRole="button" accessibilityLabel={`오늘의 주제 ${topic.ko}`} style={({ pressed }) => tile(pressed, done && !claimed)}>
        <DomainIcon id={topic.domain} size={30} />
        <View style={{ flex: 1 }}>
          <T size={11} color="muted">오늘의 주제</T>
          <T size={14} weight="bold" numberOfLines={1}>{topic.ko}</T>
          <T size={11} weight="semibold" color={claimed ? "success" : done ? "accent" : "ink2"}>
            {claimed ? "완료" : done ? `보상 받기 +${DAILY_TOPIC_GEARS}` : `톱니바퀴 +${DAILY_TOPIC_GEARS}`}
          </T>
        </View>
      </Pressable>
      )}
      <Pressable onPress={() => { tap(); router.push("/recall"); }} accessibilityRole="button" accessibilityLabel={`오늘 복습할 주제 ${due}개`} style={({ pressed }) => tile(pressed, due > 0)}>
        <Icon name={due ? "book" : "check"} size={30} color={due ? undefined : c.success} />
        <View style={{ flex: 1 }}>
          <T size={11} color="muted">오늘의 복습</T>
          <T size={14} weight="bold" numberOfLines={1}>{due ? `${due}개 주제` : "다 했어요"}</T>
          <T size={11} weight="semibold" color={due ? "accent" : "muted"}>{due ? "잊기 전에 복습 ›" : "2일마다 돌아와요"}</T>
        </View>
      </Pressable>
    </View>
  );
}
