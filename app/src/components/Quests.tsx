import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { ATTENDANCE, PERIODS, questKey, questsFor, type Period, type Quest } from "@/lib/quests";
import { radius, raised, shadow, useColors } from "@/theme";
import { Icon } from "./Icon";
import { T, tap } from "./ui";

/** 한 기간(일일·주간·이달)의 퀘스트 + 받은 상태 */
export function useQuests(period: Period) {
  const { records, questClaims, claimQuest } = useApp();
  // 날짜가 바뀌면 다음 렌더 때 새 기간으로 계산됨
  const day = new Date().toDateString();
  const quests = useMemo(() => questsFor(period, records), [period, records, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const claimed = (id: string) => questClaims.includes(questKey(period, id));
  const doneCount = quests.filter((q) => q.done).length;
  const allDone = doneCount === quests.length;
  const bonusClaimed = claimed("bonus");
  // 출석은 일일 탭에만 (3개 모두 끝내기에는 안 셈)
  const attendance = period === "day" ? ATTENDANCE : null;
  const ready = quests.filter((q) => q.done && !claimed(q.id)).length + (allDone && !bonusClaimed ? 1 : 0) + (attendance && !claimed(attendance.id) ? 1 : 0);
  const bonus = PERIODS[period].bonus;
  return {
    quests, claimed, doneCount, allDone, bonusClaimed, ready, bonus, attendance,
    claim: (q: Quest) => q.done && claimQuest(questKey(period, q.id), q.reward),
    claimBonus: () => allDone && claimQuest(questKey(period, "bonus"), bonus),
  };
}

/** 진행 막대 (가운데에 7 / 10 글자) */
export function ProgressBar({ value, goal, color, height = 18, unit = "" }: { value: number; goal: number; color?: string; height?: number; unit?: string }) {
  const c = useColors();
  const p = Math.min(1, goal ? value / goal : 0);
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: c.chip, overflow: "hidden", justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(p * 100)}%`, backgroundColor: color ?? c.gold, borderRadius: radius.pill }} />
      <T size={11} weight="bold" center style={{ lineHeight: height, color: p >= 1 ? "#ffffff" : c.ink }}>{Math.min(value, goal).toLocaleString()} / {goal.toLocaleString()}{unit}</T>
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
        <ProgressBar value={q.value} goal={q.goal} unit={q.unit} color={q.done ? c.success : c.gold} />
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

/** 홈에 놓는 한 줄 요약 (오늘 진행칸 + 일일·주간·이달 받을 보상 합). 누르면 퀘스트 화면 */
export function QuestSummary() {
  const c = useColors();
  const d = useQuests("day");
  const w = useQuests("week");
  const m = useQuests("month");
  const ready = d.ready + w.ready + m.ready;
  return (
    <Pressable
      onPress={() => { tap(); router.push("/quests"); }}
      accessibilityRole="button"
      accessibilityLabel={`오늘의 퀘스트 ${d.doneCount}/${d.quests.length} 완료${ready ? `, 받을 보상 ${ready}개` : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14,
        borderRadius: radius.md, borderWidth: 1, borderColor: ready ? c.accent : c.line, backgroundColor: c.paper,
        ...raised(ready ? c.accentDeep : c.paperEdge, pressed, 3), ...(!pressed ? shadow(c, 1) : null),
      })}
    >
      <Icon name={d.allDone && d.bonusClaimed ? "chest-open" : "chest"} size={34} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T size={14} weight="bold">퀘스트</T>
          <T size={12} weight="semibold" color={ready ? "accent" : "muted"}>{ready ? `받을 보상 ${ready}개 ›` : d.allDone ? "오늘 퀘스트 완료!" : `오늘 ${d.doneCount} / ${d.quests.length} 완료 ›`}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {d.quests.map((q) => (
            <View key={q.id} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: q.done ? c.success : c.chip }} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}
