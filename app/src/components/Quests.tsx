import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { dailyQuests, QUEST_BONUS, questKey, type Quest } from "@/lib/quests";
import { radius, raised, shadow, useColors } from "@/theme";
import { Icon } from "./Icon";
import { T, tap } from "./ui";

/** 오늘의 퀘스트 + 받은 상태를 한 번에 */
export function useQuests() {
  const { records, questClaims, claimQuest } = useApp();
  // 날짜가 바뀌면 records·claims가 바뀔 때 다시 계산됨 (자정에 화면을 켜 둔 경우는 다음 렌더 때 반영)
  const day = new Date().toDateString();
  const quests = useMemo(() => dailyQuests(records), [records, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const claimed = (id: string) => questClaims.includes(questKey(id));
  const doneCount = quests.filter((q) => q.done).length;
  const allDone = doneCount === quests.length;
  const bonusClaimed = claimed("bonus");
  const ready = quests.filter((q) => q.done && !claimed(q.id)).length + (allDone && !bonusClaimed ? 1 : 0);
  return {
    quests, claimed, doneCount, allDone, bonusClaimed, ready,
    claim: (q: Quest) => q.done && claimQuest(questKey(q.id), q.reward),
    claimBonus: () => allDone && claimQuest(questKey("bonus"), QUEST_BONUS),
  };
}

/** 진행 막대 (가운데에 7 / 10 글자) */
export function ProgressBar({ value, goal, color, height = 18 }: { value: number; goal: number; color?: string; height?: number }) {
  const c = useColors();
  const p = Math.min(1, goal ? value / goal : 0);
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: c.chip, overflow: "hidden", justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(p * 100)}%`, backgroundColor: color ?? c.gold, borderRadius: radius.pill }} />
      <T size={11} weight="bold" center style={{ lineHeight: height, color: p >= 1 ? "#ffffff" : c.ink }}>{Math.min(value, goal).toLocaleString()} / {goal.toLocaleString()}</T>
    </View>
  );
}

/** 퀘스트 한 줄: 그림 + 이름 + 진행 막대 + 보상(받기 버튼) */
export function QuestRow({ q, claimed, onClaim, last }: { q: Quest; claimed: boolean; onClaim: () => void; last?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>
        <Icon name={q.icon} size={30} color={c.success} />
      </View>
      <View style={{ flex: 1, gap: 7 }}>
        <T size={16} weight="bold">{q.title}</T>
        <ProgressBar value={q.value} goal={q.goal} color={q.done ? c.success : c.gold} />
      </View>
      {claimed ? (
        <View style={{ width: 64, alignItems: "center", gap: 2 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.success, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={16} color="#ffffff" />
          </View>
          <T size={11} color="muted">받음</T>
        </View>
      ) : q.done ? (
        <Pressable
          onPress={() => { tap(); onClaim(); }}
          accessibilityRole="button"
          accessibilityLabel={`보상 톱니바퀴 ${q.reward}개 받기`}
          style={({ pressed }) => ({
            width: 64, paddingVertical: 8, borderRadius: radius.md, alignItems: "center", gap: 2,
            backgroundColor: c.accent, ...raised(c.accentDeep, pressed), ...(!pressed ? shadow(c, 1) : null),
          })}
        >
          <Icon name="gear" size={20} />
          <T size={13} weight="bold" style={{ color: "#ffffff" }}>받기</T>
        </Pressable>
      ) : (
        <View style={{ width: 64, alignItems: "center", gap: 2 }}>
          <Icon name="gear" size={24} />
          <T size={13} weight="bold" color="ink2">+{q.reward}</T>
        </View>
      )}
    </View>
  );
}

/** 홈에 놓는 한 줄 요약. 누르면 퀘스트 화면 */
export function QuestSummary() {
  const c = useColors();
  const { doneCount, quests, ready, allDone, bonusClaimed } = useQuests();
  return (
    <Pressable
      onPress={() => { tap(); router.push("/quests"); }}
      accessibilityRole="button"
      accessibilityLabel={`오늘의 퀘스트 ${doneCount}/${quests.length} 완료${ready ? `, 받을 보상 ${ready}개` : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14,
        borderRadius: radius.md, borderWidth: 1, borderColor: ready ? c.accent : c.line, backgroundColor: c.paper,
        ...raised(ready ? c.accentDeep : c.paperEdge, pressed, 3), ...(!pressed ? shadow(c, 1) : null),
      })}
    >
      <Icon name={allDone && bonusClaimed ? "chest-open" : "chest"} size={34} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T size={14} weight="bold">오늘의 퀘스트</T>
          <T size={12} weight="semibold" color={ready ? "accent" : "muted"}>{ready ? `받을 보상 ${ready}개 ›` : allDone ? "모두 완료!" : `${doneCount} / ${quests.length} 완료 ›`}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {quests.map((q) => (
            <View key={q.id} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: q.done ? c.success : c.chip }} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}
