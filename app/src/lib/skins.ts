import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCAL_KEYS } from "./local-data";
import { useSyncExternalStore } from "react";

/**
 * 꾸미기: 앱 전체 색 테마 + 칭호. 산 것과 고른 것은 이 휴대폰에 저장합니다 (회원은 서버 응답을 그대로 씀).
 * - 테마: 상점에서 톱니바퀴로 삼. 색은 src/themes.ts, 고른 테마는 useColors()가 앱 전체에 적용
 * - 칭호: 연속 기록 보상 · 업적으로만 받음 (팔지 않음)
 * 서버(member_cosmetics)에는 예전 '스킨' 칸(item_type='skin')에 테마 id를 저장합니다. 상품 id: "skin:<테마 id>"
 */
export interface ThemeDef {
  id: string;
  name: string;
  desc: string;
  /** 톱니바퀴 가격 (0 = 처음부터 가짐) */
  price: number;
}

// 가격: 꾸준한 사용자가 주 400개 안팎(광고 포함)을 버니 2~5주 모아서 사는 목표 아이템. 서버 purchase-policy.mjs와 같아야 함
export const THEMES: ThemeDef[] = [
  { id: "classic", name: "클래식", desc: "뽑공 로고의 크림 · 남색 · 빨강. 휴대폰 다크 모드를 따라가요", price: 0 },
  { id: "sunset", name: "노을 피치", desc: "해 질 녘 복숭아빛이 연보라로 번지는 따뜻한 테마", price: 900 },
  { id: "aurora", name: "오로라 민트", desc: "민트에서 하늘빛으로, 맑고 시원한 아침 같은 테마", price: 900 },
  { id: "lavender", name: "라벤더 드림", desc: "연보라와 벚꽃 분홍이 섞인 몽글몽글한 파스텔 테마", price: 1200 },
  { id: "midnight", name: "미드나잇 네온", desc: "깊은 밤하늘에 하늘빛 · 보랏빛 네온이 흐르는 어두운 테마", price: 1800 },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
const isTheme = (id: unknown): id is string => typeof id === "string" && THEMES.some((t) => t.id === id);

// ───────── 칭호: 닉네임 옆에 붙는 짧은 이름 (보상으로만 받음) ─────────
export type TitleSource =
  | { kind: "streak"; days: number }
  | { kind: "achievement"; id: string; stage: number };

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
];

export const titleById = (id: string | null | undefined) => TITLES.find((t) => t.id === id);

// ───────── 저장 ─────────
interface CosmeticState {
  /** 가진 테마 */
  owned: string[];
  /** 쓰는 테마 */
  active: string;
  /** 가진 칭호 (보상으로 받은 것. 업적 칭호는 업적을 깨면 자동으로 쓸 수 있음) */
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
      // 예전 슬롯머신 스킨 id는 테마가 아니므로 빠지고, 쓰던 것이 없으면 클래식으로
      const owned = ["classic", ...arr(s.owned)].filter((id, i, xs) => isTheme(id) && xs.indexOf(id) === i);
      set({
        owned,
        active: owned.includes(s.active ?? "") ? (s.active as string) : "classic",
        titles: arr(s.titles).filter((id) => !!titleById(id)),
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
const activeSnapshot = () => state.active;

/** 꾸미기 상태 (바뀌면 화면이 다시 그려짐) */
export function useCosmetics() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** 쓰는 테마 id만 (색을 쓰는 모든 화면이 부르므로, 테마가 바뀔 때만 다시 그려지게 따로 둠) */
export function useActiveThemeId() {
  return useSyncExternalStore(subscribe, activeSnapshot, activeSnapshot);
}

/** 가진 테마 · 쓰는 테마 */
export function useThemes() {
  const s = useCosmetics();
  return { owned: s.owned, active: themeById(s.active) };
}

/** 산 테마를 목록에 넣고 바로 적용 */
export function addTheme(id: string, apply = true) {
  if (!isTheme(id)) return;
  set({ ...state, owned: [...new Set([...state.owned, id])], active: apply ? id : state.active });
}

/** 가진 테마로 바꾸기 */
export function applyTheme(id: string) {
  if (state.owned.includes(id)) set({ ...state, active: id });
}

/** 칭호 받기 (보상) */
export function addTitle(id: string) {
  if (!titleById(id)) return;
  set({ ...state, titles: [...new Set([...state.titles, id])] });
}

/** 쓰는 칭호 바꾸기 (null = 칭호 안 씀) */
export function applyTitle(id: string | null) {
  set({ ...state, title: id });
}

/** 회원 소유권은 서버 응답만 적용한다. 기기 해금 데이터를 업로드하지 않는다. (서버의 skin 칸 = 테마) */
export function applyServerCosmetics(a: { ownedSkins: string[]; ownedTitles: string[]; activeSkin: string; activeTitle: string | null }) {
  loaded = true;
  const owned = ["classic", ...a.ownedSkins].filter((id, i, xs) => isTheme(id) && xs.indexOf(id) === i);
  set({ owned, active: owned.includes(a.activeSkin) ? a.activeSkin : "classic", titles: a.ownedTitles, title: a.activeTitle, milestones: [] }, false);
}

/** 개발·시연용: 모든 테마와 칭호를 가진 상태로 (쓰는 테마·칭호는 그대로) */
export function unlockAllCosmetics() {
  set({ ...state, owned: THEMES.map((x) => x.id), titles: TITLES.map((t) => t.id) });
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
