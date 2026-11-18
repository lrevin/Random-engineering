import { View } from "react-native";
import { useColors } from "@/theme";
import { T } from "./ui";

const AVATAR_COLORS = ["#3d6fd8", "#e0453a", "#2f8f5b", "#a05bd1", "#e07a1f", "#16a39a", "#d14d8b"];

/** 닉네임 첫 글자 동그라미 (UID마다 색이 정해짐) + 접속 중 점 */
export function FriendAvatar({ name, uid, size = 44, online, me }: { name: string; uid: string; size?: number; online?: boolean; me?: boolean }) {
  const c = useColors();
  const color = me ? "#f7b500" : AVATAR_COLORS[[...uid].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
        <T size={Math.round(size * 0.42)} weight="bold" style={{ color: me ? "#1d2742" : "#ffffff", lineHeight: Math.round(size * 0.55) }}>{name.slice(0, 1)}</T>
      </View>
      {online !== undefined && (
        <View style={{ position: "absolute", right: -1, bottom: -1, width: size * 0.32, height: size * 0.32, borderRadius: size, borderWidth: 2.5, borderColor: c.paper, backgroundColor: online ? c.success : c.line2 }} />
      )}
    </View>
  );
}
