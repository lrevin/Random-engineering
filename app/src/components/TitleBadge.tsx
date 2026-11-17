import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Stop } from "react-native-svg";
import type { TitleDef, TitleRarity } from "@/lib/skins";
import type { Colors } from "@/theme";
import { Icon } from "./Icon";

/**
 * 칭호 엠블럼 (게임 업적 아이콘처럼, 글자 없음): 깎인 보석 같은 육각 크리스탈 + 가운데 큰 그림.
 * 테두리를 면마다 다른 밝기로 칠해 입체감을 내고, 가운데 판에도 결정면을 넣음.
 *  - 희귀: 사파이어 크리스탈 · 은빛 테
 *  - 영웅: 자수정 크리스탈 · 꼭짓점 사이 가시 장식 · 반짝이
 *  - 전설: 진홍 보석 · 황금 테 · 황금 날개 · 왕관 장식 · 뒤쪽 빛살 · 빛줄기
 *  - 신화: 우주빛 보석 · 진주빛 무지개 테 · 날개 · 후광 고리 · 빛살 · 빛줄기 · 반짝이
 * dim이면 아직 못 받은 칭호(회색, 효과 없음). size는 예전 글자 크기 기준이라 엠블럼 높이 ≈ size × 4.2.
 */
export const RARITY_LABEL: Record<TitleRarity, string> = { rare: "희귀", epic: "영웅", legendary: "전설", mythic: "신화" };

interface Look {
  rim: [string, string, string];
  face: [string, string, string];
  glow: string;
  ornament: "none" | "spikes" | "wings" | "halo";
  rays: boolean;
  shine: boolean;
  sparkle: boolean;
}

const LOOKS: Record<TitleRarity | "dim", Look> = {
  rare: {
    rim: ["#f4faff", "#a9c9ea", "#4f6f99"], face: ["#7fd8ff", "#2b8ee6", "#123f8c"], glow: "#4fb0ff",
    ornament: "none", rays: false, shine: false, sparkle: false,
  },
  epic: {
    rim: ["#fdf6ff", "#d6b6f7", "#7f55b8"], face: ["#e0b0ff", "#9b4ff0", "#4c1793"], glow: "#b56dff",
    ornament: "spikes", rays: false, shine: false, sparkle: true,
  },
  legendary: {
    rim: ["#fff7cf", "#ffcc45", "#a8680a"], face: ["#ff8a5c", "#e23f2c", "#7d140e"], glow: "#ffb23a",
    ornament: "wings", rays: true, shine: true, sparkle: true,
  },
  mythic: {
    rim: ["#ffffff", "#f1d4ff", "#8fcaff"], face: ["#7f8cff", "#4b23b8", "#14093d"], glow: "#c98cff",
    ornament: "halo", rays: true, shine: true, sparkle: true,
  },
  dim: {
    rim: ["#f3f4f7", "#c9cdd5", "#8f95a2"], face: ["#c3c8d1", "#a0a6b2", "#7c8290"], glow: "#b0b5c0",
    ornament: "none", rays: false, shine: false, sparkle: false,
  },
};

/** 칭호 화면 위쪽 등급 꼬리표 색 */
export function rarityColors(_c: Colors, rarity: TitleRarity) {
  const l = LOOKS[rarity];
  return { bg: l.face[1], edge: l.face[2], ink: "#ffffff" };
}

// ───────── 그림 좌표: 160 × 140 칸, 육각형 가운데 (80, 74) ─────────
const CX = 80, CY = 74, R = 44, RI = 33;
const hex = (r: number) => Array.from({ length: 6 }, (_, k) => {
  const a = (Math.PI / 180) * (-90 + 60 * k);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
});
const pts = (p: readonly (readonly [number, number])[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** 테두리 면 밝기: 왼쪽 위에서 빛이 옴 (0 어두움 ~ 1 밝음) */
function bevelLight(k: number) {
  const mid = (-90 + 60 * k + 30) * (Math.PI / 180);
  const light = (-135) * (Math.PI / 180);
  return (Math.cos(mid - light) + 1) / 2;
}

function Twinkle({ x, y, s, delay, color }: { x: number; y: number; s: number; delay: number; color: string }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(1600 - delay),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: x - s, top: y - s, opacity: v, transform: [{ scale }] }}>
      <Svg width={s * 2} height={s * 2} viewBox="-10 -10 20 20">
        <Path d="M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

export function TitleBadge({ t, size = 13, dim }: { t: TitleDef; size?: number; dim?: boolean }) {
  const look = LOOKS[dim ? "dim" : t.rarity];
  const H = Math.round(size * 4.2);
  const W = Math.round((H * 160) / 140);
  const k = H / 140; // 그림 좌표 → 화면 px
  const uid = `${t.id}-${dim ? "d" : "a"}`;

  // 뒤쪽 빛 번짐 숨쉬기 · 빛살 회전 · 빛줄기
  const [pulse] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (dim) return;
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      ...(look.rays ? [Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }))] : []),
      ...(look.shine ? [Animated.loop(Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]))] : []),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dim, look.rays, look.shine, pulse, spin, sweep]);

  const outer = hex(R), inner = hex(RI);
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const faceW = RI * 2 * k;
  const tx = sweep.interpolate({ inputRange: [0, 1], outputRange: [-faceW, faceW * 1.3] });
  const metal = (b: number) => (b > 0.66 ? look.rim[0] : b > 0.33 ? look.rim[1] : look.rim[2]);

  return (
    <View style={{ width: W, height: H, alignSelf: "center" }} accessibilityLabel={`${RARITY_LABEL[t.rarity]} 칭호 ${t.name}`}>
      {/* 뒤쪽 빛 번짐 */}
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: dim ? 0.25 : glowOpacity, transform: [{ scale: glowScale }] }}>
        <Svg width={W} height={H} viewBox="0 0 160 140">
          <Defs>
            <RadialGradient id={`aura-${uid}`} cx="0.5" cy="0.53" r="0.5">
              <Stop offset="0" stopColor={look.glow} stopOpacity={0.75} /><Stop offset="0.55" stopColor={look.glow} stopOpacity={0.28} /><Stop offset="1" stopColor={look.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={CX} cy={CY} r={68} fill={`url(#aura-${uid})`} />
        </Svg>
      </Animated.View>

      {/* 전설 · 신화: 천천히 도는 빛살 */}
      {look.rays && (
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: (CX - 70) * k, top: (CY - 70) * k, width: 140 * k, height: 140 * k, transform: [{ rotate }] }}>
          <Svg width={140 * k} height={140 * k} viewBox="-70 -70 140 140">
            <Defs>
              <RadialGradient id={`ray-${uid}`} cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0.3" stopColor="#ffffff" stopOpacity={0.55} /><Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {Array.from({ length: 12 }, (_, i) => (
              <Polygon key={i} points="0,0 -5,-68 5,-68" fill={`url(#ray-${uid})`} transform={`rotate(${i * 30})`} />
            ))}
          </Svg>
        </Animated.View>
      )}

      <Svg width={W} height={H} viewBox="0 0 160 140" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={`face-${uid}`} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={look.face[0]} /><Stop offset="0.5" stopColor={look.face[1]} /><Stop offset="1" stopColor={look.face[2]} />
          </LinearGradient>
          <LinearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={look.rim[0]} /><Stop offset="0.5" stopColor={look.rim[1]} /><Stop offset="1" stopColor={look.rim[2]} />
          </LinearGradient>
          {t.rarity === "mythic" && !dim && (
            <LinearGradient id={`iri-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#ffd6f2" /><Stop offset="0.35" stopColor="#ffffff" /><Stop offset="0.65" stopColor="#c7e6ff" /><Stop offset="1" stopColor="#d9c4ff" />
            </LinearGradient>
          )}
        </Defs>

        {/* 신화: 뒤쪽 후광 고리 */}
        {look.ornament === "halo" && (
          <G>
            <Circle cx={CX} cy={CY} r={58} fill="none" stroke={`url(#iri-${uid})`} strokeWidth={3} opacity={0.9} />
            <Circle cx={CX} cy={CY} r={63} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.5} strokeDasharray="2 5" />
          </G>
        )}

        {/* 전설 · 신화: 양쪽 날개 (깃털 네 장) */}
        {(look.ornament === "wings" || look.ornament === "halo") && [-1, 1].map((sd) => (
          <G key={sd} transform={sd < 0 ? `translate(${CX * 2} 0) scale(-1 1)` : undefined}>
            {[0, 1, 2, 3].map((i) => (
              <Path key={i}
                d={`M${CX + 30} ${CY - 18 + i * 9} Q${CX + 56 - i * 3} ${CY - 40 + i * 12} ${CX + 78 - i * 6} ${CY - 36 + i * 14} Q${CX + 58 - i * 2} ${CY - 18 + i * 12} ${CX + 34} ${CY - 6 + i * 9} Z`}
                fill={look.ornament === "halo" ? `url(#iri-${uid})` : `url(#rim-${uid})`} stroke={look.rim[2]} strokeWidth={1} strokeLinejoin="round" />
            ))}
          </G>
        ))}

        {/* 영웅: 꼭짓점 사이 가시 장식 */}
        {look.ornament === "spikes" && hex(R).map((_, i) => {
          const a = (Math.PI / 180) * (-60 + 60 * i);
          const tip = [CX + (R + 13) * Math.cos(a), CY + (R + 13) * Math.sin(a)];
          const l = [CX + (R - 4) * Math.cos(a - 0.22), CY + (R - 4) * Math.sin(a - 0.22)];
          const r = [CX + (R - 4) * Math.cos(a + 0.22), CY + (R - 4) * Math.sin(a + 0.22)];
          return <Polygon key={i} points={`${l[0]},${l[1]} ${tip[0]},${tip[1]} ${r[0]},${r[1]}`} fill={`url(#rim-${uid})`} stroke={look.rim[2]} strokeWidth={1} strokeLinejoin="round" />;
        })}

        {/* 전설: 위쪽 왕관 장식 */}
        {look.ornament === "wings" && (
          <G>
            <Path d={`M${CX - 16} ${CY - R + 2} L${CX - 20} ${CY - R - 14} L${CX - 8} ${CY - R - 5} L${CX} ${CY - R - 20} L${CX + 8} ${CY - R - 5} L${CX + 20} ${CY - R - 14} L${CX + 16} ${CY - R + 2} Z`}
              fill={`url(#rim-${uid})`} stroke={look.rim[2]} strokeWidth={1.2} strokeLinejoin="round" />
            <Circle cx={CX} cy={CY - R - 20} r={3.2} fill="#ff5a4a" stroke={look.rim[2]} strokeWidth={0.8} />
          </G>
        )}

        {/* 아래 그림자 */}
        <Polygon points={pts(hex(R + 1).map(([x, y]) => [x, y + 4] as const))} fill="#000000" opacity={0.22} />

        {/* 깎인 테두리: 면마다 밝기를 달리해 입체감 */}
        {outer.map((o, i) => {
          const o2 = outer[(i + 1) % 6], n2 = inner[(i + 1) % 6], n1 = inner[i];
          const fill = t.rarity === "mythic" && !dim && bevelLight(i) > 0.5 ? `url(#iri-${uid})` : metal(bevelLight(i));
          return <Polygon key={i} points={pts([o, o2, n2, n1])} fill={fill} stroke={look.rim[2]} strokeWidth={0.6} strokeLinejoin="round" />;
        })}

        {/* 가운데 보석 판 + 결정면 */}
        <Polygon points={pts(inner)} fill={`url(#face-${uid})`} />
        {inner.map((p, i) => {
          const p2 = inner[(i + 1) % 6];
          return <Polygon key={i} points={pts([[CX, CY], p, p2])} fill={i % 2 ? "#000000" : "#ffffff"} opacity={i % 2 ? 0.1 : 0.12} />;
        })}
        <Polygon points={pts(inner)} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.45} />
        {/* 위쪽 유리 반사 */}
        <Path d={`M${inner[5][0] + 3} ${inner[5][1] + 2} L${inner[0][0]} ${inner[0][1] + 3} L${inner[1][0] - 3} ${inner[1][1] + 2} L${CX + 8} ${CY - 8} L${CX - 12} ${CY - 4} Z`} fill="#ffffff" opacity={0.22} />
        {/* 테두리 꼭짓점 장식 보석 */}
        {outer.map(([x, y], i) => (i % 2 === 0 ? <Circle key={i} cx={x} cy={y} r={3} fill={look.rim[0]} stroke={look.rim[2]} strokeWidth={0.8} /> : null))}
      </Svg>

      {/* 가운데 큰 그림 */}
      <View pointerEvents="none" style={{ position: "absolute", left: (CX - RI) * k, top: (CY - RI) * k, width: faceW, height: faceW, alignItems: "center", justifyContent: "center" }}>
        <Icon name={t.icon} size={Math.round(faceW * 0.74)} style={{ opacity: dim ? 0.45 : 1 }} />
      </View>

      {/* 빛줄기: 보석 판 위를 지나감 */}
      {look.shine && (
        <View pointerEvents="none" style={{ position: "absolute", left: (CX - RI * 0.86) * k, top: (CY - RI * 0.86) * k, width: RI * 1.72 * k, height: RI * 1.72 * k, overflow: "hidden", borderRadius: RI * k }}>
          <Animated.View style={{ position: "absolute", top: -faceW * 0.4, width: faceW * 0.32, height: faceW * 1.8, transform: [{ translateX: tx }, { rotate: "24deg" }] }}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={`sh-${uid}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity={0} /><Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.55} /><Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={`M0 0 H${faceW * 0.32} V${faceW * 1.8} H0 Z`} fill={`url(#sh-${uid})`} />
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* 반짝이 */}
      {look.sparkle && (
        <>
          <Twinkle x={W * 0.18} y={H * 0.2} s={H * 0.075} delay={0} color="#fffbe0" />
          <Twinkle x={W * 0.84} y={H * 0.28} s={H * 0.06} delay={520} color="#ffffff" />
          <Twinkle x={W * 0.74} y={H * 0.86} s={H * 0.065} delay={1000} color="#fffbe0" />
        </>
      )}
    </View>
  );
}
