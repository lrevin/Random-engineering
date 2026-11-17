import type { ReactNode } from "react";
import { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * 톱니바퀴로 사는 프로필 캐릭터 · 배경 (직접 그린 SVG).
 * 무료 그림보다 그라데이션 · 빛 · 그림자를 더 써서 입체감을 줌.
 * 캐릭터 100×100, 배경 400×210 칸.
 */
const PAPER = "#fffaf0";

/** 네 갈래 반짝이 */
const Sparkle = ({ x, y, s, fill = PAPER, o = 1 }: { x: number; y: number; s: number; fill?: string; o?: number }) => (
  <Path d={`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`} fill={fill} opacity={o} />
);
/** 매번 같은 자리에 흩뿌리기 위한 고정 난수 */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

export interface PremiumAvatar { id: string; name: string; price: number; bg: string }
export interface PremiumBackdrop { id: string; name: string; price: number; bg: string; art: () => ReactNode }

/** 톱니바퀴로 사는 캐릭터 (그림은 avatar-art.ts, python scripts/make_avatars.py 로 만듦) */
export const PREMIUM_AVATARS: PremiumAvatar[] = [
  { id: "av-astro", name: "우주 고양이", price: 900, bg: "#2b1b5a" },
  { id: "av-dragon", name: "아기 용", price: 1000, bg: "#ffd6bd" },
  { id: "av-slime", name: "플라스크 슬라임", price: 800, bg: "#d6efff" },
  { id: "av-bunny", name: "토끼 엔지니어", price: 800, bg: "#ffe7a6" },
  { id: "av-panda", name: "판다 개발자", price: 900, bg: "#c9f0db" },
  { id: "av-phoenix", name: "불꽃새", price: 1200, bg: "#4a1858" },
  { id: "av-whale", name: "꿈꾸는 고래", price: 900, bg: "#3a9be6" },
  { id: "av-hamster", name: "공부 햄스터", price: 800, bg: "#ffdccb" },
  { id: "av-unicorn", name: "별빛 유니콘", price: 1100, bg: "#3b2b8f" },
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
