import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Icon } from "./Icon";
import { Row, T } from "./ui";
import { radius, shadow, useColors } from "@/theme";

/** 체크 표시 한 줄 */
export function Perk({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Row gap={10} style={{ flexWrap: "nowrap" }}>
      <Icon name="check" size={16} color={c.success} />
      <T size={15} style={{ flex: 1 }}>{children}</T>
    </Row>
  );
}

/** 요금제·아이템 카드: (있으면) 위에 색 띠 + 이름 + 설명 + 오른쪽 그림 + 아래 버튼 */
export function PlanCard({ ribbon, title, art, children, footer, highlight }: {
  ribbon?: string; title: string; art: ReactNode; children: ReactNode; footer?: ReactNode; highlight?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{
      borderRadius: radius.lg, borderWidth: 2, borderColor: highlight ? c.accent : c.line, borderBottomWidth: 5,
      borderBottomColor: highlight ? c.accentDeep : c.paperEdge, backgroundColor: c.paper, overflow: "hidden", ...shadow(c, 2),
    }}>
      {ribbon ? (
        <View style={{ height: 34, justifyContent: "center", paddingHorizontal: 16 }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={highlight ? "ribA" : "ribB"} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={highlight ? "#e0453a" : "#1d2742"} />
                <Stop offset="1" stopColor={highlight ? "#f7b500" : "#46506b"} />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="10" fill={highlight ? "url(#ribA)" : "url(#ribB)"} />
          </Svg>
          </View>
          <T size={14} weight="bold" style={{ color: "#ffffff" }}>{ribbon}</T>
        </View>
      ) : null}
      <View style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 10 }}>
            <T size={21} weight="bold">{title}</T>
            {children}
          </View>
          <View style={{ paddingTop: 4 }}>{art}</View>
        </View>
        {footer}
      </View>
    </View>
  );
}
