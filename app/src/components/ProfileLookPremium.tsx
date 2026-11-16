import type { ReactNode } from "react";
import { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * 톱니바퀴로 사는 프로필 캐릭터 · 배경 (직접 그린 SVG).
 * 무료 그림보다 그라데이션 · 빛 · 그림자를 더 써서 입체감을 줌.
 * 캐릭터 100×100, 배경 400×210 칸.
 */
const NAVY = "#1d2742";
const PAPER = "#fffaf0";
const CHEEK = "#ff9fb0";

const Eye = ({ x, y, r = 3.6 }: { x: number; y: number; r?: number }) => (
  <G>
    <Circle cx={x} cy={y} r={r} fill={NAVY} />
    <Circle cx={x + r * 0.35} cy={y - r * 0.38} r={r * 0.38} fill={PAPER} />
    <Circle cx={x - r * 0.35} cy={y + r * 0.35} r={r * 0.16} fill={PAPER} opacity={0.8} />
  </G>
);
const Cheeks = ({ y, dx, cx = 50 }: { y: number; dx: number; cx?: number }) => (
  <G>
    <Ellipse cx={cx - dx} cy={y} rx={4} ry={2.5} fill={CHEEK} opacity={0.75} />
    <Ellipse cx={cx + dx} cy={y} rx={4} ry={2.5} fill={CHEEK} opacity={0.75} />
  </G>
);
/** 네 갈래 반짝이 */
const Sparkle = ({ x, y, s, fill = PAPER, o = 1 }: { x: number; y: number; s: number; fill?: string; o?: number }) => (
  <Path d={`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`} fill={fill} opacity={o} />
);
/** 매번 같은 자리에 흩뿌리기 위한 고정 난수 */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

export interface PremiumAvatar { id: string; name: string; price: number; bg: string; art: () => ReactNode }
export interface PremiumBackdrop { id: string; name: string; price: number; bg: string; art: () => ReactNode }

export const PREMIUM_AVATARS: PremiumAvatar[] = [
  {
    id: "av-astro", name: "우주 고양이", price: 900, bg: "#2b1b5a",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="as-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1b1446" /><Stop offset="1" stopColor="#5a3aa8" />
          </LinearGradient>
          <RadialGradient id="as-planet" cx="0.35" cy="0.35" r="0.7">
            <Stop offset="0" stopColor="#ffd2a8" /><Stop offset="1" stopColor="#e2607e" />
          </RadialGradient>
          <LinearGradient id="as-suit" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" /><Stop offset="1" stopColor="#d6dcea" />
          </LinearGradient>
          <RadialGradient id="as-visor" cx="0.35" cy="0.3" r="0.8">
            <Stop offset="0" stopColor="#3a4f8f" /><Stop offset="1" stopColor="#141b33" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#as-sky)" />
        {[[12, 14, 1.2], [84, 10, 1], [90, 34, 1.4], [8, 40, 0.9], [76, 22, 0.8], [24, 6, 0.8]].map(([x, y, r], i) => <Circle key={i} cx={x} cy={y} r={r} fill={PAPER} opacity={0.9} />)}
        <Sparkle x={88} y={56} s={3.4} fill="#ffe08a" />
        <Circle cx={13} cy={86} r={11} fill="url(#as-planet)" />
        <Ellipse cx={13} cy={87} rx={19} ry={4} fill="none" stroke="#ffe0b8" strokeWidth={1.6} opacity={0.85} transform="rotate(-18 13 87)" />
        <Path d="M16 100 Q18 76 50 73 Q82 76 84 100Z" fill="url(#as-suit)" stroke="#b9c1d3" strokeWidth={1.4} />
        <Rect x={41} y={83} width={18} height={11} rx={2.5} fill="#e4e9f3" stroke="#b9c1d3" strokeWidth={1} />
        <Circle cx={46} cy={88.5} r={2} fill="#e0453a" />
        <Circle cx={53} cy={88.5} r={2} fill="#43c38a" />
        <Line x1={72} y1={24} x2={79} y2={13} stroke="#c9cfdc" strokeWidth={2.4} strokeLinecap="round" />
        <Circle cx={80} cy={12} r={3.4} fill="#ffd65c" />
        <Circle cx={19} cy={48} r={4.6} fill="#c9cfdc" />
        <Circle cx={81} cy={48} r={4.6} fill="#c9cfdc" />
        <Circle cx={50} cy={47} r={31} fill="url(#as-suit)" stroke="#b9c1d3" strokeWidth={1.6} />
        <Circle cx={50} cy={49} r={24} fill="url(#as-visor)" />
        <Polygon points="36,46 38.5,32 47,41" fill="#f6a25a" />
        <Polygon points="64,46 61.5,32 53,41" fill="#f6a25a" />
        <Polygon points="38.6,42 39.6,36 44,40" fill="#ffd2b0" />
        <Polygon points="61.4,42 60.4,36 56,40" fill="#ffd2b0" />
        <Ellipse cx={50} cy={54} rx={16} ry={13.5} fill="#f6a25a" />
        <Ellipse cx={50} cy={59} rx={7.5} ry={5} fill="#fff1e0" />
        <Eye x={44} y={52} r={2.8} />
        <Eye x={56} y={52} r={2.8} />
        <Polygon points="48.4,57 51.6,57 50,59" fill="#e66a7a" />
        <Path d="M50 59 Q48 62 46 60.6 M50 59 Q52 62 54 60.6" stroke={NAVY} strokeWidth={1.2} fill="none" strokeLinecap="round" />
        <Cheeks y={58} dx={10} />
        <Path d="M33 39 Q39 28 52 27" stroke={PAPER} strokeWidth={3.2} fill="none" strokeLinecap="round" opacity={0.7} />
        <Circle cx={67} cy={62} r={2.4} fill={PAPER} opacity={0.35} />
      </G>
    ),
  },
  {
    id: "av-dragon", name: "아기 용", price: 1000, bg: "#ffd6bd",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="dr-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff1dc" /><Stop offset="1" stopColor="#ffc3a6" />
          </LinearGradient>
          <LinearGradient id="dr-skin" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#a8f0d6" /><Stop offset="1" stopColor="#4fc49b" />
          </LinearGradient>
          <LinearGradient id="dr-wing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#c6a8ff" /><Stop offset="1" stopColor="#8a6be8" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#dr-bg)" />
        <Sparkle x={16} y={20} s={4} fill="#ffb347" />
        <Sparkle x={86} y={28} s={3} fill="#ff8fb1" />
        <Path d="M31 58 Q8 40 9 64 Q16 59 19 67 Q24 60 28 66 Q30 62 35 64Z" fill="url(#dr-wing)" stroke="#7656d6" strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M69 58 Q92 40 91 64 Q84 59 81 67 Q76 60 72 66 Q70 62 65 64Z" fill="url(#dr-wing)" stroke="#7656d6" strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M27 100 Q28 74 50 72 Q72 74 73 100Z" fill="url(#dr-skin)" />
        <Ellipse cx={50} cy={90} rx={13} ry={12} fill="#fff4cf" />
        <Path d="M41 85 H59 M39 91 H61 M41 97 H59" stroke="#f1d38e" strokeWidth={1.4} />
        <Polygon points="36,36 31,19 44,30" fill="#ffd65c" stroke="#e8a700" strokeWidth={1} strokeLinejoin="round" />
        <Polygon points="64,36 69,19 56,30" fill="#ffd65c" stroke="#e8a700" strokeWidth={1} strokeLinejoin="round" />
        <Polygon points="46,30 50,22 54,30" fill="#ff9a8a" />
        <Ellipse cx={50} cy={52} rx={25} ry={22} fill="url(#dr-skin)" />
        <Ellipse cx={42} cy={40} rx={8} ry={4} fill={PAPER} opacity={0.35} transform="rotate(-20 42 40)" />
        <Ellipse cx={50} cy={63} rx={14} ry={9.5} fill="#e6fff5" />
        <Circle cx={46} cy={60} r={1.3} fill="#2f8f6e" />
        <Circle cx={54} cy={60} r={1.3} fill="#2f8f6e" />
        <Eye x={39} y={49} r={6} />
        <Eye x={61} y={49} r={6} />
        <Path d="M44 66 Q50 71 56 66" stroke={NAVY} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Polygon points="52.5,67.6 55,67 54,70.4" fill={PAPER} />
        <Cheeks y={58} dx={18} />
      </G>
    ),
  },
  {
    id: "av-slime", name: "플라스크 슬라임", price: 800, bg: "#d6efff",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="sl-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#eef9ff" /><Stop offset="1" stopColor="#bfe2ff" />
          </LinearGradient>
          <LinearGradient id="sl-liq" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#c4a3ff" /><Stop offset="1" stopColor="#7647f0" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#sl-bg)" />
        <Circle cx={57} cy={9} r={2.6} fill="#b89cff" opacity={0.8} />
        <Circle cx={47} cy={4} r={1.8} fill="#b89cff" opacity={0.6} />
        <Circle cx={62} cy={2} r={1.4} fill="#b89cff" opacity={0.5} />
        <Path d="M41 30 L41 38 Q19 56 21 74 Q23 93 50 93 Q77 93 79 74 Q81 56 59 38 L59 30Z" fill="rgba(255,255,255,0.6)" stroke="#86a9c4" strokeWidth={2} strokeLinejoin="round" />
        <Path d="M24.5 62 Q37 55 50 61 T75.5 61 Q79 69 78 75 Q75 90.5 50 90.5 Q25 90.5 22.5 75 Q22 68 24.5 62Z" fill="url(#sl-liq)" />
        <Path d="M27 63 Q38 58 50 63 T73 63" stroke="#e0d0ff" strokeWidth={1.6} fill="none" opacity={0.8} />
        <Eye x={42} y={73} r={3.6} />
        <Eye x={58} y={73} r={3.6} />
        <Path d="M45 80 Q50 84.5 55 80" stroke={NAVY} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Cheeks y={79} dx={14} />
        <Circle cx={32} cy={68} r={2.6} fill={PAPER} opacity={0.55} />
        <Circle cx={68} cy={83} r={2} fill={PAPER} opacity={0.5} />
        <Circle cx={65} cy={68} r={1.5} fill={PAPER} opacity={0.6} />
        <Rect x={41} y={16} width={18} height={15} fill="rgba(255,255,255,0.6)" stroke="#86a9c4" strokeWidth={2} />
        <Rect x={37} y={12} width={26} height={6} rx={3} fill="#e7f1f8" stroke="#86a9c4" strokeWidth={1.6} />
        <Path d="M29 62 Q27 76 35 85" stroke={PAPER} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
        <Rect x={44} y={20} width={3} height={9} rx={1.5} fill={PAPER} opacity={0.7} />
        <Sparkle x={84} y={22} s={4} fill="#ffd65c" />
        <Sparkle x={14} y={34} s={3} fill="#9fd4ff" />
      </G>
    ),
  },
  {
    id: "av-bunny", name: "토끼 엔지니어", price: 800, bg: "#ffe7a6",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="bn-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff6d6" /><Stop offset="1" stopColor="#ffd77a" />
          </LinearGradient>
          <LinearGradient id="bn-hat" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffe066" /><Stop offset="1" stopColor="#f59f00" />
          </LinearGradient>
          <LinearGradient id="bn-tool" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#d9dde6" /><Stop offset="1" stopColor="#8e96a8" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#bn-bg)" />
        <Path d="M0 82 L100 70 L100 76 L0 88Z" fill="#1d2742" opacity={0.08} />
        <Ellipse cx={37} cy={22} rx={7} ry={19} fill="#ffffff" stroke="#eadfce" strokeWidth={1.2} transform="rotate(-12 37 22)" />
        <Ellipse cx={37} cy={24} rx={3.4} ry={13} fill="#ffc6d3" transform="rotate(-12 37 24)" />
        <Ellipse cx={63} cy={22} rx={7} ry={19} fill="#ffffff" stroke="#eadfce" strokeWidth={1.2} transform="rotate(12 63 22)" />
        <Ellipse cx={63} cy={24} rx={3.4} ry={13} fill="#ffc6d3" transform="rotate(12 63 24)" />
        <Path d="M30 100 Q31 80 50 78 Q69 80 70 100Z" fill="#3d8bdf" />
        <Rect x={40} y={84} width={20} height={16} rx={3} fill="#2a67ad" />
        <Circle cx={50} cy={57} r={24} fill="#fffdf8" stroke="#eadfce" strokeWidth={1.2} />
        <Path d="M24 49 Q24 27 50 27 Q76 27 76 49Z" fill="url(#bn-hat)" />
        <Rect x={20} y={46} width={60} height={6} rx={3} fill="#f08c00" />
        <Rect x={46.5} y={28} width={7} height={19} rx={2} fill="#fff1a8" opacity={0.85} />
        <Path d="M31 40 Q34 32 41 30" stroke={PAPER} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.7} />
        <Eye x={42} y={61} r={3.4} />
        <Eye x={58} y={61} r={3.4} />
        <Polygon points="48,66 52,66 50,68.4" fill="#ff8fa6" />
        <Path d="M50 68 Q47.5 71.5 44.5 70 M50 68 Q52.5 71.5 55.5 70" stroke={NAVY} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Cheeks y={67} dx={15} />
        <G transform="rotate(-38 79 80)">
          <Rect x={76} y={70} width={6} height={26} rx={3} fill="url(#bn-tool)" />
          <Circle cx={79} cy={69} r={7} fill="url(#bn-tool)" />
          <Rect x={76.5} y={60} width={5} height={8} rx={1} fill="#ffe7a6" />
        </G>
      </G>
    ),
  },
  {
    id: "av-panda", name: "판다 개발자", price: 900, bg: "#c9f0db",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="pd-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#e6fbef" /><Stop offset="1" stopColor="#a8e6c6" />
          </LinearGradient>
          <RadialGradient id="pd-glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#5ee0c8" stopOpacity={0.55} /><Stop offset="1" stopColor="#5ee0c8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#pd-bg)" />
        {[[8, 12, 14], [8, 18, 22], [8, 24, 10], [74, 10, 16], [78, 16, 12]].map(([x, y, w], i) => <Rect key={i} x={x} y={y} width={w} height={3} rx={1.5} fill="#2f8f5b" opacity={0.22} />)}
        <Ellipse cx={50} cy={78} rx={30} ry={14} fill="url(#pd-glow)" />
        <Circle cx={30} cy={31} r={9} fill="#232331" />
        <Circle cx={70} cy={31} r={9} fill="#232331" />
        <Ellipse cx={50} cy={55} rx={27} ry={25} fill="#ffffff" stroke="#e2e4ea" strokeWidth={1.2} />
        <Ellipse cx={39} cy={54} rx={7.4} ry={9.5} fill="#232331" transform="rotate(-28 39 54)" />
        <Ellipse cx={61} cy={54} rx={7.4} ry={9.5} fill="#232331" transform="rotate(28 61 54)" />
        <Circle cx={40} cy={53} r={3.2} fill={PAPER} />
        <Circle cx={60} cy={53} r={3.2} fill={PAPER} />
        <Circle cx={40.6} cy={53.4} r={1.8} fill={NAVY} />
        <Circle cx={59.4} cy={53.4} r={1.8} fill={NAVY} />
        <Ellipse cx={50} cy={63} rx={3.6} ry={2.5} fill="#232331" />
        <Path d="M50 65 Q48 68 45.5 66.6 M50 65 Q52 68 54.5 66.6" stroke="#232331" strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Cheeks y={64} dx={16} />
        <Path d="M21 54 Q21 22 50 22 Q79 22 79 54" stroke="#3d8bdf" strokeWidth={4.4} fill="none" strokeLinecap="round" />
        <Rect x={15} y={47} width={10} height={17} rx={4.5} fill="#3d8bdf" />
        <Rect x={75} y={47} width={10} height={17} rx={4.5} fill="#3d8bdf" />
        <Path d="M21 62 Q24 73 36 73" stroke="#2a67ad" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Circle cx={37} cy={73} r={2.6} fill="#2a67ad" />
        <Path d="M29 86 L33 72 H67 L71 86Z" fill="#2b3550" />
        <Rect x={25} y={86} width={50} height={4.5} rx={2.2} fill="#c9ccd6" />
        <Path d="M45 79 L42 76 L45 73 M55 73 L58 76 L55 79" stroke="#5ee0c8" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
    ),
  },
  {
    id: "av-phoenix", name: "불꽃새", price: 1200, bg: "#ffb36b",
    art: () => (
      <G>
        <Defs>
          <RadialGradient id="ph-bg" cx="0.5" cy="0.55" r="0.75">
            <Stop offset="0" stopColor="#fff1c9" /><Stop offset="0.6" stopColor="#ffc27a" /><Stop offset="1" stopColor="#ff7a5a" />
          </RadialGradient>
          <LinearGradient id="ph-body" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffc84a" /><Stop offset="1" stopColor="#ff5e3a" />
          </LinearGradient>
          <LinearGradient id="ph-wing" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffe066" /><Stop offset="1" stopColor="#ff3d2e" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#ph-bg)" />
        <Sparkle x={14} y={18} s={4} />
        <Sparkle x={86} y={16} s={3} />
        <Sparkle x={88} y={84} s={3.4} fill="#fff1a8" />
        <Path d="M38 76 Q34 92 42 98 Q42 88 46 84Z" fill="#ff7a2e" />
        <Path d="M62 76 Q66 92 58 98 Q58 88 54 84Z" fill="#ff7a2e" />
        <Path d="M46 78 Q46 94 50 100 Q54 94 54 78Z" fill="#ffb02e" />
        <Path d="M31 56 Q7 42 8 70 Q16 63 20 72 Q24 63 29 70 Q30 64 35 66Z" fill="url(#ph-wing)" />
        <Path d="M69 56 Q93 42 92 70 Q84 63 80 72 Q76 63 71 70 Q70 64 65 66Z" fill="url(#ph-wing)" />
        <Path d="M50 12 Q42 24 49 33 Q57 24 50 12Z" fill="#ffd23f" />
        <Path d="M39 18 Q36 29 45 34 Q45 25 39 18Z" fill="#ff8a3d" />
        <Path d="M61 18 Q64 29 55 34 Q55 25 61 18Z" fill="#ff8a3d" />
        <Circle cx={50} cy={56} r={23} fill="url(#ph-body)" />
        <Ellipse cx={42} cy={44} rx={7} ry={3.6} fill={PAPER} opacity={0.35} transform="rotate(-25 42 44)" />
        <Ellipse cx={50} cy={60} rx={15} ry={12.5} fill="#ffe6b8" />
        <Eye x={44} y={56} r={3.3} />
        <Eye x={56} y={56} r={3.3} />
        <Polygon points="46.6,61.5 53.4,61.5 50,67" fill="#ffd23f" stroke="#e09a00" strokeWidth={1} strokeLinejoin="round" />
        <Cheeks y={63} dx={11} />
      </G>
    ),
  },
];

// ───────── 배경 ─────────
function stars(seed: number, n: number, h = 210) {
  const r = seeded(seed);
  return Array.from({ length: n }, (_, i) => {
    const x = r() * 400, y = r() * h, s = 0.5 + r() * 1.4, o = 0.35 + r() * 0.65;
    return <Circle key={`s${seed}-${i}`} cx={x} cy={y} r={s} fill={PAPER} opacity={o} />;
  });
}
const BLOSSOM_PETALS = [0, 72, 144, 216, 288];
const Blossom = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <G>
    {BLOSSOM_PETALS.map((a) => (
      <Ellipse key={a} cx={x} cy={y - s * 0.55} rx={s * 0.42} ry={s * 0.6} fill="#ffc2d4" stroke="#ff9fbc" strokeWidth={0.6} transform={`rotate(${a} ${x} ${y})`} />
    ))}
    <Circle cx={x} cy={y} r={s * 0.28} fill="#ff6f9c" />
    <Circle cx={x} cy={y} r={s * 0.12} fill="#ffe08a" />
  </G>
);
const BOOK_COLORS = ["#e0453a", "#3d8bdf", "#43a35c", "#f7b500", "#a05bd1", "#ff8a1f", "#2f6fd0", "#e66a7a", "#2fa59a"];
function shelfBooks(seed: number, y: number, x0: number, x1: number) {
  const r = seeded(seed);
  const out: ReactNode[] = [];
  let x = x0;
  let k = 0;
  while (x < x1 - 10) {
    const w = 9 + Math.floor(r() * 8), h = 30 + Math.floor(r() * 14);
    const color = BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)];
    const lean = r() < 0.12;
    out.push(
      <G key={`b${seed}-${k++}`} transform={lean ? `rotate(-12 ${x} ${y})` : undefined}>
        <Rect x={x} y={y - h} width={w} height={h} rx={1.5} fill={color} />
        <Rect x={x} y={y - h + 5} width={w} height={2.5} fill={PAPER} opacity={0.45} />
        <Rect x={x} y={y - 9} width={w} height={2} fill={PAPER} opacity={0.3} />
        <Rect x={x + w - 2} y={y - h} width={2} height={h} fill="#000000" opacity={0.15} />
      </G>,
    );
    x += w + 1 + (lean ? 6 : 0);
    if (r() < 0.1) x += 14;
  }
  return out;
}

export const PREMIUM_BACKDROPS: PremiumBackdrop[] = [
  {
    id: "bg-galaxy", name: "은하수", price: 1400, bg: "#140f3a",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="gx-sky" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0a0d2c" /><Stop offset="1" stopColor="#2c0f4d" />
          </LinearGradient>
          <RadialGradient id="gx-n1" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#ff5fa2" stopOpacity={0.6} /><Stop offset="1" stopColor="#ff5fa2" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gx-n2" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#5f8bff" stopOpacity={0.55} /><Stop offset="1" stopColor="#5f8bff" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gx-band" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#fff4e0" stopOpacity={0.28} /><Stop offset="1" stopColor="#fff4e0" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gx-planet" cx="0.35" cy="0.35" r="0.75">
            <Stop offset="0" stopColor="#ffd8a8" /><Stop offset="0.6" stopColor="#ff8f8f" /><Stop offset="1" stopColor="#8a3fa8" />
          </RadialGradient>
          <LinearGradient id="gx-shoot" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} /><Stop offset="1" stopColor="#ffffff" stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={400} height={210} fill="url(#gx-sky)" />
        <Ellipse cx={120} cy={95} rx={170} ry={70} fill="url(#gx-n1)" transform="rotate(-15 120 95)" />
        <Ellipse cx={290} cy={120} rx={170} ry={80} fill="url(#gx-n2)" transform="rotate(10 290 120)" />
        <Ellipse cx={200} cy={105} rx={250} ry={34} fill="url(#gx-band)" transform="rotate(-14 200 105)" />
        {stars(7, 90)}
        <Sparkle x={70} y={40} s={6} />
        <Sparkle x={250} y={170} s={5} fill="#ffe7b0" />
        <Sparkle x={180} y={30} s={4} fill="#c9d6ff" />
        <Line x1={40} y1={150} x2={110} y2={128} stroke="url(#gx-shoot)" strokeWidth={2.2} strokeLinecap="round" />
        <Circle cx={322} cy={62} r={30} fill="url(#gx-planet)" />
        <Ellipse cx={322} cy={64} rx={50} ry={10} fill="none" stroke="#ffe3c2" strokeWidth={3} opacity={0.85} transform="rotate(-16 322 64)" />
        <Circle cx={360} cy={150} r={7} fill="#9fd4ff" opacity={0.9} />
      </G>
    ),
  },
  {
    id: "bg-sakura", name: "벚꽃 길", price: 1100, bg: "#ffe1ec",
    art: () => {
      const r = seeded(31);
      return (
        <G>
          <Defs>
            <LinearGradient id="sk-sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#bfe4ff" /><Stop offset="0.65" stopColor="#ffe3ee" /><Stop offset="1" stopColor="#ffd0e0" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={400} height={210} fill="url(#sk-sky)" />
          <Path d="M0 170 Q90 140 190 165 T400 150 V210 H0Z" fill="#ffc0d6" opacity={0.6} />
          <Path d="M0 190 Q120 170 250 192 T400 186 V210 H0Z" fill="#f7a8c4" opacity={0.7} />
          <Path d="M-5 30 Q70 44 130 26 Q165 16 205 22" stroke="#6b4a3a" strokeWidth={8} fill="none" strokeLinecap="round" />
          <Path d="M90 38 Q105 60 100 80 M150 22 Q170 40 185 44 M40 36 Q45 55 30 70" stroke="#6b4a3a" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d="M405 10 Q340 30 300 24 Q270 20 250 34" stroke="#6b4a3a" strokeWidth={7} fill="none" strokeLinecap="round" />
          <Path d="M330 28 Q325 50 340 66 M285 24 Q290 44 275 58" stroke="#6b4a3a" strokeWidth={3.5} fill="none" strokeLinecap="round" />
          {[[20, 28, 11], [52, 44, 13], [80, 32, 10], [100, 76, 12], [112, 44, 14], [140, 22, 11], [168, 36, 12], [186, 46, 10], [200, 18, 11], [30, 68, 10], [92, 58, 9],
            [380, 14, 12], [352, 30, 13], [320, 24, 11], [338, 62, 12], [296, 30, 10], [270, 50, 12], [258, 34, 9], [280, 60, 9]].map(([x, y, s], i) => <Blossom key={i} x={x} y={y} s={s} />)}
          {Array.from({ length: 22 }, (_, i) => {
            const x = r() * 400, y = 70 + r() * 130, a = r() * 180;
            return <Ellipse key={`p${i}`} cx={x} cy={y} rx={3.4} ry={2.2} fill="#ffb3c9" opacity={0.85} transform={`rotate(${a} ${x} ${y})`} />;
          })}
        </G>
      );
    },
  },
  {
    id: "bg-aurora", name: "오로라 설산", price: 1300, bg: "#0b2234",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="au-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#050f1f" /><Stop offset="1" stopColor="#123b56" />
          </LinearGradient>
          <LinearGradient id="au-g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5effc0" stopOpacity={0} /><Stop offset="0.55" stopColor="#5effc0" stopOpacity={0.75} /><Stop offset="1" stopColor="#5effc0" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="au-v" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#c08bff" stopOpacity={0} /><Stop offset="0.5" stopColor="#c08bff" stopOpacity={0.55} /><Stop offset="1" stopColor="#c08bff" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="au-m1" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3b5878" /><Stop offset="1" stopColor="#1b2f45" />
          </LinearGradient>
          <LinearGradient id="au-m2" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1e3550" /><Stop offset="1" stopColor="#0d1b2c" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={400} height={210} fill="url(#au-sky)" />
        {stars(11, 50, 120)}
        <Path d="M-10 40 Q90 0 190 50 T410 30 L410 110 Q300 90 200 120 T-10 100Z" fill="url(#au-v)" />
        <Path d="M-10 70 Q100 20 210 75 T410 55 L410 120 Q310 100 210 130 T-10 125Z" fill="url(#au-g)" />
        <Path d="M60 60 Q80 40 100 62 M240 70 Q262 52 280 72" stroke="#b6ffe3" strokeWidth={1.4} fill="none" opacity={0.5} />
        <Path d="M0 210 L60 128 L100 160 L170 92 L235 165 L300 112 L360 150 L400 125 V210Z" fill="url(#au-m1)" />
        <Path d="M170 92 L152 114 L162 112 L170 120 L180 110 L190 112Z M300 112 L287 128 L296 127 L304 134 L312 126Z M60 128 L49 143 L58 141 L64 147 L71 140Z" fill="#eaf6ff" />
        <Path d="M0 210 L40 170 L90 188 L150 150 L220 195 L290 160 L350 190 L400 170 V210Z" fill="url(#au-m2)" />
        <Path d="M150 150 L140 162 L148 160 L154 166 L160 158Z" fill="#cfe6f7" opacity={0.85} />
      </G>
    ),
  },
  {
    id: "bg-neon", name: "네온 시티", price: 1400, bg: "#2a0f55",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="ne-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#14082f" /><Stop offset="0.55" stopColor="#5a1c7a" /><Stop offset="0.8" stopColor="#ff5f8f" />
          </LinearGradient>
          <LinearGradient id="ne-sun" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffe066" /><Stop offset="1" stopColor="#ff3f9a" />
          </LinearGradient>
          <LinearGradient id="ne-floor" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2a0a4a" /><Stop offset="1" stopColor="#0d0420" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={400} height={210} fill="url(#ne-sky)" />
        {stars(23, 30, 80)}
        <Circle cx={200} cy={128} r={56} fill="url(#ne-sun)" />
        {[[118, 3], [128, 4], [138, 5], [148, 6], [158, 7]].map(([y, h]) => <Rect key={y} x={140} y={y} width={120} height={h} fill="#7a2380" />)}
        {[[0, 92, 26], [24, 110, 20], [42, 78, 30], [70, 120, 18], [86, 98, 24], [300, 84, 28], [326, 112, 18], [342, 70, 26], [366, 100, 22], [386, 116, 16]].map(([x, top, w], i) => (
          <G key={`bd${i}`}>
            <Rect x={x} y={top} width={w} height={170 - top} fill="#1a0838" />
            {Array.from({ length: Math.floor((170 - top) / 12) }, (_, k) => (
              <Rect key={k} x={x + 4 + ((k + i) % 2) * (w / 2 - 4)} y={top + 6 + k * 12} width={4} height={5} rx={1} fill={(k + i) % 3 ? "#5ef0ff" : "#ff5fd2"} opacity={0.85} />
            ))}
          </G>
        ))}
        <Rect x={0} y={170} width={400} height={40} fill="url(#ne-floor)" />
        <Line x1={0} y1={170} x2={400} y2={170} stroke="#ff5fd2" strokeWidth={2} />
        {[176, 184, 195, 209].map((y) => <Line key={y} x1={0} y1={y} x2={400} y2={y} stroke="#ff5fd2" strokeWidth={1.2} opacity={0.75} />)}
        {[-200, -110, -40, 0, 40, 110, 200, 300, -300].map((dx) => <Line key={dx} x1={200} y1={170} x2={200 + dx * 2.2} y2={210} stroke="#ff5fd2" strokeWidth={1.2} opacity={0.75} />)}
      </G>
    ),
  },
  {
    id: "bg-library", name: "아늑한 도서관", price: 1000, bg: "#5a3322",
    art: () => (
      <G>
        <Defs>
          <LinearGradient id="lb-wall" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7a4a30" /><Stop offset="1" stopColor="#4a2a1c" />
          </LinearGradient>
          <RadialGradient id="lb-glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#ffd27a" stopOpacity={0.6} /><Stop offset="1" stopColor="#ffd27a" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="lb-win" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#24305a" /><Stop offset="1" stopColor="#5b4a8a" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={400} height={210} fill="url(#lb-wall)" />
        <Path d="M300 150 V70 Q300 30 340 30 Q380 30 380 70 V150Z" fill="url(#lb-win)" stroke="#3a2016" strokeWidth={5} />
        <Line x1={340} y1={30} x2={340} y2={150} stroke="#3a2016" strokeWidth={3} />
        <Line x1={300} y1={95} x2={380} y2={95} stroke="#3a2016" strokeWidth={3} />
        <Circle cx={362} cy={55} r={9} fill="#ffe9a8" />
        <Circle cx={318} cy={50} r={1.4} fill={PAPER} />
        <Circle cx={325} cy={80} r={1.1} fill={PAPER} />
        {[66, 122, 178].map((y, i) => (
          <G key={y}>
            {shelfBooks(100 + i, y, 10, 284)}
            <Rect x={4} y={y} width={284} height={8} rx={2} fill="#9a6640" />
            <Rect x={4} y={y + 8} width={284} height={4} fill="#000000" opacity={0.25} />
          </G>
        ))}
        <Ellipse cx={200} cy={22} rx={120} ry={70} fill="url(#lb-glow)" />
        <Line x1={200} y1={0} x2={200} y2={16} stroke="#2a160e" strokeWidth={2} />
        <Path d="M186 28 L190 16 H210 L214 28Z" fill="#e0a43a" />
        <Ellipse cx={200} cy={29} rx={7} ry={3} fill="#fff1b8" />
        <Rect x={346} y={170} width={22} height={20} rx={3} fill="#c96f3a" />
        <Path d="M357 170 Q340 150 346 136 Q356 150 357 170 Q360 146 372 138 Q372 156 357 170Z" fill="#43a35c" />
        <Rect x={0} y={190} width={400} height={20} fill="#3a2016" />
      </G>
    ),
  },
];
