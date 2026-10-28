import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { radius, useColors } from "@/theme";
import { tap } from "./ui";

const ROD = 84;

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
      <View style={{
        flex: 1, backgroundColor: c.slot, borderRadius: radius.lg + 6, padding: 12, paddingTop: 10, gap: 10,
        borderBottomWidth: 6, borderBottomColor: c.slotEdge,
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
        <View style={{ backgroundColor: c.slotWindow, borderRadius: radius.lg - 4, minHeight: 220, justifyContent: "center", alignItems: "center", paddingVertical: 18, paddingHorizontal: 22, overflow: "hidden" }}>
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
        style={{ width: 40, height: 160, justifyContent: "flex-end", paddingBottom: 30, opacity: disabled ? 0.5 : 1 }}
      >
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.accent, marginLeft: 10, borderBottomWidth: 3, borderBottomColor: c.accentDeep }} />
        <Animated.View style={{ width: 7, height: rod, backgroundColor: c.lever, marginLeft: 21 }} />
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 12, height: 30, borderRadius: 5, backgroundColor: c.lever, marginTop: -12 }} />
          <View style={{ width: 16, height: 7, backgroundColor: c.lever }} />
        </View>
      </Pressable>
    </View>
  );
}
