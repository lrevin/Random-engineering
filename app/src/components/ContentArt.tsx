import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { radius } from "@/theme";

/**
 * 콘텐츠 탭 버튼 그림 (직접 그린 SVG, 64×64 칸).
 * 작은 아이콘을 칸 가운데 띄우던 것을 칸을 꽉 채우는 큰 그림 + 버튼마다 다른 바탕색으로 바꿈.
 */
export type ContentArtName = "ranking" | "battle" | "team" | "boss" | "speed";

const INK = "#1b1f33";
/** 바탕: 테마와 상관없이 잘 보이도록 그림마다 고정 그라데이션 */
const TILE: Record<ContentArtName, [string, string]> = {
  ranking: ["#ffe9a8", "#f7c23c"],
  battle: ["#ffd2c7", "#f0705f"],
  team: ["#cfe5ff", "#6aa8ee"],
  boss: ["#4a0d18", "#14040a"],
  speed: ["#fff1b8", "#ffb000"],
};

function Ranking() {
  return (
    <G>
      {/* 시상대 */}
      <Rect x={6} y={40} width={17} height={18} rx={3} fill="#c9ccd6" stroke={INK} strokeWidth={2.2} />
      <Rect x={41} y={45} width={17} height={13} rx={3} fill="#d58b4e" stroke={INK} strokeWidth={2.2} />
      <Rect x={22} y={33} width={20} height={25} rx={3} fill="#f7b500" stroke={INK} strokeWidth={2.2} />
      <Path d="M29 42 h4 v10" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* 트로피 */}
      <Path d="M22 10 h20 v6 a10 10 0 0 1 -20 0 z" fill="#ffd34d" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M22 12 h-4 v2 a5 5 0 0 0 5 5 M42 12 h4 v2 a5 5 0 0 1 -5 5" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Rect x={29} y={25} width={6} height={4} fill="#e0a000" stroke={INK} strokeWidth={2} />
      <Rect x={25} y={28.5} width={14} height={4} rx={1.5} fill="#8a5a33" stroke={INK} strokeWidth={2} />
      <Path d="M26 13 q1 6 5 8" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8} />
    </G>
  );
}

function Battle() {
  const sword = (a: number, blade: string) => (
    <G transform={`rotate(${a} 32 32)`}>
      <Path d="M30 6 L34 6 L34 40 L32 44 L30 40 Z" fill={blade} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M32 9 L32 38" stroke="#fff" strokeWidth={1.4} opacity={0.8} />
      <Rect x={24} y={40} width={16} height={4.5} rx={2} fill="#f7b500" stroke={INK} strokeWidth={2} />
      <Rect x={30} y={44} width={4} height={9} fill="#8a5a33" stroke={INK} strokeWidth={2} />
      <Circle cx={32} cy={55.5} r={3} fill="#e0453a" stroke={INK} strokeWidth={2} />
    </G>
  );
  return (
    <G>
      {sword(-42, "#e6e9f2")}
      {sword(42, "#e6e9f2")}
      {/* 부딪히는 불꽃 */}
      <Path d="M32 14 l2.5 5 5.5 -1.5 -3 4.5 4 3.5 -5.5 0.5 -0.5 5.5 -3 -4.5 -3 4.5 -0.5 -5.5 -5.5 -0.5 4 -3.5 -3 -4.5 5.5 1.5 z"
        fill="#ffe27a" stroke="#e0453a" strokeWidth={1.6} strokeLinejoin="round" transform="translate(0 -4) scale(1)" />
    </G>
  );
}

function Team() {
  const person = (x: number, y: number, s: number, body: string, skin = "#ffd9b3", hair = "#3b2a20") => (
    <G>
      <Path d={`M${x - 11 * s} ${y + 22 * s} q0 -13 ${11 * s} -13 q${11 * s} 0 ${11 * s} 13 z`} fill={body} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Circle cx={x} cy={y} r={7.5 * s} fill={skin} stroke={INK} strokeWidth={2.2} />
      <Path d={`M${x - 7.5 * s} ${y - 1 * s} q${1 * s} -8 ${7.5 * s} -7.5 q${6.5 * s} 0 ${7.5 * s} 7 q-${5 * s} -3 -${10 * s} -2 z`} fill={hair} />
      <Circle cx={x - 2.6 * s} cy={y + 1 * s} r={1.1 * s} fill={INK} />
      <Circle cx={x + 2.6 * s} cy={y + 1 * s} r={1.1 * s} fill={INK} />
      <Path d={`M${x - 2.2 * s} ${y + 4 * s} q${2.2 * s} ${2 * s} ${4.4 * s} 0`} stroke={INK} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  );
  return (
    <G>
      {person(15, 28, 0.85, "#43a35c", "#ffd9b3", "#8a5a33")}
      {person(49, 28, 0.85, "#e0453a", "#ffe0c2", "#1d2742")}
      {person(32, 26, 1, "#1d2742", "#ffd2a8", "#3b2a20")}
      {/* 같이 보는 책 */}
      <Path d="M18 50 q14 -6 14 0 q0 -6 14 0 v8 q-14 -6 -14 0 q0 -6 -14 0 z" fill="#fffaf0" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M32 50 v8" stroke={INK} strokeWidth={1.8} />
    </G>
  );
}

/** 오답 보스 미니: 뿔 달린 빨간 슬롯머신 얼굴 */
function Boss() {
  return (
    <G>
      <Defs>
        <LinearGradient id="ca-boss" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor="#ef4257" />
          <Stop offset="0.6" stopColor="#a3122a" />
          <Stop offset="1" stopColor="#5a0716" />
        </LinearGradient>
        <RadialGradient id="ca-eye" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#fff6b0" />
          <Stop offset="0.55" stopColor="#ffc21a" />
          <Stop offset="1" stopColor="#ff5a00" />
        </RadialGradient>
        <RadialGradient id="ca-glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#ff3b2f" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#ff3b2f" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={32} cy={34} r={30} fill="url(#ca-glow)" />
      {/* 날개 */}
      <Path d="M12 30 Q4 22 0 26 Q4 30 3 34 Q8 33 9 38 Q12 35 14 38 Z" fill="#2b0a1f" stroke="#120208" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M52 30 Q60 22 64 26 Q60 30 61 34 Q56 33 55 38 Q52 35 50 38 Z" fill="#2b0a1f" stroke="#120208" strokeWidth={1.6} strokeLinejoin="round" />
      {/* 뿔 */}
      <Path d="M18 15 Q12 7 15 1 Q20 8 26 11 Z" fill="#f3d7a8" stroke="#120208" strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M46 15 Q52 7 49 1 Q44 8 38 11 Z" fill="#f3d7a8" stroke="#120208" strokeWidth={1.8} strokeLinejoin="round" />
      {/* 몸 */}
      <Path d="M12 20 Q12 9 32 8 Q52 9 52 20 L52 56 Q52 60 48 60 L16 60 Q12 60 12 56 Z" fill="url(#ca-boss)" stroke="#120208" strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M16 22 Q17 14 28 12" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.35} />
      {/* 눈썹 */}
      <Path d="M16 21 L28 26 M48 21 L36 26" stroke="#120208" strokeWidth={3.2} strokeLinecap="round" />
      {/* 릴 창 + 눈 */}
      <Rect x={15} y={26} width={34} height={14} rx={3.5} fill="#2a0508" stroke="#120208" strokeWidth={2} />
      <Ellipse cx={23} cy={33} rx={5} ry={4.4} fill="url(#ca-eye)" />
      <Ellipse cx={41} cy={33} rx={5} ry={4.4} fill="url(#ca-eye)" />
      <Ellipse cx={24} cy={33.3} rx={1.1} ry={3.4} fill="#120208" />
      <Ellipse cx={40} cy={33.3} rx={1.1} ry={3.4} fill="#120208" />
      {/* 송곳니 입 */}
      <Path d="M20 45 Q32 55 44 45 Q40 51 32 51.5 Q24 51 20 45 Z" fill="#2a0306" stroke="#120208" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M24 47 L26 51 L28 48.5 M36 48.5 L38 51 L40 47" fill="#fff" stroke="#fff" strokeWidth={1} strokeLinejoin="round" />
    </G>
  );
}

function Speed() {
  return (
    <G>
      {/* 초시계 */}
      <Rect x={27} y={4} width={10} height={5} rx={2} fill="#e0453a" stroke={INK} strokeWidth={2} />
      <Circle cx={32} cy={35} r={23} fill="#fffaf0" stroke={INK} strokeWidth={2.6} />
      <Circle cx={32} cy={35} r={18.5} fill="none" stroke="#f2e6ce" strokeWidth={3} />
      {[0, 90, 180, 270].map((a) => (
        <Path key={a} d="M32 15 v4" stroke={INK} strokeWidth={2.2} strokeLinecap="round" transform={`rotate(${a} 32 35)`} />
      ))}
      {/* 번개 */}
      <Path d="M36 17 L22 38 h9 l-3 14 L44 30 h-9 z" fill="#f7b500" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M33.5 21 L26 33.5 h4" stroke="#ffe27a" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* 속도선 */}
      <Path d="M2 26 h7 M0 34 h6 M2 42 h7" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
    </G>
  );
}

const ART: Record<ContentArtName, () => React.JSX.Element> = { ranking: Ranking, battle: Battle, team: Team, boss: Boss, speed: Speed };

/** 버튼 왼쪽 그림 칸 (바탕색 + 그림) */
export function ContentArt({ name, size = 76 }: { name: ContentArtName; size?: number }) {
  const [a, b] = TILE[name];
  const Art = ART[name];
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md + 2, backgroundColor: b, experimental_backgroundImage: `linear-gradient(160deg, ${a} 0%, ${b} 100%)`,
      borderWidth: 2, borderColor: "rgba(0,0,0,0.12)", borderBottomWidth: 4, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Svg width={size - 12} height={size - 12} viewBox="0 0 64 64">
        <Art />
      </Svg>
    </View>
  );
}
