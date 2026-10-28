import { useColorScheme, type ViewStyle } from "react-native";

// 로고(슬롯머신)와 같은 색: 크림 배경 + 남색 기계 + 빨강 레버 + 노랑 불빛
const light = {
  bg: "#f2e6ce",
  paper: "#fffaf0",
  ink: "#1d2742",
  ink2: "#46506b",
  muted: "#857f74",
  line: "#e6d6b6",
  line2: "#d3bf98",
  navy: "#1d2742",
  navyDeep: "#0e1424",
  navyInk: "#fffaf0",
  accent: "#e0453a",
  accentDeep: "#b02d26",
  accentInk: "#ffffff",
  accentSoft: "#fbe1da",
  gold: "#f7b500",
  goldDeep: "#c98f00",
  goldSoft: "#fdefc2",
  chip: "#ebdcbd",
  flame: "#ec8a0c",
  success: "#2f7d4f",
  successSoft: "#dff0e4",
  slot: "#1d2742",
  slotWindow: "#fffaf0",
  lever: "#1d2742",
  slotEdge: "#0e1424",
  paperEdge: "#d2bb8e",
  successDeep: "#23633e",
  shadow: "rgba(29, 39, 66, 0.16)",
};

const dark: typeof light = {
  bg: "#111829",
  paper: "#1b2440",
  ink: "#f6eedd",
  ink2: "#c5bfb0",
  muted: "#8d8fa2",
  line: "#29345a",
  line2: "#3a4672",
  navy: "#f2e6ce",
  navyDeep: "#b9a77f",
  navyInk: "#1d2742",
  accent: "#ef5a4c",
  accentDeep: "#b03a2f",
  accentInk: "#ffffff",
  accentSoft: "#40232a",
  gold: "#f7b500",
  goldDeep: "#b88300",
  goldSoft: "#3b321a",
  chip: "#26304f",
  flame: "#f39a2c",
  success: "#5cc98a",
  successSoft: "#1d3a2b",
  slot: "#0a0f1d",
  slotWindow: "#1b2440",
  lever: "#3a4672",
  slotEdge: "#05080f",
  paperEdge: "#0b1120",
  successDeep: "#3a9a63",
  shadow: "rgba(0, 0, 0, 0.5)",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };

/** 그림자: 1 = 버튼·작은 칸, 2 = 카드, 3 = 떠 있는 판 */
export function shadow(c: Colors, level: 1 | 2 | 3 = 1): ViewStyle {
  const [y, blur] = ({ 1: [2, 4], 2: [4, 12], 3: [10, 24] } as const)[level];
  return { boxShadow: `0px ${y}px ${blur}px ${c.shadow}` };
}

/** 움푹 들어간 홈 (분할 버튼 바탕, 입력칸) */
export const inset = (c: Colors) => ({ boxShadow: `inset 0px 2px 3px ${c.shadow}` });

/**
 * 눌리는 입체 면 (듀오링고식): 아래쪽에 두꺼운 테두리를 두고, 누르면 그만큼 내려감.
 * 전체 높이는 그대로라 주변 배치가 흔들리지 않음.
 */
export function raised(edge: string, pressed: boolean, depth = 4): ViewStyle {
  return { borderBottomWidth: pressed ? 1 : depth, borderBottomColor: edge, marginTop: pressed ? depth - 1 : 0 };
}
