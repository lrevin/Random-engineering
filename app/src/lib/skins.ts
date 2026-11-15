import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCAL_KEYS } from "./local-data";
import { useSyncExternalStore } from "react";

/**
 * 꾸미기: 슬롯머신 스킨 · 칭호. 산 것과 고른 것은 이 휴대폰에 저장합니다.
 * - 일반 스킨: 언제든 톱니바퀴로 삼
 * - 연속 기록 스킨: 연속 7 · 30 · 100일 보상으로만 받음 (lib/milestones.ts)
 * - 시즌 스킨: 정해진 달에만 상점에 나옴 (그 달이 지나면 못 삼, 산 건 계속 씀)
 */
export type SkinSource =
  | { kind: "shop" }
  | { kind: "streak"; days: number }
  | { kind: "season"; months: number[]; label: string };

export interface SlotSkin {
  id: string;
  name: string;
  desc: string;
  /** 톱니바퀴 가격 (0 = 처음부터 가짐 · 보상 스킨은 0) */
  price: number;
  source: SkinSource;
  /** 색: 없으면 앱 테마 기본색 */
  body?: string;
  edge?: string;
  /** 위쪽 불빛 [양옆, 가운데] */
  lights?: [string, string];
  knob?: string;
  knobDeep?: string;
  lever?: string;
  /** 당첨선 세모 */
  pointer?: string;
}

const SHOP: SkinSource = { kind: "shop" };

export const SKINS: SlotSkin[] = [
  { id: "classic", name: "클래식 네이비", desc: "뽑공 로고와 같은 기본 슬롯머신", price: 0, source: SHOP },
  {
    id: "cherry", name: "체리 레드", desc: "오락실 느낌의 빨간 슬롯머신", price: 150, source: SHOP,
    body: "#c2352c", edge: "#8f211b", lights: ["#ffd166", "#fffaf0"], knob: "#f7b500", knobDeep: "#c98f00", lever: "#5a1612", pointer: "#f7b500",
  },
  {
    id: "mint", name: "민트 소다", desc: "시원한 민트색에 주황 손잡이", price: 150, source: SHOP,
    body: "#1f9d8f", edge: "#14756a", lights: ["#fffaf0", "#ffd166"], knob: "#ff7a59", knobDeep: "#d15a3c", lever: "#0f5c54", pointer: "#ff7a59",
  },
  {
    id: "galaxy", name: "갤럭시 퍼플", desc: "보랏빛 몸통에 네온 불빛", price: 250, source: SHOP,
    body: "#4b2f8f", edge: "#331f66", lights: ["#7ee0ff", "#ff7ad9"], knob: "#7ee0ff", knobDeep: "#3fa9cc", lever: "#2a1a55", pointer: "#ff7ad9",
  },
  {
    id: "gold", name: "골드 잭팟", desc: "번쩍이는 황금 슬롯머신", price: 400, source: SHOP,
    body: "#d4a017", edge: "#a57a0c", lights: ["#e0453a", "#fffaf0"], knob: "#e0453a", knobDeep: "#b02d26", lever: "#7a5a08", pointer: "#e0453a",
  },
  // ── 연속 기록 보상 (한정)
  {
    id: "sprout", name: "새싹 그린", desc: "연속 7일 달성 보상", price: 0, source: { kind: "streak", days: 7 },
    body: "#3f9d4a", edge: "#2b7535", lights: ["#d8f5a2", "#fffaf0"], knob: "#f7b500", knobDeep: "#c98f00", lever: "#1f5a28", pointer: "#d8f5a2",
  },
  {
    id: "blaze", name: "불꽃 스트릭", desc: "연속 30일 달성 보상", price: 0, source: { kind: "streak", days: 30 },
    body: "#e2611b", edge: "#a8440f", lights: ["#ffd23f", "#fff3c4"], knob: "#ffd23f", knobDeep: "#d1a10c", lever: "#7a2e06", pointer: "#ffd23f",
  },
  {
    id: "diamond", name: "다이아 레전드", desc: "연속 100일 달성 보상", price: 0, source: { kind: "streak", days: 100 },
    body: "#2f6fd0", edge: "#1f4f9a", lights: ["#c8e6ff", "#ffffff"], knob: "#c8e6ff", knobDeep: "#86b6e6", lever: "#163a72", pointer: "#c8e6ff",
  },
  // ── 시즌 한정 (정해진 달에만 상점에 나옴)
  {
    id: "maple", name: "가을 단풍", desc: "9~11월 한정 · 붉게 물든 단풍", price: 300, source: { kind: "season", months: [9, 10, 11], label: "9~11월" },
    body: "#b5532a", edge: "#84391b", lights: ["#ffb347", "#ffe08a"], knob: "#ffb347", knobDeep: "#cc8420", lever: "#5c2810", pointer: "#ffb347",
  },
  {
    id: "snow", name: "윈터 스노우", desc: "12~2월 한정 · 눈 내린 겨울", price: 300, source: { kind: "season", months: [12, 1, 2], label: "12~2월" },
    body: "#7fa7c9", edge: "#5a7f9f", lights: ["#ffffff", "#e0453a"], knob: "#ffffff", knobDeep: "#c9d6e2", lever: "#3c5a75", pointer: "#e0453a",
  },
  {
    id: "owl", name: "시험기간 올빼미", desc: "4·6·10·12월 한정 · 밤샘 공부의 동반자", price: 300, source: { kind: "season", months: [4, 6, 10, 12], label: "시험기간(4·6·10·12월)" },
    body: "#232946", edge: "#121629", lights: ["#ffd803", "#eebbc3"], knob: "#ffd803", knobDeep: "#c9a800", lever: "#0b0d1a", pointer: "#ffd803",
  },
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** 시즌 스킨이 지금 상점에 나와 있는지 */
export const inSeason = (s: SlotSkin, now = new Date()) => s.source.kind !== "season" || s.source.months.includes(now.getMonth() + 1);

// ───────── 칭호: 닉네임 옆에 붙는 짧은 이름 ─────────
export type TitleSource =
  | { kind: "streak"; days: number }
  | { kind: "achievement"; id: string; stage: number }
  | { kind: "season"; months: number[]; label: string; price: number };

export interface TitleDef { id: string; name: string; desc: string; color: string; source: TitleSource }

export const TITLES: TitleDef[] = [
  { id: "t-streak7", name: "꾸준한 공대생", desc: "연속 7일 달성 보상", color: "#2f8f5b", source: { kind: "streak", days: 7 } },
  { id: "t-streak30", name: "한 달 개근", desc: "연속 30일 달성 보상", color: "#e2611b", source: { kind: "streak", days: 30 } },
  { id: "t-streak100", name: "백일의 전설", desc: "연속 100일 달성 보상", color: "#2f6fd0", source: { kind: "streak", days: 100 } },
  { id: "t-perfect", name: "만점왕", desc: "업적 '만점왕' 1단계", color: "#e0453a", source: { kind: "achievement", id: "perfect", stage: 1 } },
  { id: "t-explorer", name: "주제 탐험가", desc: "업적 '탐험가' 2단계", color: "#3d8bdf", source: { kind: "achievement", id: "topics", stage: 2 } },
  { id: "t-battle", name: "승부사", desc: "업적 '승부사' 2단계", color: "#a05bd1", source: { kind: "achievement", id: "battle", stage: 2 } },
  { id: "t-engineer", name: "엔지니어", desc: "업적 '엔지니어' 1단계", color: "#6b7a90", source: { kind: "achievement", id: "engineer", stage: 1 } },
  { id: "t-pass", name: "합격 예감", desc: "업적 '합격권' 1단계", color: "#2f8f5b", source: { kind: "achievement", id: "examPass", stage: 1 } },
  { id: "t-autumn", name: "가을 독서왕", desc: "9~11월 한정 칭호", color: "#b5532a", source: { kind: "season", months: [9, 10, 11], label: "9~11월", price: 120 } },
  { id: "t-winter", name: "눈 속의 공부벌레", desc: "12~2월 한정 칭호", color: "#5a7f9f", source: { kind: "season", months: [12, 1, 2], label: "12~2월", price: 120 } },
  { id: "t-exam", name: "밤샘 수험생", desc: "시험기간(4·6·10·12월) 한정 칭호", color: "#232946", source: { kind: "season", months: [4, 6, 10, 12], label: "시험기간", price: 120 } },
];

export const titleById = (id: string | null | undefined) => TITLES.find((t) => t.id === id);
export const titleInSeason = (t: TitleDef, now = new Date()) => t.source.kind !== "season" || t.source.months.includes(now.getMonth() + 1);

// ───────── 저장 ─────────
interface CosmeticState {
  owned: string[];
  active: string;
  /** 가진 칭호 (보상·구매로 받은 것. 업적 칭호는 업적을 깨면 자동으로 쓸 수 있음) */
  titles: string[];
  /** 쓰는 칭호 (없으면 null) */
  title: string | null;
  /** 받은 연속 기록 보상 (일수) */
  milestones: number[];
}
const KEY = LOCAL_KEYS.skins.key;
const INITIAL: CosmeticState = { owned: ["classic"], active: "classic", titles: [], title: null, milestones: [] };
let state: CosmeticState = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function set(next: CosmeticState, save = true) {
  state = next;
  listeners.forEach((f) => f());
  if (save) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

const arr = (x: unknown) => (Array.isArray(x) ? x : []);

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      const s = raw ? (JSON.parse(raw) as Partial<CosmeticState>) : null;
      if (!s) return;
      const owned = ["classic", ...arr(s.owned)].filter((id, i, xs) => SKINS.some((k) => k.id === id) && xs.indexOf(id) === i);
      const titles = arr(s.titles).filter((id) => TITLES.some((t) => t.id === id));
      set({
        owned,
        active: owned.includes(s.active ?? "") ? (s.active as string) : "classic",
        titles,
        title: titleById(s.title) ? (s.title as string) : null,
        milestones: arr(s.milestones).filter((n) => typeof n === "number"),
      }, false);
    })
    .catch(() => {});
}

const subscribe = (f: () => void) => {
  load();
  listeners.add(f);
  return () => { listeners.delete(f); };
};
const snapshot = () => state;

/** 꾸미기 상태 (바뀌면 화면이 다시 그려짐) */
export function useCosmetics() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** 가진 스킨 · 쓰는 스킨 */
export function useSkins() {
  const s = useCosmetics();
  return { owned: s.owned, active: skinById(s.active) };
}

/** 산(받은) 스킨을 목록에 넣고 바로 적용 */
export function addSkin(id: string, apply = true) {
  if (!SKINS.some((s) => s.id === id)) return;
  set({ ...state, owned: [...new Set([...state.owned, id])], active: apply ? id : state.active });
}

/** 가진 스킨으로 바꾸기 */
export function applySkin(id: string) {
  if (state.owned.includes(id)) set({ ...state, active: id });
}

/** 칭호 받기 (보상·구매) */
export function addTitle(id: string) {
  if (!titleById(id)) return;
  set({ ...state, titles: [...new Set([...state.titles, id])] });
}

/** 쓰는 칭호 바꾸기 (null = 칭호 안 씀) */
export function applyTitle(id: string | null) {
  set({ ...state, title: id });
}

/** 개발·시연용: 모든 스킨과 칭호를 가진 상태로 (쓰는 스킨·칭호는 그대로) */
export function unlockAllCosmetics() {
  set({ ...state, owned: SKINS.map((x) => x.id), titles: TITLES.map((t) => t.id) });
}

/** 연속 기록 보상을 받은 것으로 표시. 이미 받았으면 false */
export function markMilestone(days: number) {
  if (state.milestones.includes(days)) return false;
  set({ ...state, milestones: [...state.milestones, days] });
  return true;
}

/** 둘러보기 데이터 지우기 등: 처음 상태로 */
export function resetSkins() {
  set(INITIAL);
}
