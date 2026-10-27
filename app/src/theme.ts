import { useColorScheme } from "react-native";

// 대학 교재 느낌: 종이색 배경 + 남색 + 포인트 빨강
const light = {
  bg: "#f4eee1",
  paper: "#fbf8f1",
  ink: "#1d2742",
  ink2: "#47506a",
  muted: "#878c99",
  line: "#e3d9c6",
  line2: "#cfc3aa",
  navy: "#1d2742",
  navyInk: "#fbf8f1",
  accent: "#b2342c",
  accentInk: "#ffffff",
  accentSoft: "#f5e1da",
  chip: "#efe7d6",
  flame: "#e0742c",
  success: "#2f7d4f",
  successSoft: "#dff0e4",
};

const dark: typeof light = {
  bg: "#14182a",
  paper: "#1c2135",
  ink: "#ebe6da",
  ink2: "#b8b5c4",
  muted: "#868aa0",
  line: "#2c3250",
  line2: "#3a4163",
  navy: "#c9d3f2",
  navyInk: "#14182a",
  accent: "#e46a5e",
  accentInk: "#1a0f0e",
  accentSoft: "#3b2228",
  chip: "#232842",
  flame: "#f08a45",
  success: "#5cc98a",
  successSoft: "#1d3a2b",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
