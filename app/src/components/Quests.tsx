import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { readExamStore } from "@/lib/exam";
import { ATTENDANCE, NO_EXTRA, PERIODS, questKey, questsFor, type Period, type Quest, type QuestExtra } from "@/lib/quests";
import { readDone } from "@/lib/review";
import { radius, raised, shadow, useColors } from "@/theme";
import { Icon } from "./Icon";
import { T, tap } from "./ui";

/** 한 기간(일일·주간·이달)의 퀘스트 + 받은 상태 */
export function useQuests(period: Period) {
  const { records, questClaims, claimQuest, premium } = useApp();
  // 프리미엄 퀘스트는 모의고사 결과·해결한 오답도 봄 (화면에 돌아올 때마다 다시 읽음)
  const [extra, setExtra] = useState<QuestExtra>(NO_EXTRA);
  useFocusEffect(useCallback(() => {
    if (period !== "premium") return;
    let alive = true;
    Promise.all([readExamStore(), readDone()]).then(([s, d]) => { if (alive) setExtra({ exams: s.results, solvedAt: Object.values(d) }); });
    return () => { alive = false; };
  }, [period]));
  /** 프리미엄 탭인데 무료 회원이면 잠김 (진행은 보이지만 보상은 못 받음) */
  const locked = period === "premium" && !premium;
  // 날짜가 바뀌면 다음 렌더 때 새 기간으로 계산됨
  const day = new Date().toDateString();
  const quests = useMemo(() => questsFor(period, records, new Date(), extra), [period, records, day, extra]); // eslint-disable-line react-hooks/exhaustive-deps
  const claimed = (id: string) => questClaims.includes(questKey(period, id));
  const doneCount = quests.filter((q) => q.done).length;
  const allDone = doneCount === quests.length;
  const bonusClaimed = claimed("bonus");
  // 출석은 일일 탭에만 (3개 모두 끝내기에는 안 셈)
  const attendance = period === "day" ? ATTENDANCE : null;
  const ready = locked ? 0 : quests.filter((q) => q.done && !claimed(q.id)).length + (allDone && !bonusClaimed ? 1 : 0) + (attendance && !claimed(attendance.id) ? 1 : 0);
  const bonus = PERIODS[period].bonus;
  return {
    quests, claimed, doneCount, allDone, bonusClaimed, ready, bonus, attendance, locked,
    claim: (q: Quest) => !locked && q.done && claimQuest(questKey(period, q.id), q.reward),
    claimBonus: () => !locked && allDone && claimQuest(questKey(period, "bonus"), bonus),
  };
}

/** 진행 막대 + 오른쪽에 7 / 10 (다크 모드에서도 잘 보이게 숫자는 막대 밖에) */
export function ProgressBar({ value, goal, color, height = 14, unit = "" }: { value: number; goal: number; color?: string; height?: number; unit?: string }) {
  const c = useColors();
  const p = Math.min(1, goal ? value / goal : 0);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, height, borderRadius: radius.pill, backgroundColor: c.chip, overflow: "hidden" }}>
        <View style={{ width: `${Math.round(p * 100)}%`, height: "100%", backgroundColor: color ?? c.gold, borderRadius: radius.pill }} />
      </View>
      <T size={12} weight="bold" color={p >= 1 ? "success" : "ink2"}>{Math.min(value, goal).toLocaleString()} / {goal.toLocaleString()}{unit}</T>
    </View>
  );
}

/** 퀘스트 한 줄: 그림 + 이름 + 진행 막대 + 보상(받기 버튼) */
export function QuestRow({ q, claimed, onClaim, last, locked }: { q: Quest; claimed: boolean; onClaim: () => void; last?: boolean; locked?: boolean }) {
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
      ) : q.done && !locked ? (
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
          <Icon name={locked ? "lock" : "gear"} size={24} color={locked ? c.muted : undefined} />
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
  const p = useQuests("premium");
  const ready = d.ready + w.ready + m.ready + p.ready;
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
