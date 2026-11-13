import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { domainById, levelText, type Topic } from "@/data";
import { useApp } from "@/lib/app-state";
import { domainMastery, maxRpFor } from "@/lib/rank";
import { DAILY_MIN_CORRECT, DAILY_TOPIC_GEARS, dailyDone, dailyKey, dailyTopic } from "@/lib/daily";
import { studyMinutesFor } from "@/lib/economy";
import { prefetchQuiz } from "@/lib/quiz";
import { dueTopics, readRecallLog, type RecallLog } from "@/lib/recall";
import { radius, raised, shadow, useColors } from "@/theme";
import { useMilestones } from "./Milestones";
import { useQuests } from "./Quests";
import { DomainIcon, Icon } from "./Icon";
import { Badge, Btn, levelTone, T, tap } from "./ui";
import { TierBadge } from "./Rank";

/** 홈의 두 칸: 오늘의 주제 · 오늘의 복습 */
export function TodayRow() {
  const { records, active, setActive, prefs, premium, questClaims, claimQuest, uid } = useApp();
  const c = useColors();
  const day = new Date().toDateString();
  const topic = useMemo(() => dailyTopic(uid, prefs.interests), [uid, prefs.interests, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = dailyDone(topic, records);
  const claimed = questClaims.includes(dailyKey());
  const [log, setLog] = useState<RecallLog>({});
  const [open, setOpen] = useState(false);
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
    setOpen(true);
  };

  const startDaily = () => {
    if (!topic) return;
    setOpen(false);
    const min = studyMinutesFor(prefs.studyMinutes, premium);
    prefetchQuiz(topic);
    setActive({
      topicId: topic.id, stage: "study", memo: "",
      studyTotal: min * 60, studyLeft: min * 60, studyUsed: 0,
      quizOnly: false, quiz: null, result: null, startedAt: new Date().toISOString(), endAt: null,
    });
    router.push("/study");
  };


  const tile = (pressed: boolean, hot: boolean) => ({
    flex: 1, alignItems: "center" as const, gap: 2, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: radius.md, borderWidth: 1, borderColor: hot ? c.accent : c.line, backgroundColor: c.paper,
    ...raised(hot ? c.accentDeep : c.paperEdge, pressed, 3), ...(!pressed ? shadow(c, 1) : null),
  });
  /** 세 칸 모양을 똑같이: 그림 · 이름 · 값 · 아래 한 줄 */
  const body = (icon: ReactNode, label: string, value: string, sub: string, subColor: "accent" | "success" | "muted" | "ink2", gear?: boolean, lines = 1) => (
    <>
      <View style={{ height: 32, justifyContent: "center" }}>{icon}</View>
      <T size={11} color="muted" numberOfLines={1}>{label}</T>
      {lines > 1 ? (
        // 한글은 글자 단위로 줄이 바뀌어서, 단어 단위로 끊기게 단어마다 따로 놓음 (최대 lines줄)
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 4, maxHeight: 18 * lines, overflow: "hidden" }}>
          {value.split(" ").map((w, i) => <T key={i} size={14} weight="bold" style={{ lineHeight: 18 }}>{w}</T>)}
        </View>
      ) : (
        <T size={14} weight="bold" numberOfLines={1} center style={{ lineHeight: 18 }}>{value}</T>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        {gear && <Icon name="gear" size={14} />}
        <T size={11} weight="semibold" color={subColor} numberOfLines={1}>{sub}</T>
      </View>
    </>
  );

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {topic && <DailySheet open={open} topic={topic} onClose={() => setOpen(false)} onStart={startDaily} />}
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
            claimed ? "완료" : done ? `받기 +${DAILY_TOPIC_GEARS}` : `+${DAILY_TOPIC_GEARS}`,
            claimed ? "success" : done ? "accent" : "ink2",
            !claimed,
            2,
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

/** 오늘의 주제 카드: 슬롯머신 안에 나오는 모양 그대로 + 보상 조건 */
function DailySheet({ open, topic, onClose, onStart }: { open: boolean; topic: Topic; onClose: () => void; onStart: () => void }) {
  const c = useColors();
  const { records } = useApp();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.6)", justifyContent: "center", padding: 24 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.slot, borderRadius: radius.lg + 4, padding: 10, gap: 8, borderBottomWidth: 6, borderBottomColor: c.slotEdge, maxWidth: 420, width: "100%", alignSelf: "center", ...shadow(c, 3) }}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}>
            {[c.gold, c.accent, c.gold].map((col, i) => <View key={i} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: col }} />)}
          </View>
          <View style={{ backgroundColor: c.slotWindow, borderRadius: radius.lg - 4, paddingVertical: 22, paddingHorizontal: 20, alignItems: "center", gap: 8 }}>
            <T size={13} weight="bold" color="accent">오늘의 주제</T>
            <View style={{ flexDirection: "row", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              <Badge label={topic.categoryName} icon={<DomainIcon id={topic.domain} size={20} />} />
              <Badge label={levelText(topic.lv)} tone={levelTone(topic.level)} />
            </View>
            <T size={30} weight="bold" center style={{ letterSpacing: -0.6, lineHeight: 38 }}>{topic.ko}</T>
            <T size={14} color="muted" center>{topic.en}</T>
            {/* 한글이 글자 단위로 끊기지 않게 단어 단위로 */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 4 }}>
              {topic.hint.split(" ").map((w, i) => <T key={i} size={15} color="ink2">{w}</T>)}
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <TierBadge index={domainMastery(topic.domain, records).index} prefix={domainById(topic.domain)?.name} size="sm" />
              <T size={12} color="muted">퀴즈 최대 +{maxRpFor(topic)} XP</T>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: c.goldSoft }}>
              <Icon name="gear" size={20} />
              <T size={13} weight="semibold">퀴즈를 {DAILY_MIN_CORRECT}개 이상 맞히면 톱니바퀴 {DAILY_TOPIC_GEARS}개</T>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn title="나중에" onPress={onClose} style={{ flex: 1 }} />
            <Btn title="공부 시작" variant="accent" onPress={onStart} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
