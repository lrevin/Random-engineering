import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { addPending, pickGearTarget, registerGearTarget, takeGearSource, type Pt } from "@/lib/gear-fly";
import { sfx } from "@/lib/sfx";
import { Icon } from "./Icon";

const SIZE = 26;

/** 톱니바퀴 개수 칸을 감싸면 날아온 톱니바퀴의 도착점이 되고, 하나 도착할 때마다 통 튐 */
export function GearTarget({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);
  const [scale] = useState(() => new Animated.Value(1));
  const reg = useRef<ReturnType<typeof registerGearTarget> | null>(null);
  useEffect(() => {
    reg.current = registerGearTarget({
      focused: true,
      measure: () => new Promise((res) => {
        const v = ref.current;
        if (!v) return res(null);
        v.measureInWindow((x, y, width, height) => res({ x, y, width, height }));
      }),
      pulse: () => {
        scale.stopAnimation();
        scale.setValue(1.28);
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
      },
    });
    return () => reg.current?.remove();
  }, [scale]);
  // 다른 화면으로 가면(탭 이동 · 위에 화면이 열림) 도착점 후보에서 빠짐
  useFocusEffect(useCallback(() => {
    reg.current?.focus(true);
    return () => reg.current?.focus(false);
  }, []));
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View ref={ref} collapsable={false}>{children}</View>
    </Animated.View>
  );
}

interface Particle { id: number; from: Pt; burst: Pt; to: Pt; delay: number; spin: number; land: () => void }

/** 톱니바퀴 한 개: 터져 나왔다가 곡선을 그리며 개수 칸으로 빨려 들어감 */
function GearParticle({ p }: { p: Particle }) {
  const [v] = useState(() => ({
    x: new Animated.Value(p.from.x), y: new Animated.Value(p.from.y),
    scale: new Animated.Value(0.3), opacity: new Animated.Value(0), rot: new Animated.Value(0),
  }));
  useEffect(() => {
    const out = Easing.out(Easing.cubic);
    const fly = 540;
    Animated.parallel([
      Animated.timing(v.rot, { toValue: 1, duration: 300 + p.delay + fly, easing: Easing.linear, useNativeDriver: true }),
      Animated.sequence([
        // 1) 받은 곳에서 사방으로 톡 터짐
        Animated.parallel([
          Animated.timing(v.x, { toValue: p.burst.x, duration: 300, easing: out, useNativeDriver: true }),
          Animated.timing(v.y, { toValue: p.burst.y, duration: 300, easing: out, useNativeDriver: true }),
          Animated.timing(v.scale, { toValue: 1.15, duration: 300, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
          Animated.timing(v.opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]),
        Animated.delay(p.delay),
        // 2) 살짝 뒤로 물러났다가(back) 가속하며 개수 칸으로 쏙: x · y 속도를 다르게 줘서 곡선으로 날아감
        Animated.parallel([
          Animated.timing(v.x, { toValue: p.to.x, duration: fly, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v.y, { toValue: p.to.y, duration: fly, easing: Easing.in(Easing.back(1.7)), useNativeDriver: true }),
          Animated.timing(v.scale, { toValue: 0.6, duration: fly, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => p.land());
  }, [p, v]);
  const rotate = v.rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] });
  return (
    <Animated.View style={{
      position: "absolute", left: -SIZE / 2, top: -SIZE / 2, opacity: v.opacity,
      transform: [{ translateX: v.x }, { translateY: v.y }, { scale: v.scale }, { rotate }],
    }}>
      <Icon name="gear" size={SIZE} />
    </Animated.View>
  );
}

/** 루트에 하나: 톱니바퀴가 늘어나면 받은 곳 → 개수 칸으로 날아가는 연출을 그림 (터치는 막지 않음) */
export function GearFlyLayer() {
  const { gears } = useApp();
  const prev = useRef(gears);
  const nextId = useRef(1);
  const [parts, setParts] = useState<Particle[]>([]);

  useEffect(() => {
    const before = prev.current;
    prev.current = gears;
    const delta = gears - before;
    if (delta <= 0 || delta > 5000) return;
    const from = takeGearSource();
    if (!from) return; // 누르지 않았는데 늘어난 경우(서버 동기화 등)는 연출 없이
    addPending(delta);
    const burst = { remaining: delta };
    const settle = (n: number) => { const k = Math.min(n, burst.remaining); burst.remaining -= k; if (k) addPending(-k); };
    // 혹시 연출이 끊겨도 개수 칸 숫자는 반드시 맞춤
    const guard = setTimeout(() => settle(burst.remaining), 4000);
    void pickGearTarget().then(({ p: to, pulse }) => {
      const n = Math.max(3, Math.min(12, Math.round(delta / 3)));
      const share = (i: number) => Math.floor(delta / n) + (i < delta % n ? 1 : 0);
      let landed = 0;
      const made: Particle[] = Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5; // 위쪽 위주로 퍼짐
        const r = 45 + Math.random() * 55;
        const id = nextId.current++;
        return {
          id, from, to,
          burst: { x: from.x + Math.cos(a) * r, y: from.y + Math.sin(a) * r },
          delay: i * 45 + Math.random() * 60,
          spin: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 300),
          land: () => {
            settle(share(i));
            pulse();
            landed++;
            sfx(landed === n ? "gear" : "tick", landed === n ? 1 : 0.45);
            if (landed === n) clearTimeout(guard);
            setParts((ps) => ps.filter((x) => x.id !== id));
          },
        };
      });
      setParts((ps) => [...ps, ...made]);
    });
  }, [gears]);

  if (!parts.length) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}>
      {parts.map((p) => <GearParticle key={p.id} p={p} />)}
    </View>
  );
}
