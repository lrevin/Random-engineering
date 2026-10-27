import { View } from "react-native";
import { TIERS, userRank } from "@/lib/rank";
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

/** 내 랭크 카드: 현재 랭크 + 다음 랭크까지 진행 막대 */
export function UserRankBar({ rp, compact }: { rp: number; compact?: boolean }) {
  const c = useColors();
  const r = userRank(rp);
  const nextTier = r.index + 1 < TIERS.length ? TIERS[r.index + 1] : null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TierBadge index={r.index} size={compact ? "sm" : "md"} />
        <T size={compact ? 12 : 13} color="muted">
          {nextTier ? `${nextTier.emoji} ${nextTier.name}까지 ${r.toNext} RP` : "최고 랭크 달성!"}
        </T>
      </View>
      <View style={{ height: compact ? 6 : 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
        <View style={{ width: `${Math.round(r.progress * 100)}%`, height: "100%", backgroundColor: r.tier.color, borderRadius: 5 }} />
      </View>
      {!compact && <T size={12} color="muted">누적 {r.rp.toLocaleString()} RP</T>}
    </View>
  );
}
