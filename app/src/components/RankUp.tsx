import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Animated, Easing, Modal, Platform, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { TIERS } from "@/lib/rank";
import { Icon, TierIcon } from "./Icon";
import { Btn, T } from "./ui";

/** 승급 연출 한 장면: 레벨 업 또는 주제 랭크 승급 */
export type RankUpScene =
  | { kind: "level"; from: number; to: number }
  | { kind: "tier"; from: number; to: number; topic: string };

const CONFETTI = ["#f7b500", "#e0453a", "#3d6fd8", "#2f8f5b", "#a05bd1", "#fffaf0"];
const PIECES = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 37) % 100,
  delay: (i * 83) % 600,
  size: 7 + ((i * 13) % 7),
  color: CONFETTI[i % CONFETTI.length],
  spin: i % 2 ? 1 : -1,
}));

/** 뒤에서 천천히 도는 빛줄기 */
function Rays({ color }: { color: string }) {
  const n = 12;
  const d = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const b = a + Math.PI / n / 1.6;
    return `M150 150L${150 + 150 * Math.cos(a)} ${150 + 150 * Math.sin(a)}L${150 + 150 * Math.cos(b)} ${150 + 150 * Math.sin(b)}Z`;
  }).join("");
  return (
    <Svg width={300} height={300} viewBox="0 0 300 300">
      <Path d={d} fill={color} opacity={0.35} />
    </Svg>
  );
}

/**
 * 승급 연출 (듀오링고식): 어두운 바탕 + 도는 빛줄기 + 이전 메달이 작아지며 사라지고 새 메달이 튀어나옴 + 색종이.
 * scenes를 차례로 보여 주고, 다 보면 onDone.
 */
export function RankUp({ scenes, onDone }: { scenes: RankUpScene[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const scene = scenes[i];
  if (!scene) return null;
  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => (i + 1 < scenes.length ? setI(i + 1) : onDone())}>
      <Scene key={i} scene={scene} last={i + 1 >= scenes.length} onNext={() => (i + 1 < scenes.length ? setI(i + 1) : onDone())} />
    </Modal>
  );
}

function Scene({ scene, last, onNext }: { scene: RankUpScene; last: boolean; onNext: () => void }) {
  const [v] = useState(() => ({
    bg: new Animated.Value(0),
    old: new Animated.Value(1),
    pop: new Animated.Value(0),
    spin: new Animated.Value(0),
    text: new Animated.Value(0),
    fall: new Animated.Value(0),
  }));
  const tier = scene.kind === "tier" ? TIERS[scene.to] : null;
  const color = tier ? tier.color : "#f7b500";

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const spin = Animated.loop(Animated.timing(v.spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    spin.start();
    Animated.sequence([
      Animated.timing(v.bg, { toValue: 1, duration: 220, useNativeDriver: true }),
      // 이전 메달: 살짝 흔들리다 작아지며 사라짐
      Animated.timing(v.old, { toValue: 0, duration: 380, easing: Easing.in(Easing.back(2)), useNativeDriver: true }),
      // 새 메달: 크게 튀어나왔다 제자리
      Animated.spring(v.pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.parallel([
        Animated.timing(v.text, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
        Animated.timing(v.fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }, 650);
    return () => { spin.stop(); clearTimeout(t); };
  }, [v]);

  const rotate = v.spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const medal = (index: number, size: number) =>
    scene.kind === "tier" ? <TierIcon index={index} size={size} /> : <Icon name="star" size={size} />;
  const title = scene.kind === "tier" ? `${TIERS[scene.to].name} 승급!` : "레벨 업!";
  const sub = scene.kind === "tier"
    ? `${scene.topic} · ${scene.from >= 0 ? `${TIERS[scene.from].name} → ` : ""}${TIERS[scene.to].name}`
    : `${scene.from}레벨 → ${scene.to}레벨`;

  return (
    <Animated.View style={{ flex: 1, backgroundColor: "#0e1424", alignItems: "center", justifyContent: "center", padding: 28, opacity: v.bg }}>
      {/* 색종이 */}
      {PIECES.map((p, k) => (
        <Animated.View
          key={k}
          pointerEvents="none"
          style={{
            position: "absolute", top: -20, left: `${p.x}%`, width: p.size, height: p.size * 1.6, borderRadius: 2, backgroundColor: p.color,
            opacity: v.fall.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: v.fall.interpolate({ inputRange: [0, 1], outputRange: [0, 700 + p.delay] }) },
              { rotate: v.fall.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin * (360 + p.delay)}deg`] }) },
            ],
          }}
        />
      ))}

      <View style={{ width: 300, height: 300, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={{ position: "absolute", transform: [{ rotate }], opacity: v.pop }}>
          <Rays color={color} />
        </Animated.View>
        {/* 이전 메달 */}
        {(scene.kind === "level" || scene.from >= 0) && (
          <Animated.View style={{ position: "absolute", opacity: v.old, transform: [{ scale: v.old }] }}>
            {scene.kind === "level" ? (
              <View style={{ alignItems: "center" }}>{medal(0, 120)}<T size={34} weight="bold" style={{ color: "#fffaf0" }}>{scene.from}</T></View>
            ) : medal(scene.from, 140)}
          </Animated.View>
        )}
        {/* 새 메달 */}
        <Animated.View style={{
          alignItems: "center",
          transform: [
            { scale: v.pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
            { rotate: v.pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: ["-25deg", "8deg", "0deg"] }) },
          ],
          opacity: v.pop.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
        }}>
          {scene.kind === "level" ? (
            <View style={{ alignItems: "center" }}>{medal(0, 150)}<T size={44} weight="bold" style={{ color: "#f7b500", lineHeight: 52 }}>{scene.to}</T></View>
          ) : medal(scene.to, 170)}
        </Animated.View>
      </View>

      <Animated.View style={{
        alignItems: "center", gap: 8, marginTop: 8, opacity: v.text,
        transform: [{ translateY: v.text.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}>
        <T size={36} weight="bold" center style={{ color }}>{title}</T>
        <T size={16} center style={{ color: "#e6e9f2" }}>{sub}</T>
      </Animated.View>

      <Animated.View style={{ position: "absolute", left: 28, right: 28, bottom: 48, opacity: v.text }}>
        <Btn title={last ? "계속" : "다음"} variant="accent" size="lg" onPress={onNext} />
      </Animated.View>
    </Animated.View>
  );
}
