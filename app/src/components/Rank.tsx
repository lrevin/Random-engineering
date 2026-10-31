import { View } from "react-native";
import { MAX_LEVEL, TIERS, userLevel } from "@/lib/rank";
import { radius, useColors } from "@/theme";
import { T } from "./ui";

/** 랭크 배지: 🥇 골드 */
export function TierBadge({ index, size = "md", suffix }: { index: number; size?: "sm" | "md"; suffix?: string }) {
  const c = useColors();
  if (index < 0) {
    return (
      <View style={{ borderWidth: 1, borderColor: c.line2, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
        <T size={12} color="muted">랭크 없음</T>
      </View>
    );
  }
  const t = TIERS[index];
  const fs = size === "sm" ? 12 : 14;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill,
      paddingHorizontal: size === "sm" ? 8 : 10, paddingVertical: size === "sm" ? 1 : 3,
      backgroundColor: t.color + "22", borderWidth: 1, borderColor: t.color,
    }}>
      <T size={fs}>{t.emoji}</T>
      <T size={fs} weight="semibold" style={{ color: t.color }}>{t.name}{suffix ? ` ${suffix}` : ""}</T>
    </View>
  );
}

/** 레벨 배지: ⭐ 23 */
export function LevelBadge({ level, size = "md" }: { level: number; size?: "sm" | "md" | "lg" }) {
  const c = useColors();
  const fs = size === "sm" ? 12 : size === "lg" ? 22 : 14;
  const max = level >= MAX_LEVEL;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill,
      paddingHorizontal: size === "lg" ? 16 : size === "sm" ? 8 : 10, paddingVertical: size === "lg" ? 6 : size === "sm" ? 1 : 3,
      backgroundColor: c.goldSoft, borderWidth: 1, borderColor: c.gold, borderBottomWidth: 3, borderBottomColor: c.goldDeep,
    }}>
      <T size={fs}>⭐</T>
      <T size={fs} weight="bold" color="ink">{max ? "MAX" : `${level}레벨`}</T>
    </View>
  );
}

/** 내 레벨 카드: 현재 레벨 + 다음 레벨까지 경험치 막대 */
export function UserLevelBar({ xp, compact }: { xp: number; compact?: boolean }) {
  const c = useColors();
  const l = userLevel(xp);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <LevelBadge level={l.level} size={compact ? "sm" : "md"} />
        <T size={compact ? 12 : 13} color="muted">
          {l.need ? `${l.level + 1}레벨까지 ${l.toNext.toLocaleString()} XP` : "최고 레벨 달성!"}
        </T>
      </View>
      <View style={{ height: compact ? 6 : 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
        <View style={{ width: `${Math.round(l.progress * 100)}%`, height: "100%", backgroundColor: c.gold, borderRadius: 5 }} />
      </View>
      {!compact && (
        <T size={12} color="muted">
          {l.need ? `${l.into.toLocaleString()} / ${l.need.toLocaleString()} XP · ` : ""}누적 {l.xp.toLocaleString()} XP
        </T>
      )}
    </View>
  );
}
