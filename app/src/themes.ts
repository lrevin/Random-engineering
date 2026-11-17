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

// ───────── 허니 레몬: 레몬빛 바탕에 꿀처럼 번지는 살구빛, 따뜻한 갈색 슬롯머신, 귤색 강조. 햇살 드는 오후 분위기 ─────────
const honey: Palette = {
  mode: "light",
  bg: "#fff8e3", paper: "#fffdf6", ink: "#3b2a14", ink2: "#6b5638", muted: "#97876a",
  line: "#f2e6c4", line2: "#e6d4a3", navy: "#5a3a1c", navyDeep: "#3e2710", navyInk: "#fffaf0",
  accent: "#d45d0e", accentDeep: "#a54707", accentInk: "#ffffff", accentSoft: "#ffe6cf",
  gold: "#f5b70a", goldDeep: "#c98f00", goldSoft: "#fff1c4", chip: "#f7ecd0", flame: "#f07c1a",
  success: "#3c8f4a", successSoft: "#e3f3dc", successDeep: "#2c6e38",
  slot: "#5a3a1c", slotWindow: "#fffdf6", lever: "#5a3a1c", slotEdge: "#3e2710", paperEdge: "#e8d7a8",
  shadow: "rgba(90, 58, 28, 0.15)",
  grad: {
    bg: "linear-gradient(180deg, #fffbe2 0%, #fff3d2 55%, #ffe7d3 100%)",
    accent: "linear-gradient(120deg, #e07812 0%, #d45d0e 55%, #bd490a 100%)",
    hero: "linear-gradient(160deg, #7d5429 0%, #5a3a1c 58%, #43290f 100%)",
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

// ───────── 벚꽃 말차: 말차 초록 바탕 + 벚꽃 분홍 강조. 차분하고 산뜻한 봄 찻집 분위기 ─────────
const matcha: Palette = {
  mode: "light",
  bg: "#f3f6ea", paper: "#fffdf7", ink: "#1f3324", ink2: "#4a5e4c", muted: "#879483",
  line: "#e1e8d2", line2: "#cbd6b6", navy: "#2f5a3a", navyDeep: "#1e3f27", navyInk: "#fbfff6",
  accent: "#d94c76", accentDeep: "#b03a60", accentInk: "#ffffff", accentSoft: "#fde3ea",
  gold: "#e9b949", goldDeep: "#c2921f", goldSoft: "#fbf0cf", chip: "#e8eedb", flame: "#f08a3c",
  success: "#3f8f4f", successSoft: "#e1f2dc", successDeep: "#2d6d3a",
  slot: "#2f5a3a", slotWindow: "#fffdf7", lever: "#2f5a3a", slotEdge: "#1e3f27", paperEdge: "#d3dcc0",
  shadow: "rgba(47, 90, 58, 0.15)",
  grad: {
    bg: "linear-gradient(180deg, #eff6e2 0%, #faf4ea 55%, #fdeef3 100%)",
    accent: "linear-gradient(120deg, #f07a9b 0%, #d94c76 55%, #c2457a 100%)",
    hero: "linear-gradient(160deg, #6a9a55 0%, #2f5a3a 58%, #1f4129 100%)",
  },
};

// ───────── 옵시디언 골드: 흑요석 같은 검정 + 금빛 강조. 어두운 고급 테마 ─────────
const obsidian: Palette = {
  mode: "dark",
  bg: "#0f0f12", paper: "#1a1a1f", ink: "#f5efe1", ink2: "#c9c0aa", muted: "#8f8878",
  line: "#2a2a31", line2: "#3b3a43", navy: "#f0d9a0", navyDeep: "#b99a55", navyInk: "#17140c",
  accent: "#e2b04a", accentDeep: "#a87d26", accentInk: "#1a1408", accentSoft: "#3a301a",
  gold: "#ffd47a", goldDeep: "#d1a43c", goldSoft: "#3b3220", chip: "#24242b", flame: "#f59a3c",
  success: "#6fd19a", successSoft: "#1b3326", successDeep: "#3f9f68",
  slot: "#141418", slotWindow: "#1a1a1f", lever: "#4a4652", slotEdge: "#050507", paperEdge: "#08080a",
  shadow: "rgba(0, 0, 0, 0.55)",
  grad: {
    bg: "linear-gradient(180deg, #111115 0%, #16141a 55%, #1e1911 100%)",
    accent: "linear-gradient(120deg, #f7d986 0%, #e2b04a 50%, #c48c2c 100%)",
    hero: "linear-gradient(160deg, #3a3224 0%, #18161c 55%, #0b0b0e 100%)",
  },
};

// ───────── 프리즘 오팔 (프리미엄 전용): 오팔 보석처럼 분홍 · 라일락 · 하늘 · 민트가 은은하게 번지는 진줏빛 바탕,
// 로열 인디고 슬롯머신, 홀로그램처럼 분홍 → 보라 → 파랑으로 흐르는 강조 버튼. 금빛은 왕관 · 톱니바퀴에만 ─────────
const prism: Palette = {
  mode: "light",
  bg: "#f7f3ff", paper: "#fffdff", ink: "#221a4c", ink2: "#544a80", muted: "#8a83ad",
  line: "#e9e2f8", line2: "#d8cdf1", navy: "#2a1f6e", navyDeep: "#191255", navyInk: "#fdfbff",
  accent: "#7b3ff2", accentDeep: "#5726c7", accentInk: "#ffffff", accentSoft: "#efe5ff",
  gold: "#f4b740", goldDeep: "#d1911a", goldSoft: "#fff2d8", chip: "#f0eafc", flame: "#ff7a5c",
  success: "#169e78", successSoft: "#dbf5ec", successDeep: "#0f7c5d",
  slot: "#2a1f6e", slotWindow: "#fffdff", lever: "#2a1f6e", slotEdge: "#191255", paperEdge: "#dccff3",
  shadow: "rgba(42, 31, 110, 0.16)",
  grad: {
    bg: "linear-gradient(160deg, #fdeef8 0%, #f1ebff 34%, #e8f2ff 68%, #e9fbf4 100%)",
    accent: "linear-gradient(115deg, #ff5fa2 0%, #a14cf5 42%, #5b6ff7 78%, #3f9bf5 100%)",
    hero: "linear-gradient(155deg, #5a35b8 0%, #2a1f6e 48%, #1c2a78 100%)",
  },
};

// ───────── 블러드 이클립스 (오답 보스전 클리어 전용 · 0.01%): 달이 해를 가린 순간의 검붉은 하늘,
// 불꽃 코로나처럼 주황 → 진홍 → 자주로 타오르는 강조, 코로나의 옅은 금빛 슬롯머신 ─────────
const eclipse: Palette = {
  mode: "dark",
  bg: "#120a10", paper: "#1d1119", ink: "#fbeee9", ink2: "#dcbfc3", muted: "#9d8088",
  line: "#2f1b27", line2: "#452938", navy: "#ffe3c2", navyDeep: "#d9a877", navyInk: "#1d0f0c",
  accent: "#ff4d5e", accentDeep: "#b81f3a", accentInk: "#ffffff", accentSoft: "#3f1621",
  gold: "#ffc46b", goldDeep: "#e0913a", goldSoft: "#3a2418", chip: "#28161f", flame: "#ff7a3c",
  success: "#6fd8a8", successSoft: "#17322a", successDeep: "#3fa77a",
  slot: "#1a0d16", slotWindow: "#1d1119", lever: "#5a2a3e", slotEdge: "#070306", paperEdge: "#0a0408",
  shadow: "rgba(0, 0, 0, 0.6)",
  grad: {
    bg: "linear-gradient(175deg, #1c0c15 0%, #120a10 45%, #1f0c13 80%, #2c0f10 100%)",
    accent: "linear-gradient(115deg, #ffb35c 0%, #ff5a4e 40%, #e0245e 75%, #9b1b6a 100%)",
    hero: "linear-gradient(160deg, #5c1a2e 0%, #26101d 50%, #0d060b 100%)",
  },
};

/** 테마 id → 색 (클래식은 휴대폰 다크 모드에 따라 classicLight / classicDark) */
export const PALETTES: Record<string, Palette> = { sunset, aurora, honey, midnight, matcha, obsidian, prism, eclipse };

export function paletteFor(themeId: string, scheme: string | null | undefined): Palette {
  return PALETTES[themeId] ?? (scheme === "dark" ? classicDark : classicLight);
}
