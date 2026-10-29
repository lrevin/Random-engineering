import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { radius, shadow, useColors } from "@/theme";
import { tap } from "./ui";

const ROD = 70;
const LEVER_W = 36;

/** 로고와 같은 슬롯머신 틀: 불빛 3개 + 릴 창 + 당첨선 + 레버(당기면 onPull) */
export function Slot({ children, spinning, onPull, disabled }: {
  children: ReactNode; spinning?: boolean; onPull?: () => void; disabled?: boolean;
}) {
  const c = useColors();
  const [blink] = useState(() => new Animated.Value(0));
  const [rod] = useState(() => new Animated.Value(ROD));

  useEffect(() => {
    if (!spinning) {
      blink.stopAnimation();
      blink.setValue(0);
      return;
    }
    blink.setValue(1);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 2, duration: 160, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 160, easing: Easing.linear, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [spinning, blink]);

  const pull = () => {
    if (disabled) return;
    tap();
    Animated.sequence([
      Animated.timing(rod, { toValue: 30, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      Animated.spring(rod, { toValue: ROD, friction: 4, useNativeDriver: false }),
    ]).start();
    setTimeout(() => onPull?.(), 140);
  };

  const lights = [c.gold, c.accent, c.gold];
  const triangle = (side: "left" | "right") => (
    <View style={{
      position: "absolute", top: "50%", marginTop: -8, [side]: 0, width: 0, height: 0,
      borderTopWidth: 8, borderBottomWidth: 8, borderTopColor: "transparent", borderBottomColor: "transparent",
      [side === "left" ? "borderLeftWidth" : "borderRightWidth"]: 11,
      [side === "left" ? "borderLeftColor" : "borderRightColor"]: c.gold,
    }} />
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {/* 레버와 같은 폭의 빈칸: 몸체(글자)가 화면 가운데에 오게 */}
      <View style={{ width: LEVER_W }} />
      <View style={{
        flex: 1, backgroundColor: c.slot, borderRadius: radius.lg + 4, padding: 10, paddingTop: 9, gap: 8,
        borderBottomWidth: 6, borderBottomColor: c.slotEdge, ...shadow(c, 3),
      }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}>
          {lights.map((col, i) => (
            <Animated.View
              key={i}
              style={{
                width: 11, height: 11, borderRadius: 6, backgroundColor: col,
                // 0 = 멈춤(모두 켜짐), 1↔2 = 번갈아 깜빡임
                opacity: blink.interpolate({ inputRange: [0, 1, 2], outputRange: i === 1 ? [1, 1, 0.25] : [1, 0.25, 1] }),
              }}
            />
          ))}
        </View>
        <View style={{ backgroundColor: c.slotWindow, borderRadius: radius.lg - 4, minHeight: 210, justifyContent: "center", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20, overflow: "hidden", boxShadow: "inset 0px 6px 10px rgba(0, 0, 0, 0.18)" }}>
          {children}
          {triangle("left")}
          {triangle("right")}
        </View>
        <View style={{ alignSelf: "center", width: 64, height: 6, borderRadius: 3, backgroundColor: c.slotEdge }} />
      </View>

      <Pressable
        onPress={pull}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="레버 당겨서 주제 뽑기"
        hitSlop={10}
        style={{ width: LEVER_W, height: 140, justifyContent: "flex-end", paddingBottom: 26, opacity: disabled ? 0.5 : 1 }}
      >
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent, marginLeft: 6, borderBottomWidth: 3, borderBottomColor: c.accentDeep, ...shadow(c, 1) }} />
        <Animated.View style={{ width: 7, height: rod, backgroundColor: c.lever, marginLeft: 17 }} />
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 10, height: 28, borderRadius: 5, backgroundColor: c.lever, marginTop: -11 }} />
          <View style={{ width: 14, height: 7, backgroundColor: c.lever }} />
        </View>
      </Pressable>
    </View>
  );
}
