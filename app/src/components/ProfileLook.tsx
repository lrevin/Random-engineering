import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import type { AvatarId, BackdropId } from "@/lib/profile-look";
import { PREMIUM_AVATARS, PREMIUM_BACKDROPS } from "./ProfileLookPremium";
import { T } from "./ui";

/**
 * 프로필 캐릭터 · 배경 그림 (직접 그린 SVG, 이모지 · 외부 그림 없음)
 * 캐릭터는 100×100 칸에 그렸고, 동그랗게 잘라 씀.
 */
const NAVY = "#1d2742";
const NAVY_D = "#0e1424";
const PAPER = "#fffaf0";
const RED = "#e0453a";
const GOLD = "#f7b500";
const CHEEK = "#ffb0a3";

/** 반짝이는 눈 (검은 눈동자 + 흰 점) */
const Eye = ({ x, y, r = 3.6 }: { x: number; y: number; r?: number }) => (
  <G>
    <Circle cx={x} cy={y} r={r} fill={NAVY} />
    <Circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill={PAPER} />
  </G>
);
const Cheeks = ({ y, dx = 13, cx = 50 }: { y: number; dx?: number; cx?: number }) => (
  <G>
    <Ellipse cx={cx - dx} cy={y} rx={4} ry={2.6} fill={CHEEK} opacity={0.8} />
    <Ellipse cx={cx + dx} cy={y} rx={4} ry={2.6} fill={CHEEK} opacity={0.8} />
  </G>
);

const FREE_AVATAR_ART: { id: AvatarId; name: string; bg: string; art?: () => ReactNode; price?: number }[] = [
  { id: "initial", name: "글자", bg: GOLD },
  {
    id: "slotbot", name: "슬롯봇", bg: "#ffe9b8",
    art: () => (
      <G>
        <Line x1={73} y1={58} x2={83} y2={42} stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
        <Circle cx={84} cy={39} r={6} fill={RED} />
        <Rect x={22} y={24} width={54} height={62} rx={13} fill={NAVY} />
        <Circle cx={37} cy={31} r={2.6} fill={GOLD} />
        <Circle cx={49} cy={31} r={2.6} fill={RED} />
        <Circle cx={61} cy={31} r={2.6} fill={GOLD} />
        <Rect x={29} y={37} width={40} height={30} rx={8} fill={PAPER} />
        <Eye x={41} y={50} />
        <Eye x={57} y={50} />
        <Path d="M43 57 Q49 63 55 57" stroke={NAVY} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <Cheeks y={58} dx={14} cx={49} />
        <Rect x={35} y={73} width={28} height={6} rx={3} fill={NAVY_D} />
      </G>
    ),
  },
  {
    id: "gear", name: "톱니", bg: "#dceeff",
    art: () => (
      <G>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
          <Rect key={k} x={44} y={22} width={12} height={14} rx={3} fill={GOLD} transform={`rotate(${k * 45} 50 54)`} />
        ))}
        <Circle cx={50} cy={54} r={26} fill={GOLD} />
        <Circle cx={50} cy={54} r={20} fill="#ffd65c" />
        <Eye x={43} y={52} />
        <Eye x={57} y={52} />
        <Path d="M44 60 Q50 66 56 60" stroke={NAVY} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <Cheeks y={60} dx={12} />
      </G>
    ),
  },
  {
    id: "cat", name: "공부 고양이", bg: "#dff3e4",
    art: () => (
      <G>
        <Polygon points="22,46 28,16 47,32" fill="#f29a4a" />
        <Polygon points="78,46 72,16 53,32" fill="#f29a4a" />
        <Polygon points="28,38 31,24 41,32" fill="#ffd2b0" />
        <Polygon points="72,38 69,24 59,32" fill="#ffd2b0" />
        <Ellipse cx={50} cy={57} rx={31} ry={27} fill="#f29a4a" />
        <Path d="M50 31 L50 38 M42 33 L44 39 M58 33 L56 39" stroke="#c96f25" strokeWidth={2.6} strokeLinecap="round" />
        <Ellipse cx={50} cy={67} rx={13} ry={9} fill="#fff3e0" />
        <Circle cx={39} cy={53} r={9} fill="rgba(255,255,255,0.35)" stroke={NAVY} strokeWidth={2.6} />
        <Circle cx={61} cy={53} r={9} fill="rgba(255,255,255,0.35)" stroke={NAVY} strokeWidth={2.6} />
        <Line x1={48} y1={53} x2={52} y2={53} stroke={NAVY} strokeWidth={2.6} />
        <Eye x={39} y={53} r={3} />
        <Eye x={61} y={53} r={3} />
        <Polygon points="47,63 53,63 50,66.5" fill="#e66a7a" />
        <Path d="M50 66 Q47 70 43 68 M50 66 Q53 70 57 68" stroke={NAVY} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Path d="M22 62 L10 60 M22 66 L11 68 M78 62 L90 60 M78 66 L89 68" stroke="#c96f25" strokeWidth={1.6} strokeLinecap="round" />
      </G>
    ),
  },
  {
    id: "owl", name: "부엉이 박사", bg: "#e6e0ff",
    art: () => (
      <G>
        <Ellipse cx={50} cy={62} rx={29} ry={30} fill="#8a5a33" />
        <Ellipse cx={50} cy={72} rx={17} ry={17} fill="#f2e6ce" />
        <Path d="M42 70 Q46 74 50 70 Q54 74 58 70 M44 78 Q47 81 50 78 Q53 81 56 78" stroke="#c9a77a" strokeWidth={1.8} fill="none" />
        <Circle cx={39} cy={52} r={11} fill={PAPER} />
        <Circle cx={61} cy={52} r={11} fill={PAPER} />
        <Eye x={39} y={53} r={5} />
        <Eye x={61} y={53} r={5} />
        <Polygon points="46,60 54,60 50,67" fill={GOLD} />
        <Polygon points="50,12 84,25 50,38 16,25" fill={NAVY} />
        <Rect x={37} y={27} width={26} height={9} rx={2} fill={NAVY_D} />
        <Line x1={78} y1={27} x2={78} y2={40} stroke={GOLD} strokeWidth={2.2} />
        <Circle cx={78} cy={41.5} r={3} fill={GOLD} />
      </G>
    ),
  },
  {
    id: "fox", name: "여우", bg: "#ffe3d6",
    art: () => (
      <G>
        <Polygon points="22,46 27,14 47,34" fill="#ef7d32" />
        <Polygon points="78,46 73,14 53,34" fill="#ef7d32" />
        <Polygon points="28,39 30,22 41,33" fill={NAVY} />
        <Polygon points="72,39 70,22 59,33" fill={NAVY} />
        <Path d="M18 46 Q50 26 82 46 Q76 74 50 86 Q24 74 18 46Z" fill="#ef7d32" />
        <Path d="M18 46 Q36 56 50 86 Q28 76 18 46Z" fill="#fff3e0" />
        <Path d="M82 46 Q64 56 50 86 Q72 76 82 46Z" fill="#fff3e0" />
        <Eye x={39} y={54} />
        <Eye x={61} y={54} />
        <Circle cx={50} cy={74} r={4.2} fill={NAVY} />
        <Cheeks y={63} dx={17} />
      </G>
    ),
  },
  {
    id: "penguin", name: "펭귄", bg: "#dff1ff",
    art: () => (
      <G>
        <Ellipse cx={24} cy={68} rx={6} ry={14} fill={NAVY} />
        <Ellipse cx={76} cy={68} rx={6} ry={14} fill={NAVY} />
        <Ellipse cx={50} cy={60} rx={29} ry={33} fill={NAVY} />
        <Ellipse cx={50} cy={68} rx={20} ry={23} fill={PAPER} />
        <Circle cx={42} cy={50} r={11} fill={PAPER} />
        <Circle cx={58} cy={50} r={11} fill={PAPER} />
        <Eye x={43} y={50} r={3.2} />
        <Eye x={57} y={50} r={3.2} />
        <Ellipse cx={50} cy={58} rx={6} ry={3.6} fill={GOLD} />
        <Cheeks y={58} dx={14} />
        <Rect x={27} y={72} width={46} height={8} rx={4} fill={RED} />
        <Rect x={58} y={76} width={8} height={14} rx={3} fill="#b02d26" />
      </G>
    ),
  },
  {
    id: "robot", name: "로봇", bg: "#e3f6f3",
    art: () => (
      <G>
        <Line x1={50} y1={15} x2={50} y2={27} stroke="#9aa0b0" strokeWidth={3} />
        <Circle cx={50} cy={13} r={4.5} fill={RED} />
        <Rect x={17} y={41} width={8} height={16} rx={3} fill="#9aa0b0" />
        <Rect x={75} y={41} width={8} height={16} rx={3} fill="#9aa0b0" />
        <Rect x={36} y={68} width={28} height={18} rx={5} fill="#c9ccd6" />
        <Circle cx={50} cy={77} r={3.5} fill={GOLD} />
        <Rect x={23} y={26} width={54} height={44} rx={15} fill="#dfe2ea" stroke="#9aa0b0" strokeWidth={2} />
        <Rect x={30} y={34} width={40} height={28} rx={10} fill={NAVY} />
        <Circle cx={41} cy={46} r={5} fill="#5ee0c8" />
        <Circle cx={59} cy={46} r={5} fill="#5ee0c8" />
        <Circle cx={42.5} cy={44.5} r={1.6} fill={PAPER} />
        <Circle cx={60.5} cy={44.5} r={1.6} fill={PAPER} />
        <Path d="M43 54 Q50 59 57 54" stroke="#5ee0c8" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      </G>
    ),
  },
  {
    id: "bear", name: "헤드폰 곰", bg: "#fdeccf",
    art: () => (
      <G>
        <Circle cx={29} cy={33} r={10} fill="#a8703f" />
        <Circle cx={71} cy={33} r={10} fill="#a8703f" />
        <Circle cx={29} cy={33} r={5} fill="#e8b78a" />
        <Circle cx={71} cy={33} r={5} fill="#e8b78a" />
        <Circle cx={50} cy={57} r={29} fill="#a8703f" />
        <Ellipse cx={50} cy={67} rx={13} ry={10} fill="#e8c9a3" />
        <Ellipse cx={50} cy={62} rx={5} ry={3.6} fill={NAVY} />
        <Path d="M50 65 L50 69 M44 70 Q50 74 56 70" stroke={NAVY} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Eye x={40} y={53} r={3.4} />
        <Eye x={60} y={53} r={3.4} />
        <Cheeks y={62} dx={17} />
        <Path d="M20 56 Q20 22 50 22 Q80 22 80 56" stroke={RED} strokeWidth={5} fill="none" strokeLinecap="round" />
        <Rect x={13} y={48} width={11} height={20} rx={5} fill={RED} />
        <Rect x={76} y={48} width={11} height={20} rx={5} fill={RED} />
      </G>
    ),
  },
];

/** 무료 + 톱니바퀴로 사는 캐릭터 (price가 있으면 유료) */
export const AVATARS = [...FREE_AVATAR_ART, ...PREMIUM_AVATARS.map((a) => ({ ...a, id: a.id as AvatarId }))];

/** 동그란 프로필 그림. 글자(initial)면 이름 첫 글자 */
export function Avatar({ id, name, size }: { id: AvatarId; name: string; size: number }) {
  const a = AVATARS.find((x) => x.id === id) ?? AVATARS[0];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: a.bg, alignItems: "center", justifyContent: "center" }}>
      {a.art ? (
        <Svg width={size} height={size} viewBox="0 0 100 100">{a.art()}</Svg>
      ) : (
        <T size={Math.round(size * 0.44)} weight="bold" style={{ color: NAVY, lineHeight: Math.round(size * 0.54) }}>{(name || "나").slice(0, 1)}</T>
      )}
    </View>
  );
}

// ───────── 배경 ─────────
/** 별 위치 (매번 같은 자리에 그리도록 고정값) */
const STARS = [[30, 30, 1.6], [80, 70, 1.1], [120, 25, 1.4], [170, 60, 1], [210, 20, 1.8], [250, 80, 1.2], [290, 35, 1], [40, 110, 1.2], [140, 100, 1.5], [230, 120, 1], [370, 110, 1.4], [380, 30, 1.1], [100, 150, 1], [320, 160, 1.3], [60, 180, 1.2], [190, 170, 1.6], [270, 190, 1]] as const;

const FREE_BACKDROP_ART: { id: BackdropId; name: string; bg: string; grad?: string; art?: () => ReactNode; price?: number }[] = [
  {
    id: "reel", name: "릴 패턴", bg: NAVY,
    art: () => (
      <G opacity={0.1}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [0, 1, 2, 3].map((k) => (
          <Rect key={`${i}-${k}`} x={8 + i * 50} y={(i % 2 ? -26 : -6) + k * 58} width={40} height={46} rx={10} fill={PAPER} />
        )))}
      </G>
    ),
  },
  {
    id: "sunset", name: "노을", bg: "#ff7a6b", grad: "linear-gradient(180deg, #ffb36b 0%, #ff6f7d 55%, #7d4fc9 100%)",
    art: () => (
      <G>
        <Circle cx={300} cy={150} r={52} fill="#ffe08a" opacity={0.9} />
        <Path d="M0 168 Q100 128 200 162 T400 150 V210 H0Z" fill="#7a46b8" opacity={0.75} />
        <Path d="M0 192 Q130 160 260 190 T400 182 V210 H0Z" fill="#4c2a85" />
      </G>
    ),
  },
  {
    id: "night", name: "밤하늘", bg: "#141d3a", grad: "linear-gradient(180deg, #0c1229 0%, #1b2650 100%)",
    art: () => (
      <G>
        {STARS.map(([x, y, r], i) => <Circle key={i} cx={x} cy={y} r={r} fill={PAPER} opacity={0.5 + (i % 3) * 0.2} />)}
        <Circle cx={330} cy={58} r={24} fill="#ffe9a8" />
        <Circle cx={342} cy={50} r={21} fill="#111a37" />
        <Path d="M60 60 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3z" fill="#ffe9a8" />
      </G>
    ),
  },
  {
    id: "notebook", name: "모눈 공책", bg: "#fffaf0",
    art: () => (
      <G>
        {Array.from({ length: 23 }, (_, i) => <Line key={`v${i}`} x1={i * 18} y1={0} x2={i * 18} y2={210} stroke="#cfe0f3" strokeWidth={1} />)}
        {Array.from({ length: 12 }, (_, i) => <Line key={`h${i}`} x1={0} y1={i * 18} x2={400} y2={i * 18} stroke="#cfe0f3" strokeWidth={1} />)}
        <Line x1={44} y1={0} x2={44} y2={210} stroke="#f28b82" strokeWidth={2} />
        <Path d="M300 150 Q320 120 345 150 T390 150" stroke="#3d8bdf" strokeWidth={2.5} fill="none" />
        <Path d="M70 40 L110 40 M70 54 L130 54" stroke="#9aa0b0" strokeWidth={2} strokeLinecap="round" />
      </G>
    ),
  },
  {
    id: "circuit", name: "회로 기판", bg: "#1d6a49", grad: "linear-gradient(160deg, #23805a 0%, #145038 100%)",
    art: () => (
      <G stroke="#e3c35a" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.75}>
        <Path d="M0 40 H70 L95 65 H160" />
        <Path d="M0 150 H50 L80 120 H130 L150 100" />
        <Path d="M400 30 H330 L300 60 H250" />
        <Path d="M400 170 H340 L310 140 H260 L240 160 H200" />
        <Path d="M200 0 V30 L220 50" />
        <Path d="M120 210 V180 L140 160" />
        {[[160, 65], [150, 100], [250, 60], [200, 160], [220, 50], [140, 160]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={5} fill="#1d6a49" />
        ))}
        <Rect x={175} y={85} width={50} height={36} rx={4} fill="#123d2b" />
      </G>
    ),
  },
  {
    id: "ocean", name: "바다", bg: "#3b9be3", grad: "linear-gradient(180deg, #8edcff 0%, #3b9be3 55%, #1f64b8 100%)",
    art: () => (
      <G>
        <Circle cx={70} cy={50} r={26} fill="#fff6c9" opacity={0.85} />
        <Path d="M0 120 Q50 105 100 120 T200 120 T300 120 T400 120 V210 H0Z" fill="#ffffff" opacity={0.18} />
        <Path d="M0 150 Q50 135 100 150 T200 150 T300 150 T400 150 V210 H0Z" fill="#ffffff" opacity={0.22} />
        <Path d="M0 182 Q50 168 100 182 T200 182 T300 182 T400 182 V210 H0Z" fill="#ffffff" opacity={0.3} />
      </G>
    ),
  },
  {
    id: "chalk", name: "칠판", bg: "#2e4a3b", grad: "linear-gradient(180deg, #35553f 0%, #263f31 100%)",
    art: () => (
      <G>
        {CHALK.map((x) => (
          <SvgText key={x.t} x={x.x} y={x.y} fontSize={x.size} fontWeight="600" fill="rgba(255,255,255,0.55)" transform={`rotate(${x.rot} ${x.x} ${x.y})`}>{x.t}</SvgText>
        ))}
        <Rect x={0} y={198} width={400} height={12} fill="#8a5a33" />
        <Rect x={300} y={192} width={26} height={6} rx={2} fill="#f2e6ce" />
      </G>
    ),
  },
];

/** 칠판에 쓴 수식 (분필 글씨): 그림 좌표(400×210)에 두어 작은 미리 보기에서도 비율 그대로 줄어듦 */
const CHALK: { t: string; x: number; y: number; rot: number; size: number }[] = [
  { t: "V = IR", x: 30, y: 78, rot: -6, size: 26 },
  { t: "∫ f(x) dx", x: 252, y: 72, rot: 4, size: 22 },
  { t: "E = mc²", x: 262, y: 146, rot: -3, size: 22 },
  { t: "Σ aₙ", x: 40, y: 150, rot: 5, size: 28 },
  { t: "π ≈ 3.14", x: 150, y: 112, rot: -2, size: 18 },
];

export const BACKDROPS = [...FREE_BACKDROP_ART, ...PREMIUM_BACKDROPS.map((b) => ({ ...b, id: b.id as BackdropId, grad: undefined as string | undefined }))];

/** 프로필 위쪽 배경: 부모를 꽉 채움 */
export function ProfileBackdrop({ id }: { id: BackdropId }) {
  const b = BACKDROPS.find((x) => x.id === id) ?? BACKDROPS[0];
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: b.bg, ...(b.grad ? { experimental_backgroundImage: b.grad } : null), overflow: "hidden" }}>
      {b.art && (
        <Svg width="100%" height="100%" viewBox="0 0 400 210" preserveAspectRatio="xMidYMid slice">{b.art()}</Svg>
      )}
    </View>
  );
}
