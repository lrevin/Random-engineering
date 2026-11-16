/**
 * 앱 전체 색 테마. 상점에서 사는 테마(lib/skins.ts의 THEMES)와 같은 id를 씁니다.
 * 그라데이션은 세 곳에만 씁니다 (많이 쓰면 어수선해짐):
 *  - grad.bg     : 화면 바탕 (아주 옅게)
 *  - grad.accent : 강조 버튼
 *  - grad.hero   : 공부 탭 슬롯머신 몸통 · 테마 미리 보기
 * 카드(paper)는 글이 잘 읽히도록 항상 단색입니다.
 */
export interface Palette {
  mode: "light" | "dark";
  bg: string;
  paper: string;
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  line2: string;
  navy: string;
  navyDeep: string;
  navyInk: string;
  accent: string;
  accentDeep: string;
  accentInk: string;
  accentSoft: string;
  gold: string;
  goldDeep: string;
  goldSoft: string;
  chip: string;
  flame: string;
  success: string;
  successSoft: string;
  slot: string;
  slotWindow: string;
  lever: string;
  slotEdge: string;
  paperEdge: string;
  successDeep: string;
  shadow: string;
  /** 그라데이션 (클래식은 없음 → 단색) */
  grad: { bg: string | null; accent: string | null; hero: string | null };
}

const NONE = { bg: null, accent: null, hero: null };

// ───────── 클래식 (기본 · 무료): 로고(슬롯머신)와 같은 색. 휴대폰 다크 모드를 따라감 ─────────
export const classicLight: Palette = {
  mode: "light",
  bg: "#f2e6ce", paper: "#fffaf0", ink: "#1d2742", ink2: "#46506b", muted: "#857f74",
  line: "#e6d6b6", line2: "#d3bf98", navy: "#1d2742", navyDeep: "#0e1424", navyInk: "#fffaf0",
  accent: "#e0453a", accentDeep: "#b02d26", accentInk: "#ffffff", accentSoft: "#fbe1da",
  gold: "#f7b500", goldDeep: "#c98f00", goldSoft: "#fdefc2", chip: "#ebdcbd", flame: "#ec8a0c",
  success: "#2f7d4f", successSoft: "#dff0e4", successDeep: "#23633e",
  slot: "#1d2742", slotWindow: "#fffaf0", lever: "#1d2742", slotEdge: "#0e1424", paperEdge: "#d2bb8e",
  shadow: "rgba(29, 39, 66, 0.16)", grad: NONE,
};

export const classicDark: Palette = {
  mode: "dark",
  bg: "#111829", paper: "#1b2440", ink: "#f6eedd", ink2: "#c5bfb0", muted: "#8d8fa2",
  line: "#29345a", line2: "#3a4672", navy: "#f2e6ce", navyDeep: "#b9a77f", navyInk: "#1d2742",
  accent: "#ef5a4c", accentDeep: "#b03a2f", accentInk: "#ffffff", accentSoft: "#40232a",
  gold: "#f7b500", goldDeep: "#b88300", goldSoft: "#3b321a", chip: "#26304f", flame: "#f39a2c",
  success: "#5cc98a", successSoft: "#1d3a2b", successDeep: "#3a9a63",
  slot: "#0a0f1d", slotWindow: "#1b2440", lever: "#3a4672", slotEdge: "#05080f", paperEdge: "#0b1120",
  shadow: "rgba(0, 0, 0, 0.5)", grad: NONE,
};

// ───────── 노을 피치: 해 질 녘 복숭아빛 → 연보라. 따뜻하고 부드러운 분위기 ─────────
const sunset: Palette = {
  mode: "light",
  bg: "#fff1ea", paper: "#fffbf8", ink: "#3a2340", ink2: "#6b4e6e", muted: "#9c8494",
  line: "#f3dcd6", line2: "#e7c3bc", navy: "#4a2c5e", navyDeep: "#2e1a3d", navyInk: "#fff7f2",
  accent: "#e94e63", accentDeep: "#c03a50", accentInk: "#ffffff", accentSoft: "#ffe1e3",
  gold: "#ffb547", goldDeep: "#e08e12", goldSoft: "#ffefd2", chip: "#fbe4df", flame: "#ff7a45",
  success: "#2e9e6b", successSoft: "#ddf5e8", successDeep: "#1f7a50",
  slot: "#4a2c5e", slotWindow: "#fffbf8", lever: "#4a2c5e", slotEdge: "#2e1a3d", paperEdge: "#ebc9c0",
  shadow: "rgba(74, 44, 94, 0.16)",
  grad: {
    bg: "linear-gradient(180deg, #fff1e6 0%, #ffe8ec 55%, #f5e9ff 100%)",
    accent: "linear-gradient(120deg, #f2683f 0%, #e94e63 55%, #d6447f 100%)",
    hero: "linear-gradient(160deg, #7a4596 0%, #4a2c5e 58%, #3a2350 100%)",
  },
};

// ───────── 오로라 민트: 민트 → 하늘빛. 맑고 시원한 아침 분위기 ─────────
const aurora: Palette = {
  mode: "light",
  bg: "#ecf9f6", paper: "#fbfffe", ink: "#0f3442", ink2: "#3f6270", muted: "#7e9aa3",
  line: "#d3ece8", line2: "#b7dcd6", navy: "#0f4c5c", navyDeep: "#083541", navyInk: "#f2fffc",
  accent: "#1b7fc4", accentDeep: "#13608f", accentInk: "#ffffff", accentSoft: "#dcefff",
  gold: "#f5a623", goldDeep: "#cc8410", goldSoft: "#fff0d1", chip: "#ddf2ee", flame: "#ff8a3d",
  success: "#12a07a", successSoft: "#d7f5ec", successDeep: "#0b7a5c",
  slot: "#0f4c5c", slotWindow: "#fbfffe", lever: "#0f4c5c", slotEdge: "#083541", paperEdge: "#bfddd8",
  shadow: "rgba(15, 76, 92, 0.15)",
  grad: {
    bg: "linear-gradient(180deg, #e7fbf4 0%, #e6f5ff 60%, #eef0ff 100%)",
    accent: "linear-gradient(120deg, #0e9f8a 0%, #1b7fc4 100%)",
    hero: "linear-gradient(160deg, #158f8c 0%, #0f4c5c 62%, #0b3a55 100%)",
  },
};

// ───────── 라벤더 드림: 연보라 → 벚꽃 분홍. 몽글몽글한 파스텔 ─────────
const lavender: Palette = {
  mode: "light",
  bg: "#f6f0ff", paper: "#fffcff", ink: "#2d2559", ink2: "#5b5288", muted: "#9089b3",
  line: "#e6ddf7", line2: "#d3c5f0", navy: "#4b3b9a", navyDeep: "#322673", navyInk: "#fbf8ff",
  accent: "#c94589", accentDeep: "#9e2f69", accentInk: "#ffffff", accentSoft: "#fce1ef",
  gold: "#f6b93b", goldDeep: "#d0901a", goldSoft: "#fff1d3", chip: "#eee6fb", flame: "#f2853e",
  success: "#2f9e77", successSoft: "#ddf4ea", successDeep: "#217a5b",
  slot: "#4b3b9a", slotWindow: "#fffcff", lever: "#4b3b9a", slotEdge: "#322673", paperEdge: "#d8cbf0",
  shadow: "rgba(75, 59, 154, 0.15)",
  grad: {
    bg: "linear-gradient(180deg, #f4edff 0%, #fdeff8 55%, #edf2ff 100%)",
    accent: "linear-gradient(120deg, #8a5cf5 0%, #c94589 100%)",
    hero: "linear-gradient(160deg, #7b5ce0 0%, #4b3b9a 60%, #3a2c7d 100%)",
  },
};

// ───────── 미드나잇 네온: 깊은 남보라 밤하늘 + 하늘빛 · 보랏빛 네온. 어두운 테마 ─────────
const midnight: Palette = {
  mode: "dark",
  bg: "#0e1230", paper: "#1a1f42", ink: "#eef0ff", ink2: "#b9bedd", muted: "#8088b2",
  line: "#2a3163", line2: "#3a4283", navy: "#c7d2fe", navyDeep: "#8e9be6", navyInk: "#10142c",
  accent: "#7c6cf2", accentDeep: "#5a49cc", accentInk: "#ffffff", accentSoft: "#2b2558",
  gold: "#fcd34d", goldDeep: "#d9a91f", goldSoft: "#3a3218", chip: "#232a55", flame: "#fb923c",
  success: "#4fd69c", successSoft: "#173a2e", successDeep: "#2fa574",
  slot: "#171b44", slotWindow: "#1a1f42", lever: "#4a54a8", slotEdge: "#070a1c", paperEdge: "#0a0d22",
  shadow: "rgba(0, 0, 0, 0.5)",
  grad: {
    bg: "linear-gradient(180deg, #0e1330 0%, #161437 50%, #20123a 100%)",
    accent: "linear-gradient(120deg, #2b8fe0 0%, #7c6cf2 100%)",
    hero: "linear-gradient(160deg, #2e3486 0%, #1b1f55 55%, #121540 100%)",
  },
};

/** 테마 id → 색 (클래식은 휴대폰 다크 모드에 따라 classicLight / classicDark) */
export const PALETTES: Record<string, Palette> = { sunset, aurora, lavender, midnight };

export function paletteFor(themeId: string, scheme: string | null | undefined): Palette {
  return PALETTES[themeId] ?? (scheme === "dark" ? classicDark : classicLight);
}
