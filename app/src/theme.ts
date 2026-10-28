import { useColorScheme } from "react-native";

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
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };
