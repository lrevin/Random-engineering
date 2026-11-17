import { Text, View } from "react-native";
import { FONT } from "./ui";
import { radius } from "@/theme";
import type { Palette } from "@/themes";

const grad = (color: string, g: string | null) => (g ? { backgroundColor: color, experimental_backgroundImage: g } : { backgroundColor: color });

/** 테마 미리 보기: 그 테마의 색으로 그린 작은 홈 화면 (그라데이션 바탕 · 슬롯머신 · 카드 · 강조 버튼) */
export function ThemePreview({ p }: { p: Palette }) {
  const reel = (col: string) => <View style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: col, opacity: 0.92 }} />;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ ...grad(p.bg, p.grad.bg), borderRadius: radius.lg - 4, padding: 14, flexDirection: "row", gap: 14, overflow: "hidden", borderWidth: 1, borderColor: p.line }}
    >
      {/* 미니 슬롯머신 */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 92, height: 112, borderRadius: 16, ...grad(p.slot, p.grad.hero), borderBottomWidth: 5, borderBottomColor: p.slotEdge, padding: 8, gap: 7 }}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {[p.gold, p.accent, p.gold].map((col, i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} />)}
          </View>
          <View style={{ flex: 1, borderRadius: 10, backgroundColor: p.slotWindow, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 }}>
            {reel(p.gold)}{reel(p.accent)}{reel(p.gold)}
          </View>
          <View style={{ alignSelf: "center", width: 30, height: 4, borderRadius: 2, backgroundColor: p.slotEdge }} />
        </View>
        <View style={{ width: 16, height: 78, alignItems: "center" }}>
          <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: p.accent }} />
          <View style={{ width: 4, height: 40, backgroundColor: p.lever }} />
          <View style={{ width: 10, height: 4, backgroundColor: p.lever, alignSelf: "flex-start" }} />
        </View>
      </View>

      {/* 카드 + 버튼 */}
      <View style={{ flex: 1, gap: 9, justifyContent: "center" }}>
        <View style={{ backgroundColor: p.paper, borderRadius: 12, borderWidth: 1, borderColor: p.line, borderBottomWidth: 3, borderBottomColor: p.paperEdge, padding: 10, gap: 6 }}>
          <Text style={{ fontFamily: FONT.bold, fontSize: 13, color: p.ink }}>오늘의 주제</Text>
          <Text style={{ fontFamily: FONT.regular, fontSize: 11, color: p.ink2 }}>트랜잭션 ACID</Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: p.chip, overflow: "hidden" }}>
            <View style={{ width: "64%", height: "100%", borderRadius: 3, backgroundColor: p.success }} />
          </View>
        </View>
        <View style={{ ...grad(p.accent, p.grad.accent), borderRadius: 12, borderBottomWidth: 3, borderBottomColor: p.accentDeep, paddingVertical: 8, alignItems: "center" }}>
          <Text style={{ fontFamily: FONT.semibold, fontSize: 12, color: p.accentInk }}>주제 뽑기</Text>
        </View>
      </View>
    </View>
  );
}

