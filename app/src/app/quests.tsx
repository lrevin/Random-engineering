import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { ProgressBar, QuestRow, useQuests } from "@/components/Quests";
import { GearCount } from "@/components/TimeUpSheet";
import { Btn, Card, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { QUEST_BONUS, untilMidnight } from "@/lib/quests";
import { radius, useColors } from "@/theme";

/** 오늘의 퀘스트: 매일 자정에 새 퀘스트 3개, 보상은 톱니바퀴 */
export default function Quests() {
  const c = useColors();
  const { gears } = useApp();
  const { quests, claimed, claim, doneCount, allDone, bonusClaimed, claimBonus } = useQuests();
  const [left, setLeft] = useState(untilMidnight());
  const [got, setGot] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setLeft(untilMidnight()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (got === null) return;
    const t = setTimeout(() => setGot(null), 1800);
    return () => clearTimeout(t);
  }, [got]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {/* 위: 빨간 띠 + 남은 시간 + 보너스 상자 */}
        <View style={{ backgroundColor: "#e0453a", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 64 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
              <Icon name="close" size={24} color="#ffffff" />
            </Pressable>
            <View style={{ backgroundColor: "rgba(255,255,255,0.92)", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
              <GearCount n={gears} size={15} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T size={28} weight="bold" style={{ color: "#ffffff" }}>오늘의 퀘스트</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="clock" size={18} />
                <T size={14} weight="semibold" style={{ color: "#ffe9e4" }}>{left} 남음 · 자정에 새 퀘스트</T>
              </View>
            </View>
            <Icon name={allDone && bonusClaimed ? "chest-open" : "chest"} size={76} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 18, marginTop: -44, maxWidth: 640, width: "100%", alignSelf: "center" }}>
          {/* 모두 완료 보너스 */}
          <Card style={{ gap: 10 }}>
            <T size={17} weight="bold">퀘스트 3개 모두 끝내기</T>
            <ProgressBar value={doneCount} goal={quests.length} color={allDone ? c.success : c.gold} height={20} />
            {bonusClaimed ? (
              <T size={13} color="success" weight="semibold">보너스 톱니바퀴 {QUEST_BONUS}개를 받았어요. 내일 또 만나요!</T>
            ) : allDone ? (
              <Btn title={`보너스 상자 열기 · 톱니바퀴 ${QUEST_BONUS}개`} variant="accent" icon={<Icon name="chest-open" size={24} />} onPress={() => { if (claimBonus()) setGot(QUEST_BONUS); }} />
            ) : (
              <T size={13} color="muted">다 끝내면 보너스 상자에서 톱니바퀴 {QUEST_BONUS}개를 더 받아요.</T>
            )}
          </Card>

          {/* 퀘스트 목록 */}
          <Card style={{ paddingVertical: 2 }}>
            {quests.map((q, i) => (
              <QuestRow key={q.id} q={q} claimed={claimed(q.id)} onClaim={() => { if (claim(q)) setGot(q.reward); }} last={i === quests.length - 1} />
            ))}
          </Card>

          <View style={{ backgroundColor: c.chip, borderRadius: radius.md, padding: 14, gap: 4 }}>
            <T size={14} weight="semibold">톱니바퀴는 어디에 쓰나요?</T>
            <T size={13} color="ink2">연속 기록 보호권(20개), 끊긴 연속 기록 복구(하루 20개), 공부 시간 2분 추가(10개)에 쓸 수 있어요.</T>
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
