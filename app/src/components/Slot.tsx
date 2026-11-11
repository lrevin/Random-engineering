import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, PanResponder, Text, View } from "react-native";
import { useSkins } from "@/lib/skins";
import { radius, shadow, useColors } from "@/theme";
import { FONT, tap } from "./ui";

const ROD = 70;
/** 레버를 끝까지 당겼을 때 막대 길이 / 이만큼 넘게 당기고 놓으면 뽑기 */
const ROD_MIN = 12;
const PULL_AT = 0.6;
const LEVER_W = 36;

/** 로고와 같은 슬롯머신 틀: 불빛 3개 + 릴 창 + 당첨선 + 레버(당기면 onPull) */
export function Slot({ children, spinning, onPull, disabled }: {
  children: ReactNode; spinning?: boolean; onPull?: () => void; disabled?: boolean;
}) {
  const c = useColors();
  // 스킨: 정한 색이 없으면 앱 테마 기본색
  const skin = useSkins().active;
  const body = skin.body ?? c.slot;
  const edge = skin.edge ?? c.slotEdge;
  const leverColor = skin.lever ?? c.lever;
  const knob = skin.knob ?? c.accent;
  const knobDeep = skin.knobDeep ?? c.accentDeep;
  const pointer = skin.pointer ?? c.gold;
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

  // 끝까지 내렸다가 튕기듯 올라오며 뽑기 (버튼처럼 톡 눌렀을 때 · 손을 놓았을 때)
  const release = (from?: number) => {
    const travel = ROD - ROD_MIN;
    Animated.sequence([
      Animated.timing(rod, { toValue: ROD_MIN, duration: from === undefined ? 150 : 70, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      Animated.spring(rod, { toValue: ROD, friction: 3.5, tension: 120, useNativeDriver: false }),
    ]).start();
    setTimeout(() => onPull?.(), from === undefined ? 150 : Math.max(0, 70 * (1 - from / travel)));
  };
  const pull = () => {
    if (disabled) return;
    tap();
    release();
  };

  // 손가락을 따라 레버가 내려옴
  const pan = leverPan(rod, { disabled, pull, release });

  const lights = skin.lights ? [skin.lights[0], skin.lights[1], skin.lights[0]] : [c.gold, c.accent, c.gold];
  const triangle = (side: "left" | "right") => (
    <View style={{
      position: "absolute", top: "50%", marginTop: -8, [side]: 0, width: 0, height: 0,
      borderTopWidth: 8, borderBottomWidth: 8, borderTopColor: "transparent", borderBottomColor: "transparent",
      [side === "left" ? "borderLeftWidth" : "borderRightWidth"]: 11,
      [side === "left" ? "borderLeftColor" : "borderRightColor"]: pointer,
    }} />
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {/* 레버와 같은 폭의 빈칸: 몸체(글자)가 화면 가운데에 오게 */}
      <View style={{ width: LEVER_W }} />
      <View style={{
        flex: 1, backgroundColor: body, borderRadius: radius.lg + 4, padding: 10, paddingTop: 9, gap: 8,
        borderBottomWidth: 6, borderBottomColor: edge, ...shadow(c, 3),
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
        <View style={{ backgroundColor: c.slotWindow, borderRadius: radius.lg - 4, minHeight: 330, justifyContent: "center", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20, overflow: "hidden", boxShadow: "inset 0px 6px 10px rgba(0, 0, 0, 0.18)" }}>
          {children}
          {triangle("left")}
          {triangle("right")}
        </View>
        <View style={{ alignSelf: "center", width: 64, height: 6, borderRadius: 3, backgroundColor: edge }} />
      </View>

      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel="레버 당겨서 주제 뽑기"
        accessibilityHint="아래로 끌어내리거나 눌러서 뽑아요"
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={pull}
        hitSlop={10}
        style={{ width: LEVER_W, height: 140, justifyContent: "flex-end", paddingBottom: 26, opacity: disabled ? 0.5 : 1 }}
      >
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: knob, marginLeft: 6, borderBottomWidth: 3, borderBottomColor: knobDeep, ...shadow(c, 1) }} />
        <Animated.View style={{ width: 7, height: rod, backgroundColor: leverColor, marginLeft: 17 }} />
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 10, height: 28, borderRadius: 5, backgroundColor: leverColor, marginTop: -11 }} />
          <View style={{ width: 14, height: 7, backgroundColor: leverColor }} />
        </View>
      </View>
    </View>
  );
}

/** 레버 끌어내리기: 막대 길이 = ROD - 끌어내린 거리. 뽑히는 지점을 넘으면 딸깍, 넘긴 채 놓으면 뽑기 */
function leverPan(rod: Animated.Value, h: { disabled?: boolean; pull: () => void; release: (from: number) => void }) {
  const travel = ROD - ROD_MIN;
  const springBack = () => Animated.spring(rod, { toValue: ROD, friction: 5, useNativeDriver: false }).start();
  let passed = false;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => !h.disabled,
    onMoveShouldSetPanResponder: () => !h.disabled,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => { rod.stopAnimation(); passed = false; },
    onPanResponderMove: (_, g) => {
      const d = Math.min(travel, Math.max(0, g.dy));
      rod.setValue(ROD - d);
      if (!passed && d >= travel * PULL_AT) { passed = true; tap(); }
      else if (passed && d < travel * PULL_AT) passed = false;
    },
    onPanResponderRelease: (_, g) => {
      const d = Math.min(travel, Math.max(0, g.dy));
      if (Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6) return h.pull(); // 그냥 톡 누름
      if (d >= travel * PULL_AT) h.release(d);
      else springBack();
    },
    onPanResponderTerminate: springBack,
  });
}

const ITEM_H = 76;

/**
 * 진짜 슬롯머신처럼 주제 이름들이 위에서 아래로 굴러가다 마지막 하나(names[0])가 당첨선에 멈춤.
 * 릴 창 안에 꽉 차게 겹쳐 그리며, 돌 때마다 key를 바꿔 새로 만듦.
 */
export function SlotReel({ names, duration = 2300, onDone }: { names: string[]; duration?: number; onDone: () => void }) {
  const c = useColors();
  const [h, setH] = useState(0);
  const [y] = useState(() => new Animated.Value(0));

  // 창의 위아래가 비어 보이지 않게 앞뒤로 채움 이름을 붙임 (당첨 이름은 위아래로 다른 이름에 둘러싸여 가운데에 멈춤)
  const pad = Math.ceil(h / ITEM_H / 2) + 1;
  const [items] = useState(() => {
    const fill = (n: number, from: number) => Array.from({ length: n }, (_, i) => names[1 + ((from + i) % Math.max(1, names.length - 1))] ?? names[0]);
    return { before: fill(8, 5), after: fill(8, 11) };
  });
  const list = [...items.before.slice(0, pad), ...names, ...items.after.slice(0, pad)];
  // 맨 아래(names 끝)에서 시작해 당첨 이름(names[0])이 가운데 오도록 아래로 내려옴
  const center = (h - ITEM_H) / 2 - pad * ITEM_H;
  const startY = center - (names.length - 1) * ITEM_H;

  useEffect(() => {
    if (!h) return;
    y.setValue(startY);
    const anim = Animated.sequence([
      Animated.timing(y, { toValue: center + 16, duration, easing: Easing.bezier(0.12, 0.7, 0.3, 1), useNativeDriver: true }),
      Animated.spring(y, { toValue: center, friction: 5, tension: 160, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => { if (finished) onDone(); });
    return () => anim.stop();
    // 한 번만 돌림 (돌 때마다 부모가 key를 바꿔 새로 만듦)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {h > 0 && (
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, transform: [{ translateY: y }] }}>
          {list.map((n, i) => (
            <View key={i} style={{ height: ITEM_H, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FONT.bold, fontSize: 30, color: c.ink, letterSpacing: -0.8 }}>{n}</Text>
            </View>
          ))}
        </Animated.View>
      )}
      {/* 원통처럼 보이게 위아래를 어둡게 */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "34%", backgroundColor: c.slot, opacity: 0.22 }} />
      <View pointerEvents="none" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "34%", backgroundColor: c.slot, opacity: 0.22 }} />
      {/* 당첨선 */}
      <View pointerEvents="none" style={{ position: "absolute", left: 14, right: 14, top: "50%", marginTop: -ITEM_H / 2, height: ITEM_H, borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.gold, opacity: 0.7 }} />
    </View>
  );
}
