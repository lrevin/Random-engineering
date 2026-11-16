import { View } from "react-native";
import type { TitleDef } from "@/lib/skins";
import { radius } from "@/theme";
import { Icon } from "./Icon";
import { T } from "./ui";

/** 칭호 배지 (프로필 · 칭호 화면). size에 맞춰 여백 · 메달 크기도 함께 커짐 */
export function TitleBadge({ t, size = 13, dim }: { t: TitleDef; size?: number; dim?: boolean }) {
  return (
    <View style={{
      alignSelf: "center", flexDirection: "row", alignItems: "center", gap: Math.round(size * 0.35),
      borderRadius: radius.pill, paddingHorizontal: Math.round(size * 0.8), paddingVertical: Math.round(size * 0.28),
      backgroundColor: dim ? "#9aa0ad" : t.color, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
    }}>
      <Icon name="medal" size={Math.round(size * 1.3)} />
      <T size={size} weight="bold" style={{ color: "#ffffff" }}>{t.name}</T>
    </View>
  );
}
