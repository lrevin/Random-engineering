import { useMemo } from "react";
import { View } from "react-native";
import { bestStreak } from "@/lib/achievements";
import { useApp } from "@/lib/app-state";
import { MILESTONES, type Milestone } from "@/lib/milestones";
import { addSkin, addTitle, markMilestone, skinById, titleById, useCosmetics } from "@/lib/skins";
import { radius, raised, useColors } from "@/theme";
import { Icon } from "./Icon";
import { ProgressBar } from "./Quests";
import { Btn, Card, T } from "./ui";

/** 연속 기록 마일스톤: 최고 연속 일수 · 받을 수 있는 보상 · 받기 */
export function useMilestones() {
  const { records, keptDays, claimQuest } = useApp();
  const { milestones } = useCosmetics();
  const best = useMemo(() => bestStreak(records, keptDays), [records, keptDays]);
  const claimed = (m: Milestone) => milestones.includes(m.days);
  const ready = MILESTONES.filter((m) => best >= m.days && !claimed(m)).length;
  const claim = async (m: Milestone) => {
    if (best < m.days) return false;
    if(!await claimQuest(`streak-milestone:${m.days}`, m.gears)||!markMilestone(m.days))return false;
    addSkin(m.skin, false);
    addTitle(m.title);
    return true;
  };
  return { best, claimed, ready, claim };
}

/** 퀘스트 화면(일일 탭)에 놓는 연속 기록 보상 카드 */
export function MilestoneCard({ onGot }: { onGot: (gears: number) => void }) {
  const c = useColors();
  const m = useMilestones();
  return (
    <Card style={{ gap: 4, paddingVertical: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="flame" size={26} />
        <T size={17} weight="bold" style={{ flex: 1 }}>연속 기록 보상</T>
        <T size={13} color="muted">최고 {m.best}일</T>
      </View>
      <T size={13} color="ink2">연속으로 공부한 날이 쌓이면 상자와 한정 스킨·칭호를 받아요.</T>
      {MILESTONES.map((x, i) => {
        const got = m.claimed(x);
        const can = m.best >= x.days && !got;
        const skin = skinById(x.skin);
        return (
          <View key={x.days} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, marginTop: i ? 6 : 8 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center",
              backgroundColor: skin.body ?? c.slot, ...raised(skin.edge ?? c.slotEdge, false, 3),
            }}>
              <Icon name={got ? "chest-open" : "chest"} size={32} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T size={15} weight="bold">연속 {x.days}일</T>
              <T size={12} color="muted">톱니바퀴 {x.gears} · {skin.name} 스킨 · 칭호 {`"${titleById(x.title)?.name ?? ""}"`}</T>
              <ProgressBar value={m.best} goal={x.days} unit="일" color={m.best >= x.days ? c.success : c.flame} />
            </View>
            {got ? (
              <View style={{ width: 64, alignItems: "center", gap: 2 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.success, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="check" size={16} color="#ffffff" />
                </View>
                <T size={11} color="muted">받음</T>
              </View>
            ) : can ? (
              <View style={{ width: 64 }}>
                <Btn title="열기" size="sm" variant="accent" onPress={async () => { if (await m.claim(x)) onGot(x.gears); }} />
              </View>
            ) : (
              <View style={{ width: 64, alignItems: "center", gap: 2, borderRadius: radius.md }}>
                <Icon name="lock" size={22} color={c.muted} />
                <T size={11} color="muted">{x.days - m.best}일 남음</T>
              </View>
            )}
          </View>
        );
      })}
    </Card>
  );
}
