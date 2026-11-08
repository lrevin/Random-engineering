import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from "react-native-svg";

/**
 * 뽑공 전용 아이콘 (이모지 대신 직접 그린 그림).
 * 모두 32×32 칸에 그렸고, 색은 앱 로고와 같은 남색·빨강·노랑을 기본으로 씀.
 * 아래쪽에 한 톤 어두운 면을 두어 버튼처럼 살짝 입체감이 나게 함.
 */
export type IconName =
  | "flame" | "gear" | "shield" | "ticket" | "swords" | "trophy" | "star" | "crown" | "dice" | "book" | "globe"
  | "tree" | "doc" | "door" | "trash" | "offline" | "hourglass" | "bell" | "bolt" | "medal" | "target" | "robot"
  | "books" | "party" | "mail" | "check" | "close" | "slot" | "handshake" | "dizzy" | "nope" | "lock" | "user-plus"
  | "share" | "clock" | "chart" | "warning" | "calendar";

const NAVY = "#1d2742";
const NAVY_D = "#0e1424";
const RED = "#e0453a";
const RED_D = "#b02d26";
const GOLD = "#f7b500";
const GOLD_D = "#c98f00";
const GOLD_L = "#ffe27a";
const PAPER = "#fffaf0";
const CREAM = "#f2e6ce";
const ORANGE = "#ff8a1f";
const BLUE = "#3d8bdf";
const BLUE_D = "#2a67ad";
const GREEN = "#43a35c";
const GREEN_D = "#2f7d4f";
const BROWN = "#8a5a33";
const GREY = "#c9ccd6";
const GREY_D = "#9aa0b0";

/** 별 모양 꼭짓점 */
function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function Gear({ cx = 16, cy = 16, r = 10, fill = GOLD, shade = GOLD_D, hole = PAPER, teeth = 8 }: { cx?: number; cy?: number; r?: number; fill?: string; shade?: string; hole?: string; teeth?: number }) {
  const tw = r * 0.5;
  const th = r * 0.62;
  return (
    <G>
      {Array.from({ length: teeth }, (_, i) => (
        <Rect key={i} x={cx - tw / 2} y={cy - r - th * 0.55} width={tw} height={th} rx={tw * 0.3} fill={fill} transform={`rotate(${(360 / teeth) * i} ${cx} ${cy})`} />
      ))}
      <Circle cx={cx} cy={cy} r={r} fill={fill} />
      <Path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`} fill={shade} opacity={0.45} />
      <Circle cx={cx} cy={cy} r={r * 0.42} fill={shade} />
      <Circle cx={cx} cy={cy} r={r * 0.28} fill={hole} />
    </G>
  );
}

const ICONS: Record<IconName, () => ReactNode> = {
  flame: () => (
    <G>
      <Path d="M16 2c1.5 5 9.5 8.5 9.5 17.5a9.5 9.5 0 0 1-19 0c0-5.5 3.5-8 4.5-12.5 1.8 2.6 3 3.6 4 3.6C17 7.6 16.6 4.8 16 2z" fill={ORANGE} />
      <Path d="M6.6 21.5a9.5 9.5 0 0 0 18.8 0c-2.5 4-6 5.5-9.4 5.5s-6.9-1.5-9.4-5.5z" fill={RED} opacity={0.55} />
      <Path d="M16 14c1.6 3 5 4 5 8a5 5 0 0 1-10 0c0-3.2 3.4-4.6 5-8z" fill={GOLD} />
      <Path d="M16 20c.8 1.3 2.2 1.8 2.2 3.4a2.2 2.2 0 0 1-4.4 0c0-1.4 1.4-2 2.2-3.4z" fill={GOLD_L} />
    </G>
  ),
  gear: () => <Gear />,
  shield: () => (
    <G>
      <Path d="M16 3l11 4v8.5c0 6.8-4.6 11.4-11 13.5C9.6 26.9 5 22.3 5 15.5V7z" fill={BLUE} />
      <Path d="M16 3l11 4v8.5c0 6.8-4.6 11.4-11 13.5z" fill={BLUE_D} />
      <Path d="M10.5 15.5l4 4 7-8" stroke={PAPER} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
  ticket: () => (
    <G transform="rotate(-14 16 16)">
      <Path d="M3 10a2 2 0 0 1 2-2h22a2 2 0 0 1 2 2v3.2a2.8 2.8 0 0 0 0 5.6V22a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.2a2.8 2.8 0 0 0 0-5.6z" fill={RED} />
      <Path d="M3 19.5V22a2 2 0 0 0 2 2h22a2 2 0 0 0 2-2v-2.5z" fill={RED_D} />
      {[10, 13.5, 17, 20.5].map((y) => <Rect key={y} x={21.2} y={y} width={1.6} height={2} rx={0.8} fill={PAPER} />)}
      <Polygon points={starPoints(12, 16, 4.6, 2)} fill={GOLD} />
    </G>
  ),
  swords: () => (
    <G>
      {[45, -45].map((a) => (
        <G key={a} transform={`rotate(${a} 16 16)`}>
          <Path d="M14.6 2.5h2.8V20h-2.8z" fill="#e7ebf3" />
          <Path d="M16 2.5h1.4V20H16z" fill={GREY_D} />
          <Path d="M14.6 2.5L16 0.6l1.4 1.9z" fill="#e7ebf3" />
          <Rect x={10} y={19.5} width={12} height={3} rx={1.5} fill={GOLD} />
          <Rect x={14.6} y={22.5} width={2.8} height={5.5} rx={1.2} fill={BROWN} />
          <Circle cx={16} cy={29} r={1.8} fill={GOLD_D} />
        </G>
      ))}
    </G>
  ),
  trophy: () => (
    <G>
      <Path d="M9 7H5.5v2.5A4.5 4.5 0 0 0 10 14" stroke={GOLD_D} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M23 7h3.5v2.5A4.5 4.5 0 0 1 22 14" stroke={GOLD_D} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M8.5 4h15v8a7.5 7.5 0 0 1-15 0z" fill={GOLD} />
      <Path d="M16 4h7.5v8a7.5 7.5 0 0 1-7.5 7.5z" fill={GOLD_D} opacity={0.55} />
      <Rect x={11} y={6.5} width={2} height={7} rx={1} fill={GOLD_L} />
      <Rect x={14} y={19} width={4} height={4.5} fill={GOLD_D} />
      <Rect x={9.5} y={23} width={13} height={6} rx={2} fill={NAVY} />
      <Rect x={12.5} y={25} width={7} height={2} rx={1} fill={GOLD} />
    </G>
  ),
  star: () => (
    <G>
      <Polygon points={starPoints(16, 17, 14, 6.6)} fill={GOLD} stroke={GOLD_D} strokeWidth={1.6} strokeLinejoin="round" />
      <Polygon points={starPoints(16, 17, 6.5, 3)} fill={GOLD_L} />
    </G>
  ),
  crown: () => (
    <G>
      <Path d="M3.5 10l6.5 5.5L16 5l6 10.5 6.5-5.5-2.5 15h-21z" fill={GOLD} strokeLinejoin="round" />
      <Rect x={6} y={21.5} width={20} height={5} rx={1.5} fill={GOLD_D} />
      <Circle cx={16} cy={24} r={1.6} fill={RED} />
      <Circle cx={10.5} cy={24} r={1.2} fill={BLUE} />
      <Circle cx={21.5} cy={24} r={1.2} fill={BLUE} />
      <Circle cx={3.5} cy={10} r={2} fill={GOLD} />
      <Circle cx={16} cy={5} r={2} fill={GOLD} />
      <Circle cx={28.5} cy={10} r={2} fill={GOLD} />
    </G>
  ),
  dice: () => (
    <G transform="rotate(-10 16 16)">
      <Rect x={4} y={5} width={24} height={24} rx={6} fill="#d8d0bf" />
      <Rect x={4} y={3} width={24} height={23} rx={6} fill={PAPER} stroke={NAVY} strokeWidth={2} />
      <Circle cx={10.5} cy={9.5} r={2.3} fill={NAVY} />
      <Circle cx={16} cy={14.5} r={2.3} fill={RED} />
      <Circle cx={21.5} cy={19.5} r={2.3} fill={NAVY} />
    </G>
  ),
  book: () => (
    <G>
      <Path d="M2.5 8c5-2.3 9.4-1.6 13.5 1.6V28c-4.1-3-8.5-3.6-13.5-1.6z" fill={BLUE_D} />
      <Path d="M29.5 8c-5-2.3-9.4-1.6-13.5 1.6V28c4.1-3 8.5-3.6 13.5-1.6z" fill={BLUE_D} />
      <Path d="M4 6.5c4.5-1.8 8.4-1 12 2V26c-3.6-2.6-7.5-3.2-12-1.6z" fill={PAPER} />
      <Path d="M28 6.5c-4.5-1.8-8.4-1-12 2V26c3.6-2.6 7.5-3.2 12-1.6z" fill="#efe5cf" />
      {[11, 14.5, 18].map((y) => <Path key={y} d={`M7 ${y}c2.2-.6 4.3-.3 6.3.8`} stroke={GREY_D} strokeWidth={1.3} strokeLinecap="round" fill="none" />)}
      {[11, 14.5, 18].map((y) => <Path key={y} d={`M25 ${y}c-2.2-.6-4.3-.3-6.3.8`} stroke={GREY_D} strokeWidth={1.3} strokeLinecap="round" fill="none" />)}
    </G>
  ),
  globe: () => (
    <G>
      <Circle cx={16} cy={16} r={13} fill={BLUE} />
      <Path d="M16 3a13 13 0 0 1 0 26z" fill={BLUE_D} opacity={0.5} />
      <Path d="M8 8.5c2.5 1 3 3 5.5 3.2 2 .2 2 2.8.2 3.8-2.2 1.2-1.2 4-3.8 4.6C8 20.6 6 18 4.5 15.5 4.6 12.8 6 10.3 8 8.5zM20 6c2 .8 1.2 2.6 3.2 3.4 2.2.9 4.3 1 4.6 4-1.5.8-3.5.2-4.3 2-.9 2 1.2 4 .3 6.5-.8 2-2.4 2.8-4 2.4-1-1.8-.2-4-1.6-5.6-1.3-1.6-.5-3.6 1.2-4.5-1.5-1.6-3.6-1.5-3.2-4.2C16.6 7.6 18.4 6.2 20 6z" fill={GREEN} />
      <Ellipse cx={16} cy={16} rx={13} ry={13} stroke={NAVY} strokeWidth={1.6} fill="none" />
    </G>
  ),
  tree: () => (
    <G>
      <Rect x={13.8} y={19} width={4.4} height={10} rx={1.5} fill={BROWN} />
      <Circle cx={16} cy={10} r={7.5} fill={GREEN} />
      <Circle cx={9.5} cy={15.5} r={6} fill={GREEN} />
      <Circle cx={22.5} cy={15.5} r={6} fill={GREEN_D} />
      <Circle cx={16} cy={17} r={6} fill={GREEN_D} />
      <Circle cx={13} cy={8} r={2} fill="#7bd08f" />
    </G>
  ),
  doc: () => (
    <G>
      <Path d="M7 3h13l6 6v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill={PAPER} stroke={NAVY} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M20 3v6h6" fill="#e6d6b6" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" />
      {[14, 18, 22].map((y, i) => <Rect key={y} x={9} y={y} width={i === 2 ? 8 : 13} height={2} rx={1} fill={GREY_D} />)}
    </G>
  ),
  door: () => (
    <G>
      <Rect x={6} y={3} width={20} height={27} rx={2} fill={NAVY} />
      <Path d="M8.5 5.5h15V30l-15-3z" fill={BROWN} />
      <Path d="M8.5 5.5l15 0V30l-15-3z" fill="#a8703f" />
      <Circle cx={20} cy={18} r={1.6} fill={GOLD} />
      <Rect x={3} y={28.5} width={26} height={2.5} rx={1.2} fill={NAVY_D} />
    </G>
  ),
  trash: () => (
    <G>
      <Rect x={6} y={7} width={20} height={3.5} rx={1.5} fill={RED_D} />
      <Rect x={12.5} y={3.5} width={7} height={4} rx={1.5} fill={RED_D} />
      <Path d="M8 11h16l-1.5 16.5a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8z" fill={RED} />
      {[12.5, 16, 19.5].map((x) => <Rect key={x} x={x - 0.9} y={14} width={1.8} height={11} rx={0.9} fill={PAPER} opacity={0.85} />)}
    </G>
  ),
  offline: () => (
    <G>
      {[12, 8, 4].map((r, i) => (
        <Path key={r} d={`M${16 - r * 1.25} ${24 - r * 0.9}a${r * 1.6} ${r * 1.6} 0 0 1 ${r * 2.5} 0`} stroke={i === 0 ? GREY_D : GREY} strokeWidth={3} strokeLinecap="round" fill="none" />
      ))}
      <Circle cx={16} cy={25} r={2.4} fill={GREY_D} />
      <Circle cx={24.5} cy={8} r={6} fill={RED} />
      <Path d="M22 5.5l5 5M27 5.5l-5 5" stroke={PAPER} strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
  hourglass: () => (
    <G>
      <Rect x={6} y={2.5} width={20} height={3.5} rx={1.5} fill={NAVY} />
      <Rect x={6} y={26} width={20} height={3.5} rx={1.5} fill={NAVY} />
      <Path d="M9 6h14c0 5-3.5 7.5-5.5 10 2 2.5 5.5 5 5.5 10H9c0-5 3.5-7.5 5.5-10C12.5 13.5 9 11 9 6z" fill="#dbe9f7" stroke={NAVY} strokeWidth={1.6} />
      <Path d="M11.5 9h9c-.8 2.2-3 3.6-4.5 5.6C14.5 12.6 12.3 11.2 11.5 9z" fill={GOLD} />
      <Path d="M10.5 24.5c1-2.8 3.6-4 5.5-4.4 1.9.4 4.5 1.6 5.5 4.4z" fill={GOLD} />
    </G>
  ),
  bell: () => (
    <G>
      <Path d="M16 4a8 8 0 0 1 8 8v6l3 4H5l3-4v-6a8 8 0 0 1 8-8z" fill={GOLD} />
      <Path d="M16 4a8 8 0 0 1 8 8v6l3 4H16z" fill={GOLD_D} opacity={0.5} />
      <Rect x={14.5} y={1.5} width={3} height={4} rx={1.5} fill={GOLD_D} />
      <Path d="M12.5 24a3.5 3.5 0 0 0 7 0z" fill={NAVY} />
    </G>
  ),
  bolt: () => (
    <G>
      <Path d="M19 2L6 18h9l-2.5 12L26 13h-9z" fill={GOLD} stroke={GOLD_D} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M16.5 6.5L10 15h4" stroke={GOLD_L} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
  medal: () => (
    <G>
      <Path d="M9 2h5l4 10h-5z" fill={BLUE} />
      <Path d="M23 2h-5l-4 10h5z" fill={RED} />
      <Circle cx={16} cy={20} r={9.5} fill={GOLD_D} />
      <Circle cx={16} cy={19.2} r={8.5} fill={GOLD} />
      <Polygon points={starPoints(16, 19.5, 5, 2.3)} fill={GOLD_L} />
    </G>
  ),
  target: () => (
    <G>
      <Circle cx={16} cy={16} r={13} fill={RED} />
      <Circle cx={16} cy={16} r={9.5} fill={PAPER} />
      <Circle cx={16} cy={16} r={6} fill={RED} />
      <Circle cx={16} cy={16} r={2.6} fill={PAPER} />
    </G>
  ),
  robot: () => (
    <G>
      <Line x1={16} y1={3} x2={16} y2={8} stroke={NAVY} strokeWidth={2} />
      <Circle cx={16} cy={3.5} r={2.2} fill={RED} />
      <Rect x={5} y={8} width={22} height={18} rx={6} fill={GREY} />
      <Rect x={5} y={19} width={22} height={7} rx={4} fill={GREY_D} />
      <Rect x={8.5} y={12} width={15} height={8} rx={4} fill={NAVY} />
      <Circle cx={12.5} cy={16} r={2} fill="#6fe0ff" />
      <Circle cx={19.5} cy={16} r={2} fill="#6fe0ff" />
      <Rect x={2} y={13} width={3} height={7} rx={1.5} fill={GREY_D} />
      <Rect x={27} y={13} width={3} height={7} rx={1.5} fill={GREY_D} />
    </G>
  ),
  books: () => (
    <G>
      <Rect x={4} y={22} width={24} height={6} rx={1.5} fill={RED} />
      <Rect x={4} y={26} width={24} height={2} fill={RED_D} />
      <Rect x={6} y={15} width={21} height={6.5} rx={1.5} fill={BLUE} />
      <Rect x={6} y={19.5} width={21} height={2} fill={BLUE_D} />
      <Rect x={5} y={8} width={20} height={6.5} rx={1.5} fill={GOLD} />
      <Rect x={5} y={12.5} width={20} height={2} fill={GOLD_D} />
      <Rect x={21} y={9.5} width={2} height={3.5} rx={1} fill={PAPER} />
      <Rect x={23} y={16.5} width={2} height={3.5} rx={1} fill={PAPER} />
    </G>
  ),
  party: () => (
    <G>
      <Path d="M4 28l6.5-17.5 11 11z" fill={GOLD} />
      <Path d="M4 28l6.5-17.5 4 4z" fill={GOLD_D} />
      <Path d="M7.2 19.3l5.5 5.5M9 14.5l8.5 8.5" stroke={RED} strokeWidth={2} />
      <Path d="M17 9c1-3 3.5-3.5 4-6M21 13c2.5-1.5 5-.5 7-2" stroke={BLUE} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Circle cx={25} cy={5} r={1.8} fill={RED} />
      <Circle cx={27.5} cy={17} r={1.6} fill={GREEN} />
      <Circle cx={14} cy={4.5} r={1.5} fill={GREEN} />
      <Rect x={22} y={21} width={3} height={3} rx={0.8} fill={BLUE} transform="rotate(25 23.5 22.5)" />
    </G>
  ),
  mail: () => (
    <G>
      <Rect x={3} y={7} width={26} height={19} rx={3} fill={PAPER} stroke={NAVY} strokeWidth={2} />
      <Path d="M4 9l12 9 12-9" stroke={RED} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
  check: () => <Path d="M6 16.5l6.5 6.5L26 9" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  close: () => <Path d="M8 8l16 16M24 8L8 24" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" />,
  slot: () => (
    <G>
      <Rect x={3} y={5} width={22} height={24} rx={4} fill={NAVY} />
      <Rect x={6} y={10} width={16} height={11} rx={2} fill={PAPER} />
      {[9.5, 14, 18.5].map((x, i) => <Rect key={x} x={x - 1.6} y={13} width={3.2} height={5} rx={1} fill={i === 1 ? RED : GOLD} />)}
      {[10, 14, 18].map((x, i) => <Circle key={x} cx={x} cy={7.6} r={1.2} fill={i === 1 ? RED : GOLD} />)}
      <Rect x={9} y={24} width={10} height={2} rx={1} fill={NAVY_D} />
      <Rect x={26} y={10} width={2} height={11} rx={1} fill={NAVY} />
      <Circle cx={27} cy={8.5} r={3} fill={RED} />
    </G>
  ),
  handshake: () => (
    <G>
      <Circle cx={10} cy={16} r={8} fill={BLUE} opacity={0.9} />
      <Circle cx={22} cy={16} r={8} fill={RED} opacity={0.9} />
      <Path d="M12 16h8M12 19h8" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" />
    </G>
  ),
  dizzy: () => (
    <G>
      <Circle cx={16} cy={16} r={13} fill={GREY} />
      <Path d="M16 3a13 13 0 0 1 0 26z" fill={GREY_D} opacity={0.45} />
      <Path d="M8.5 11l5 5M13.5 11l-5 5M18.5 11l5 5M23.5 11l-5 5" stroke={NAVY} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M11 23c2-2 8-2 10 0" stroke={NAVY} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </G>
  ),
  nope: () => (
    <G>
      <Circle cx={16} cy={16} r={13} fill={RED} />
      <Path d="M16 3a13 13 0 0 1 0 26z" fill={RED_D} opacity={0.5} />
      <Rect x={8} y={14} width={16} height={4.5} rx={2.2} fill={PAPER} />
    </G>
  ),
  lock: () => (
    <G>
      <Path d="M10 14v-3a6 6 0 0 1 12 0v3" stroke={GREY_D} strokeWidth={3.2} fill="none" />
      <Rect x={6} y={14} width={20} height={15} rx={4} fill={GREY} />
      <Rect x={6} y={22} width={20} height={7} rx={4} fill={GREY_D} />
      <Circle cx={16} cy={20} r={2.4} fill={NAVY} />
    </G>
  ),
  "user-plus": () => (
    <G>
      <Circle cx={12} cy={10} r={5.5} fill="currentColor" />
      <Path d="M2 27c0-5.5 4.5-9 10-9s10 3.5 10 9z" fill="currentColor" />
      <Path d="M25 9v10M20 14h10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </G>
  ),
  share: () => (
    <G>
      <Path d="M16 4v15M10 9.5L16 3.5l6 6" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M8 14H6.5A1.5 1.5 0 0 0 5 15.5v11A1.5 1.5 0 0 0 6.5 28h19a1.5 1.5 0 0 0 1.5-1.5v-11a1.5 1.5 0 0 0-1.5-1.5H24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" fill="none" />
    </G>
  ),
  clock: () => (
    <G>
      <Circle cx={16} cy={16} r={13} fill={PAPER} stroke={NAVY} strokeWidth={2.4} />
      <Path d="M16 8v8l5 3" stroke={RED} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
  chart: () => (
    <G>
      <Rect x={4} y={17} width={6} height={11} rx={1.5} fill={BLUE} />
      <Rect x={13} y={10} width={6} height={18} rx={1.5} fill={GOLD} />
      <Rect x={22} y={4} width={6} height={24} rx={1.5} fill={RED} />
    </G>
  ),
  warning: () => (
    <G>
      <Path d="M16 3.5l13.5 24h-27z" fill={GOLD} stroke={GOLD_D} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={14.5} y={11} width={3} height={9} rx={1.5} fill={NAVY} />
      <Circle cx={16} cy={23.5} r={1.8} fill={NAVY} />
    </G>
  ),
  calendar: () => (
    <G>
      <Rect x={4} y={6} width={24} height={22} rx={4} fill={PAPER} stroke={NAVY} strokeWidth={2} />
      <Path d="M4 10a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v3H4z" fill={RED} />
      <Rect x={9} y={3} width={2.6} height={6} rx={1.3} fill={NAVY} />
      <Rect x={20.4} y={3} width={2.6} height={6} rx={1.3} fill={NAVY} />
      {[10, 16, 22].map((x) => [18, 23].map((y) => <Rect key={`${x}-${y}`} x={x - 1.5} y={y - 1.5} width={3} height={3} rx={0.8} fill={x === 16 && y === 18 ? RED : GREY_D} />))}
    </G>
  ),
};

/** 직접 그린 아이콘. color는 단색 아이콘(check, close, user-plus, share)에만 쓰임 */
export function Icon({ name, size = 24, color = NAVY, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 32 32" color={color}>
        {ICONS[name]()}
      </Svg>
    </View>
  );
}

// ───────── 분야 아이콘: 색 타일 + 흰 그림 ─────────
const W = "#ffffff";
const DOMAIN_ART: Record<string, { color: string; deep: string; art: () => ReactNode }> = {
  it: { color: "#3d6fd8", deep: "#2a4fa3", art: () => (
    <G>
      <Rect x={6} y={8} width={20} height={13} rx={2} fill={W} />
      <Rect x={8.5} y={10.5} width={15} height={8} rx={1} fill="#2a4fa3" />
      <Path d="M11 13l2 1.6-2 1.6M15 16.4h4" stroke={W} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x={14} y={21} width={4} height={3} fill={W} />
      <Rect x={10} y={23.5} width={12} height={2} rx={1} fill={W} />
    </G>
  ) },
  ee: { color: "#f2a900", deep: "#c07f00", art: () => <Path d="M18 5L9 18h6l-2 9 10-13h-6z" fill={W} strokeLinejoin="round" /> },
  me: { color: "#6b7a90", deep: "#4c586b", art: () => <Gear cx={16} cy={16} r={7} fill={W} shade={W} hole="#6b7a90" /> },
  che: { color: "#16a39a", deep: "#0e7a73", art: () => (
    <G>
      <Path d="M13 6h6v6l6 11a2 2 0 0 1-1.8 3H8.8A2 2 0 0 1 7 23l6-11z" fill={W} />
      <Path d="M10 19h12l2.2 4.2a1 1 0 0 1-.9 1.3H8.7a1 1 0 0 1-.9-1.3z" fill="#7fe0d6" />
      <Rect x={12} y={5} width={8} height={2.4} rx={1.2} fill={W} />
    </G>
  ) },
  civil: { color: "#c46a2b", deep: "#97501f", art: () => (
    <G>
      <Path d="M4 13h24v3H4z" fill={W} />
      <Path d="M6 16v9h3v-3a7 7 0 0 1 14 0v3h3v-9z" fill={W} />
      <Path d="M8 13V9M16 13V7M24 13V9" stroke={W} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 9c3 2 13 2 16 0" stroke={W} strokeWidth={1.4} fill="none" />
    </G>
  ) },
  arch: { color: "#a05bd1", deep: "#7a3fa6", art: () => (
    <G>
      <Rect x={7} y={10} width={10} height={16} rx={1} fill={W} />
      <Rect x={18} y={5} width={8} height={21} rx={1} fill={W} />
      {[13, 17, 21].map((y) => [9.5, 13].map((x) => <Rect key={`${x}${y}`} x={x} y={y} width={2} height={2} fill="#a05bd1" />))}
      {[8, 12, 16, 20].map((y) => <Rect key={y} x={20.5} y={y} width={3} height={2} fill="#a05bd1" />)}
    </G>
  ) },
  mat: { color: "#d14d8b", deep: "#a3366a", art: () => (
    <G>
      <Path d="M10 6h12l5 7-11 14L5 13z" fill={W} />
      <Path d="M5 13h22M10 6l3 7 3 14 3-14 3-7" stroke="#d14d8b" strokeWidth={1.3} fill="none" strokeLinejoin="round" />
    </G>
  ) },
  ie: { color: "#2f8f5b", deep: "#1f6a41", art: () => (
    <G>
      <Rect x={7} y={17} width={4.5} height={8} rx={1} fill={W} />
      <Rect x={13.75} y={12} width={4.5} height={13} rx={1} fill={W} />
      <Rect x={20.5} y={7} width={4.5} height={18} rx={1} fill={W} />
      <Path d="M6 14l7-5 5 3 8-6" stroke={W} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    </G>
  ) },
  env: { color: "#4caf3e", deep: "#357a2b", art: () => (
    <G>
      <Path d="M25 6C13 6 7 11 7 19c0 2 .6 4 1.6 5.5C10 17 15 13 19 11c-4 3-8 8-9.2 14.5C11 26.5 13 27 15 27c8 0 10-10 10-21z" fill={W} />
    </G>
  ) },
  aero: { color: "#2b9fd9", deep: "#1c78a8", art: () => (
    <G transform="rotate(-35 16 16)">
      <Path d="M16 3c1.5 0 2.2 2 2.2 4v6l9 5v2.6l-9-2.6v6l3 2.4V29L16 27.6 10.8 29v-2.6l3-2.4v-6l-9 2.6V18l9-5V7c0-2 .7-4 2.2-4z" fill={W} />
    </G>
  ) },
  bio: { color: "#e0453a", deep: "#b02d26", art: () => (
    <G>
      <Path d="M11 4c0 6 10 6 10 12s-10 6-10 12" stroke={W} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Path d="M21 4c0 6-10 6-10 12s10 6 10 12" stroke={W} strokeWidth={2.6} fill="none" strokeLinecap="round" opacity={0.75} />
      {[7, 12.5, 19.5, 25].map((y) => <Line key={y} x1={12.5} y1={y} x2={19.5} y2={y} stroke={W} strokeWidth={1.6} />)}
    </G>
  ) },
  math: { color: "#1d2742", deep: "#0e1424", art: () => (
    <G>
      <Path d="M6 26V6l20 20z" fill={W} />
      <Path d="M10 22v-6.5l6.5 6.5z" fill="#1d2742" />
      {[9, 13, 17].map((y) => <Rect key={y} x={6} y={y} width={3} height={1.4} fill="#1d2742" />)}
    </G>
  ) },
  phys: { color: "#5560d8", deep: "#3c45a8", art: () => (
    <G>
      {[0, 60, 120].map((a) => <Ellipse key={a} cx={16} cy={16} rx={11} ry={4.2} stroke={W} strokeWidth={1.8} fill="none" transform={`rotate(${a} 16 16)`} />)}
      <Circle cx={16} cy={16} r={2.8} fill={W} />
    </G>
  ) },
  chem: { color: "#e07a1f", deep: "#b05c12", art: () => (
    <G transform="rotate(20 16 16)">
      <Path d="M12.5 4h7v17.5a3.5 3.5 0 0 1-7 0z" fill={W} />
      <Path d="M12.5 15h7v6.5a3.5 3.5 0 0 1-7 0z" fill="#ffd3a6" />
      <Rect x={11} y={3} width={10} height={2.6} rx={1.3} fill={W} />
    </G>
  ) },
  life: { color: "#7cb82f", deep: "#5a8a1f", art: () => (
    <G>
      <Path d="M16 5c7 0 11 4.5 11 10.5S22.5 27 16 27 5 22.5 5 16 9 5 16 5z" fill={W} />
      <Circle cx={17} cy={15} r={4.2} fill="#7cb82f" />
      <Circle cx={10.5} cy={20} r={1.4} fill="#7cb82f" />
      <Circle cx={22} cy={21.5} r={1.2} fill="#7cb82f" />
      <Circle cx={11} cy={11} r={1.1} fill="#7cb82f" />
    </G>
  ) },
  earth: { color: "#2a8fb8", deep: "#1c6a8a", art: () => (
    <G>
      <Circle cx={16} cy={16} r={10.5} fill={W} />
      <Path d="M10 9c2 1 2.5 3 4.5 3.2 1.6.2 1.6 2.4.2 3.2-1.8 1-1 3.4-3 3.8-1.6.3-3.2-1.6-4.3-3.6.1-2.5 1.1-4.8 2.6-6.6zM19.6 7.2c1.6.6 1 2.1 2.6 2.8 1.8.7 3.4.8 3.7 3.2-1.2.6-2.8.2-3.4 1.6-.7 1.6 1 3.2.2 5.2-.6 1.6-1.9 2.2-3.2 1.9-.8-1.4-.2-3.2-1.3-4.5-1-1.3-.4-2.9 1-3.6-1.2-1.3-2.9-1.2-2.6-3.4.3-1.6 1.7-2.8 3-3.2z" fill="#2a8fb8" />
    </G>
  ) },
};

/** 분야 아이콘 (색 타일). 모르는 분야면 회색 타일 */
export function DomainIcon({ id, size = 28, style }: { id: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const d = DOMAIN_ART[id];
  const color = d?.color ?? "#857f74";
  const deep = d?.deep ?? "#5e594f";
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect x={0} y={1.5} width={32} height={30.5} rx={8} fill={deep} />
        <Rect x={0} y={0} width={32} height={29} rx={8} fill={color} />
        <G transform="translate(1.6 0.6) scale(0.9)">{d ? d.art() : <Circle cx={16} cy={16} r={5} fill={W} />}</G>
      </Svg>
    </View>
  );
}

// ───────── 랭크 메달 ─────────
/** 주제 숙련 랭크 메달 (0 브론즈 ~ 5 엔지니어) */
export function TierIcon({ index, size = 20 }: { index: number; size?: number }) {
  const C = [
    ["#c98a5a", "#a9714b", "#e7b48b"],
    ["#c3cad8", "#8e9aaf", "#eef1f6"],
    ["#f7c531", "#d4a017", "#ffe58a"],
    ["#5cc8bf", "#3fa7a0", "#b6efe9"],
    ["#6f95ff", "#4f7cff", "#c8d6ff"],
    ["#e0453a", "#b2342c", "#ffb3a8"],
  ][Math.max(0, Math.min(5, index))];
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        {index <= 2 ? (
          <G>
            <Path d="M9 1h5l4 10h-5zM23 1h-5l-4 10h5z" fill={index === 2 ? RED : BLUE} />
            <Circle cx={16} cy={20} r={10.5} fill={C[1]} />
            <Circle cx={16} cy={19.2} r={9.5} fill={C[0]} />
            <Polygon points={starPoints(16, 19.5, 5.4, 2.4)} fill={C[2]} />
          </G>
        ) : index === 3 ? (
          <G>
            <Polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill={C[1]} />
            <Polygon points="16,5 25.5,10.5 25.5,21.5 16,27 6.5,21.5 6.5,10.5" fill={C[0]} />
            <Polygon points="16,9 21,12 21,20 16,23 11,20 11,12" fill={C[2]} />
          </G>
        ) : index === 4 ? (
          <G>
            <Path d="M9 4h14l7 8-14 17L2 12z" fill={C[0]} />
            <Path d="M2 12h28L16 29z" fill={C[1]} />
            <Path d="M9 4l3.5 8L16 4l3.5 8L23 4" stroke={C[2]} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
            <Path d="M12.5 12L16 29l3.5-17" stroke={C[2]} strokeWidth={1.2} fill="none" opacity={0.7} />
          </G>
        ) : (
          <G>
            <Gear cx={16} cy={16} r={10} fill={C[0]} shade={C[1]} hole={PAPER} />
            <Path d="M7 25l7.5-7.5" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
            <Circle cx={7} cy={25} r={2.6} fill={NAVY} />
          </G>
        )}
      </Svg>
    </View>
  );
}

export const ICON_COLORS = { NAVY, RED, GOLD, BLUE, GREEN, CREAM, PAPER };
