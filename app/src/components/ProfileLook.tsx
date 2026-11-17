import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, SvgXml, Text as SvgText } from "react-native-svg";
import { AVATAR_XML } from "./avatar-art";
import type { AvatarId, BackdropId } from "@/lib/profile-look";
import { PREMIUM_AVATARS, PREMIUM_BACKDROPS } from "./ProfileLookPremium";
import { T } from "./ui";

/**
 * 프로필 캐릭터 · 배경 그림 (직접 그린 SVG, 이모지 · 외부 그림 없음)
 * 캐릭터는 100×100 칸에 그렸고, 동그랗게 잘라 씀.
 */
const NAVY = "#1d2742";
const PAPER = "#fffaf0";


/** 무료 캐릭터 (그림은 avatar-art.ts, python scripts/make_avatars.py 로 만듦) */
const FREE_AVATAR_ART: { id: AvatarId; name: string; bg: string; price?: number }[] = [
  { id: "slotbot", name: "슬롯봇", bg: "#ffe9b8" },
  { id: "gear", name: "톱니", bg: "#dceeff" },
  { id: "cat", name: "공부 고양이", bg: "#dff3e4" },
  { id: "owl", name: "부엉이 박사", bg: "#e6e0ff" },
  { id: "fox", name: "여우", bg: "#ffe3d6" },
  { id: "penguin", name: "펭귄", bg: "#dff1ff" },
  { id: "robot", name: "로봇", bg: "#e3f6f3" },
  { id: "bear", name: "헤드폰 곰", bg: "#fdeccf" },
  { id: "frog", name: "개구리", bg: "#ffdce8" },
];

/** 무료 + 톱니바퀴로 사는 캐릭터 (price가 있으면 유료) */
export const AVATARS = [...FREE_AVATAR_ART, ...PREMIUM_AVATARS.map((a) => ({ ...a, id: a.id as AvatarId }))];

/** 동그란 프로필 그림 (그림이 없으면 이름 첫 글자) */
export function Avatar({ id, name, size }: { id: AvatarId; name: string; size: number }) {
  const a = AVATARS.find((x) => x.id === id) ?? AVATARS[0];
  const xml = AVATAR_XML[a.id];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: a.bg, alignItems: "center", justifyContent: "center" }}>
      {xml ? (
        <SvgXml xml={xml} width={size} height={size} />
      ) : (
        <T size={Math.round(size * 0.5)} weight="bold" style={{ color: NAVY, lineHeight: Math.round(size * 0.6) }}>{(name || "나").slice(0, 1)}</T>
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
