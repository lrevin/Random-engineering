import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { ProgressBar, QuestRow, useQuests } from "@/components/Quests";
import { EXTEND_COST, GearCount } from "@/components/TimeUpSheet";
import { Btn, Card, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, FREEZE_COST, RESTORE_COST_PER_DAY } from "@/lib/economy";
import { PERIODS, untilEnd, type Period } from "@/lib/quests";
import { radius, useColors } from "@/theme";

const ORDER: Period[] = ["day", "week", "month"];
const RESET: Record<Period, string> = { day: "자정에 새 퀘스트", week: "월요일에 새 퀘스트", month: "1일에 새 퀘스트" };

/** 퀘스트: 일일 · 주간 · 이달 탭. 탭마다 띠 색과 보상 크기가 다름 */
export default function Quests() {
  const c = useColors();
  const { gears } = useApp();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Period>(ORDER.includes(params.tab as Period) ? (params.tab as Period) : "day");
  const all = { day: useQuests("day"), week: useQuests("week"), month: useQuests("month") };
  const q = all[tab];
  const def = PERIODS[tab];
  const [now, setNow] = useState(() => new Date());
  const [got, setGot] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (got === null) return;
    const t = setTimeout(() => setGot(null), 1800);
    return () => clearTimeout(t);
  }, [got]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: def.color }}>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* 위: 기간별 색 띠 + 탭 + 남은 시간 + 상자 */}
        <View style={{ backgroundColor: def.color, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 64 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
              <Icon name="close" size={24} color="#ffffff" />
            </Pressable>
            <View style={{ backgroundColor: c.paper, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
              <GearCount n={gears} size={15} />
            </View>
          </View>

          {/* 탭 */}
          <View style={{ flexDirection: "row", marginTop: 16, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: radius.pill, padding: 4 }}>
            {ORDER.map((p) => {
              const on = p === tab;
              const ready = all[p].ready;
              return (
                <Pressable
                  key={p}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${PERIODS[p].tab} 퀘스트${ready ? `, 받을 보상 ${ready}개` : ""}`}
                  onPress={() => { tap(); setTab(p); }}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center", backgroundColor: on ? "#ffffff" : "transparent" }}
                >
                  <T size={15} weight="bold" style={{ color: on ? PERIODS[p].color : "#ffffff" }}>{PERIODS[p].tab}</T>
                  {ready > 0 && (
                    <View style={{ position: "absolute", top: 2, right: 10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#f7b500", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                      <T size={11} weight="bold" style={{ color: "#1d2742", lineHeight: 14 }}>{ready}</T>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T size={28} weight="bold" style={{ color: "#ffffff" }}>{def.title}</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="clock" size={18} />
                <T size={14} weight="semibold" style={{ color: def.soft }}>{untilEnd(tab, now)} 남음 · {RESET[tab]}</T>
              </View>
            </View>
            <Icon name={q.allDone && q.bonusClaimed ? "chest-open" : "chest"} size={tab === "day" ? 72 : tab === "week" ? 80 : 88} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 18, marginTop: -44, maxWidth: 640, width: "100%", alignSelf: "center" }}>
          {/* 출석 (일일 탭) */}
          {q.attendance && (
            <Card style={{ paddingVertical: 2, borderTopWidth: 4, borderTopColor: def.color }}>
              <QuestRow q={q.attendance} claimed={q.claimed(q.attendance.id)} onClaim={() => { if (q.claim(q.attendance!)) setGot(q.attendance!.reward); }} last />
            </Card>
          )}

          {/* 모두 완료 보너스 */}
          <Card style={{ gap: 10, ...(q.attendance ? null : { borderTopWidth: 4, borderTopColor: def.color }) }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T size={17} weight="bold">퀘스트 {q.quests.length}개 모두 끝내기</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Icon name="gear" size={18} />
                <T size={14} weight="bold" color="ink2">+{q.bonus}</T>
              </View>
            </View>
            <ProgressBar value={q.doneCount} goal={q.quests.length} color={q.allDone ? c.success : c.gold} height={20} />
            {q.bonusClaimed ? (
              <T size={13} color="success" weight="semibold">보너스 톱니바퀴 {q.bonus}개를 받았어요.</T>
            ) : q.allDone ? (
              <Btn title={`보너스 상자 열기 · 톱니바퀴 ${q.bonus}개`} variant="accent" icon={<Icon name="chest-open" size={24} />} onPress={() => { if (q.claimBonus()) setGot(q.bonus); }} />
            ) : (
              <T size={13} color="muted">다 끝내면 보너스 상자에서 톱니바퀴 {q.bonus}개를 더 받아요.</T>
            )}
          </Card>

          {/* 퀘스트 목록 */}
          <Card style={{ paddingVertical: 2 }}>
            {q.quests.map((x, i) => (
              <QuestRow key={x.id} q={x} claimed={q.claimed(x.id)} onClaim={() => { if (q.claim(x)) setGot(x.reward); }} last={i === q.quests.length - 1} />
            ))}
          </Card>

          <View style={{ backgroundColor: c.chip, borderRadius: radius.md, padding: 14, gap: 4 }}>
            <T size={14} weight="semibold">톱니바퀴는 어디에 쓰나요?</T>
            <T size={13} color="ink2">
              배틀권({BATTLE_TICKET_COST}개), 연속 기록 보호권({FREEZE_COST}개), 끊긴 연속 기록 복구(하루 {RESTORE_COST_PER_DAY}개), 공부 시간 2분 추가({EXTEND_COST}개)에 쓸 수 있어요.
            </T>
          </View>
        </View>
      </ScrollView>

      {got !== null && (
        <View pointerEvents="none" style={{ position: "absolute", top: "42%", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1d2742", borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 12 }}>
          <Icon name="gear" size={28} />
          <T size={20} weight="bold" style={{ color: "#fffaf0" }}>+{got}</T>
        </View>
      )}
    </SafeAreaView>
  );
}
