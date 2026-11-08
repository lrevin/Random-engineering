import type { ReactNode } from "react";
import { View } from "react-native";
import { radius, useColors } from "@/theme";
import { T } from "./ui";

/** 학습 현황 칸: 왼쪽 그림 + 큰 숫자 + 설명 (2칸씩 나란히) */
export function StatTile({ icon, value, label, dim }: { icon: ReactNode; value: string; label: string; dim?: boolean }) {
  const c = useColors();
  return (
    <View style={{
      width: "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10,
      paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md,
      borderWidth: 2, borderColor: c.line, borderBottomWidth: 4, borderBottomColor: c.paperEdge, backgroundColor: c.paper,
    }}>
      <View style={{ opacity: dim ? 0.4 : 1 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <T size={19} weight="bold" numberOfLines={1} adjustsFontSizeToFit>{value}</T>
        <T size={12} color="muted" numberOfLines={1}>{label}</T>
      </View>
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>;
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
      <T size={18} weight="bold">{title}</T>
      {right}
    </View>
  );
}
