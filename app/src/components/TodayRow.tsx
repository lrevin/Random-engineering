import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { DAILY_TOPIC_GEARS, dailyDone, dailyKey, dailyTopic } from "@/lib/daily";
import { studyMinutesFor } from "@/lib/economy";
import { prefetchQuiz } from "@/lib/quiz";
import { dueTopics, readRecallLog, type RecallLog } from "@/lib/recall";
import { radius, raised, shadow, useColors } from "@/theme";
import { showDialog } from "./Dialog";
import { useMilestones } from "./Milestones";
import { useQuests } from "./Quests";
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
  // 퀘스트 칸: 오늘 진행 + 일일·주간·이달·프리미엄·연속 기록 보상 중 받을 것
  const q = useQuests("day");
  const w = useQuests("week");
  const m = useQuests("month");
  const p = useQuests("premium");
  const ms = useMilestones();
  const ready = q.ready + w.ready + m.ready + p.ready + ms.ready;

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
    flex: 1, alignItems: "center" as const, gap: 2, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: radius.md, borderWidth: 1, borderColor: hot ? c.accent : c.line, backgroundColor: c.paper,
    ...raised(hot ? c.accentDeep : c.paperEdge, pressed, 3), ...(!pressed ? shadow(c, 1) : null),
  });
  /** 세 칸 모양을 똑같이: 그림 · 이름 · 값 · 아래 한 줄 */
  const body = (icon: ReactNode, label: string, value: string, sub: string, subColor: "accent" | "success" | "muted" | "ink2") => (
    <>
      <View style={{ height: 32, justifyContent: "center" }}>{icon}</View>
      <T size={11} color="muted" numberOfLines={1}>{label}</T>
      <T size={14} weight="bold" numberOfLines={1} center>{value}</T>
      <T size={11} weight="semibold" color={subColor} numberOfLines={1}>{sub}</T>
    </>
  );

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Pressable onPress={() => { tap(); router.push("/quests"); }} accessibilityRole="button" accessibilityLabel={`퀘스트 ${q.doneCount}/${q.quests.length} 완료${ready ? `, 받을 보상 ${ready}개` : ""}`} style={({ pressed }) => tile(pressed, ready > 0)}>
        {body(
          <Icon name={q.allDone && q.bonusClaimed ? "chest-open" : "chest"} size={32} />,
          "퀘스트",
          `오늘 ${q.doneCount} / ${q.quests.length}`,
          ready ? `받을 보상 ${ready}개 ›` : q.allDone ? "오늘 완료!" : "보러 가기 ›",
          ready ? "accent" : q.allDone ? "success" : "ink2",
        )}
      </Pressable>
      <Pressable onPress={onDaily} accessibilityRole="button" accessibilityLabel={topic ? `오늘의 주제 ${topic.ko}` : "관심 분야 고르기"} style={({ pressed }) => tile(pressed, done && !claimed)}>
        {topic
          ? body(
            <DomainIcon id={topic.domain} size={30} />,
            "오늘의 주제",
            topic.ko,
            claimed ? "완료" : done ? `보상 받기 +${DAILY_TOPIC_GEARS}` : `톱니바퀴 +${DAILY_TOPIC_GEARS}`,
            claimed ? "success" : done ? "accent" : "ink2",
          )
          : body(<Icon name="star" size={30} />, "오늘의 주제", "관심 분야 필요", "고르러 가기 ›", "accent")}
      </Pressable>
      <Pressable onPress={() => { tap(); router.push("/recall"); }} accessibilityRole="button" accessibilityLabel={`오늘 복습할 주제 ${due}개`} style={({ pressed }) => tile(pressed, due > 0)}>
        {body(
          <Icon name={due ? "book" : "check"} size={30} color={due ? undefined : c.success} />,
          "오늘의 복습",
          due ? `${due}개 주제` : "다 했어요",
          due ? "잊기 전에 복습 ›" : "2일마다 돌아와요",
          due ? "accent" : "muted",
        )}
      </Pressable>
    </View>
  );
}
