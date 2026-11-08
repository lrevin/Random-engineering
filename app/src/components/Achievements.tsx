import { View } from "react-native";
import Svg, { Circle, G, Path, Polygon, Rect } from "react-native-svg";
import type { Achievement, AchievementId } from "@/lib/achievements";
import { useColors } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { ProgressBar } from "./Quests";
import { T } from "./ui";

const LOOK: Record<AchievementId, { icon: IconName; color: string; deep: string }> = {
  streak: { icon: "flame", color: "#ff8a1f", deep: "#c4600c" },
  topics: { icon: "book", color: "#3d8bdf", deep: "#2a67ad" },
  perfect: { icon: "target", color: "#e0453a", deep: "#b02d26" },
  engineer: { icon: "gear", color: "#6b7a90", deep: "#4c586b" },
  battle: { icon: "swords", color: "#a05bd1", deep: "#7a3fa6" },
  level: { icon: "star", color: "#f2a900", deep: "#c07f00" },
};

/** 업적 배지: 방패 모양 바탕 + 그림 + 아래 리본에 단계 숫자. 잠긴 건 회색 */
export function AchievementBadge({ a, size = 76 }: { a: Achievement; size?: number }) {
  const look = LOOK[a.id];
  const locked = a.stage === 0;
  const color = locked ? "#c9ccd6" : look.color;
  const deep = locked ? "#9aa0b0" : look.deep;
  const shown = locked ? a.goals[0] : a.goals[a.stage - 1];
  return (
    <View style={{ width: size, height: size * 1.1, alignItems: "center" }}>
      <Svg width={size} height={size * 1.1} viewBox="0 0 64 70">
        <Path d="M32 3l25 9v20c0 17-11 28-25 34C18 60 7 49 7 32V12z" fill={deep} />
        <Path d="M32 1l25 9v19c0 17-11 27-25 33C18 56 7 46 7 29V10z" fill={color} />
        <Path d="M32 1l25 9v19c0 17-11 27-25 33z" fill="#000" opacity={0.08} />
        <Circle cx={32} cy={28} r={15} fill="#fffaf0" opacity={locked ? 0.55 : 0.95} />
        {!locked && (
          <G>
            <Rect x={12} y={53} width={40} height={14} rx={7} fill="#1d2742" />
            <Polygon points="12,56 6,60 12,64" fill="#0e1424" />
            <Polygon points="52,56 58,60 52,64" fill="#0e1424" />
          </G>
        )}
      </Svg>
      <View style={{ position: "absolute", top: size * 0.25, opacity: locked ? 0.55 : 1 }}>
        <Icon name={locked ? "lock" : look.icon} size={size * 0.34} />
      </View>
      {!locked && (
        <View style={{ position: "absolute", top: size * 0.83, width: size, alignItems: "center" }}>
          <T size={Math.round(size * 0.15)} weight="bold" style={{ color: "#f7b500", lineHeight: Math.round(size * 0.2) }}>{shown}</T>
        </View>
      )}
    </View>
  );
}

/** 업적 한 줄: 배지 + 이름 + 다음 목표 진행 막대 (퀘스트 목록처럼) */
export function AchievementRow({ a, last }: { a: Achievement; last?: boolean }) {
  const c = useColors();
  const goal = a.next ?? a.goals[a.goals.length - 1];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <AchievementBadge a={a} size={58} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T size={16} weight="bold">{a.title}</T>
          <T size={12} color="muted">{a.stage} / {a.goals.length}단계</T>
        </View>
        <T size={13} color="ink2">{a.next ? a.desc.replace("{n}", a.next.toLocaleString()) : "모든 단계를 달성했어요!"}</T>
        <ProgressBar value={a.value} goal={goal} color={a.next ? c.gold : c.success} />
      </View>
    </View>
  );
}
