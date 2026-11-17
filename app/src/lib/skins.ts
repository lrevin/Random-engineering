import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCAL_KEYS } from "./local-data";
import { useSyncExternalStore } from "react";
import type { IconName } from "../components/Icon";
import { applyServerLooks, resetProfileLook } from "./profile-look";

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
  /** 톱니바퀴 가격 (0 = 처음부터 가짐 · 또는 프리미엄 전용) */
  price: number;
  /** 프리미엄 멤버십 전용 (팔지 않음, 프리미엄인 동안 쓸 수 있음. 서버 purchase-policy.mjs PREMIUM_THEMES와 같음) */
  premium?: boolean;
  /** 오답 보스전 클리어 보상으로만 얻음 (팔지 않음, 0.01% 확률. 서버 team-policy.mjs BOSS_THEME) */
  boss?: boolean;
}

// 가격: 꾸준한 사용자가 주 400개 안팎(광고 포함)을 버니 2~5주 모아서 사는 목표 아이템. 서버 purchase-policy.mjs와 같아야 함
export const THEMES: ThemeDef[] = [
  { id: "classic", name: "클래식", desc: "뽑공 로고의 크림 · 남색 · 빨강. 휴대폰 다크 모드를 따라가요", price: 0 },
  { id: "sunset", name: "노을 피치", desc: "해 질 녘 복숭아빛이 연보라로 번지는 따뜻한 테마", price: 900 },
  { id: "aurora", name: "오로라 민트", desc: "민트에서 하늘빛으로, 맑고 시원한 아침 같은 테마", price: 900 },
  { id: "honey", name: "허니 레몬", desc: "레몬빛 바탕에 꿀처럼 번지는 살구빛, 햇살 드는 오후 같은 따뜻한 테마", price: 1200 },
  { id: "midnight", name: "미드나잇 네온", desc: "깊은 밤하늘에 하늘빛 · 보랏빛 네온이 흐르는 어두운 테마", price: 1200 },
  { id: "matcha", name: "벚꽃 말차", desc: "말차 초록 위로 벚꽃 분홍이 피어나는 봄 찻집 같은 테마", price: 2000 },
  { id: "prism", name: "프리즘 오팔", desc: "오팔 보석처럼 분홍 · 라일락 · 하늘빛이 번지고, 버튼에 홀로그램 빛이 흐르는 프리미엄 전용 테마", price: 0, premium: true },
  { id: "obsidian", name: "옵시디언 골드", desc: "흑요석처럼 깊은 검정에 금빛이 번지는 고급스러운 어두운 테마", price: 2000 },
  { id: "eclipse", name: "블러드 이클립스", desc: "달이 해를 가린 순간, 검붉은 하늘에 불꽃 코로나가 타오르는 오답 보스전 전용 테마", price: 0, boss: true },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
/** 프리미엄 전용 테마인지 */
export const isPremiumTheme = (id: string) => THEMES.find((t) => t.id === id)?.premium === true;
const isTheme = (id: unknown): id is string => typeof id === "string" && THEMES.some((t) => t.id === id);

// ───────── 칭호: 닉네임 옆에 붙는 짧은 이름 (보상으로만 받음) ─────────
export type TitleSource =
  | { kind: "streak"; days: number }
  | { kind: "achievement"; id: string; stage: number };

/** 칭호 등급 (RPG처럼): 희귀 < 영웅 < 전설 < 신화. 배지 장식 · 빛 효과가 달라짐 (components/TitleBadge.tsx) */
export type TitleRarity = "rare" | "epic" | "legendary" | "mythic";
export interface TitleDef {
  id: string; name: string; desc: string; color: string; source: TitleSource;
  rarity: TitleRarity;
  /** 배지 왼쪽 보석 엠블럼에 들어가는 그림 */
  icon: IconName;
}

export const TITLES: TitleDef[] = [
  { id: "t-streak7", name: "꾸준한 공대생", desc: "연속 7일 달성 보상", color: "#2f8f5b", source: { kind: "streak", days: 7 }, rarity: "rare", icon: "flame" },
  { id: "t-streak30", name: "한 달 개근", desc: "연속 30일 달성 보상", color: "#e2611b", source: { kind: "streak", days: 30 }, rarity: "epic", icon: "flame" },
  { id: "t-streak100", name: "백일의 전설", desc: "연속 100일 달성 보상", color: "#2f6fd0", source: { kind: "streak", days: 100 }, rarity: "legendary", icon: "crown" },
  { id: "t-perfect", name: "만점왕", desc: "업적 '만점왕' 1단계", color: "#e0453a", source: { kind: "achievement", id: "perfect", stage: 1 }, rarity: "epic", icon: "star" },
  { id: "t-explorer", name: "주제 탐험가", desc: "업적 '탐험가' 2단계", color: "#3d8bdf", source: { kind: "achievement", id: "topics", stage: 2 }, rarity: "rare", icon: "globe" },
  { id: "t-battle", name: "승부사", desc: "업적 '승부사' 2단계", color: "#a05bd1", source: { kind: "achievement", id: "battle", stage: 2 }, rarity: "epic", icon: "swords" },
  { id: "t-engineer", name: "엔지니어", desc: "업적 '엔지니어' 1단계", color: "#6b7a90", source: { kind: "achievement", id: "engineer", stage: 1 }, rarity: "legendary", icon: "gear" },
  // ── 신화: 업적 마지막 단계를 깨야 받는, 아주 얻기 어려운 칭호
  { id: "t-year", name: "일년의 기적", desc: "365일 연속 공부 (업적 '꾸준함' 5단계)", color: "#7b3ff2", source: { kind: "achievement", id: "streak", stage: 5 }, rarity: "mythic", icon: "flame" },
  { id: "t-max", name: "만렙 공학자", desc: "100레벨 달성 (업적 '성장' 5단계)", color: "#7b3ff2", source: { kind: "achievement", id: "level", stage: 5 }, rarity: "mythic", icon: "star" },
  { id: "t-flawless", name: "완벽주의자", desc: "퀴즈 만점 10번 연속 (업적 '연속 만점' 4단계)", color: "#7b3ff2", source: { kind: "achievement", id: "perfectRun", stage: 4 }, rarity: "mythic", icon: "target" },
  { id: "t-grand", name: "그랜드 엔지니어", desc: "엔지니어 랭크 분야 5개 (업적 '엔지니어' 4단계)", color: "#7b3ff2", source: { kind: "achievement", id: "engineer", stage: 4 }, rarity: "mythic", icon: "trophy" },
  { id: "t-ten", name: "십관왕", desc: "서로 다른 자격증 10종 모의고사 합격권 (업적 '다관왕' 5단계)", color: "#7b3ff2", source: { kind: "achievement", id: "examCerts", stage: 5 }, rarity: "mythic", icon: "medal" },
  { id: "t-pass", name: "합격 예감", desc: "업적 '합격권' 1단계", color: "#2f8f5b", source: { kind: "achievement", id: "examPass", stage: 1 }, rarity: "rare", icon: "target" },
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
/** 프리미엄인지 (앱 루트가 알려 줌). 프리미엄이 끝나면 전용 테마 대신 클래식을 보여 줌 */
let premiumOn = false;
export function setThemePremium(on: boolean) {
  if (premiumOn === on) return;
  premiumOn = on;
  listeners.forEach((f) => f());
}
/** 실제로 보여 줄 테마 (쓰던 프리미엄 전용 테마는 프리미엄일 때만) */
const effectiveActive = () => (isPremiumTheme(state.active) && !premiumOn ? "classic" : state.active);
const activeSnapshot = effectiveActive;

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
  useCosmetics();
  const active = useActiveThemeId();
  return { owned: state.owned, active: themeById(active), premium: premiumOn };
}

/** 산 테마를 목록에 넣고 바로 적용 */
export function addTheme(id: string, apply = true) {
  if (!isTheme(id)) return;
  set({ ...state, owned: [...new Set([...state.owned, id])], active: apply ? id : state.active });
}

/** 가진 테마로 바꾸기 */
export function applyTheme(id: string) {
  if (state.owned.includes(id) || (isPremiumTheme(id) && premiumOn)) set({ ...state, active: id });
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
  applyServerLooks(a.ownedSkins); // 같은 칸에 들어 있는 유료 프로필 그림
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
  resetProfileLook();
}
