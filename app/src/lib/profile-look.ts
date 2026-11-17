/**
 * 프로필 꾸미기: 캐릭터 · 배경 (고른 것은 이 휴대폰에 저장)
 * - 무료 캐릭터 · 배경은 누구나 씀
 * - 유료(av- · bg-)는 톱니바퀴로 삼. 둘러보기는 이 휴대폰에, 회원은 서버(member_cosmetics 'skin' 칸, 장착 없이 보관)에 기록
 * 그림은 components/ProfileLook.tsx · ProfileLookPremium.tsx
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { LOCAL_KEYS } from "./local-data";

export const FREE_AVATARS = ["slotbot", "gear", "cat", "owl", "fox", "penguin", "robot", "bear", "frog"] as const;
export const FREE_BACKDROPS = ["reel", "sunset", "night", "notebook", "circuit", "ocean", "chalk"] as const;
/** 유료 상품 가격 (서버 api/mysql/purchase-policy.mjs COSMETICS와 같아야 함) */
export const LOOK_PRICES = {
  "av-astro": 900, "av-dragon": 1000, "av-slime": 800, "av-bunny": 800, "av-panda": 900, "av-phoenix": 1200, "av-whale": 900, "av-hamster": 800, "av-unicorn": 1100,
  "bg-galaxy": 1400, "bg-sakura": 1100, "bg-aurora": 1300, "bg-neon": 1400, "bg-library": 1000,
} as const;
export type PaidLookId = keyof typeof LOOK_PRICES;
export const PAID_AVATARS = ["av-astro", "av-dragon", "av-slime", "av-bunny", "av-panda", "av-phoenix", "av-whale", "av-hamster", "av-unicorn"] as const;
export const PAID_BACKDROPS = ["bg-galaxy", "bg-sakura", "bg-aurora", "bg-neon", "bg-library"] as const;

export type AvatarId = (typeof FREE_AVATARS)[number] | (typeof PAID_AVATARS)[number];
export type BackdropId = (typeof FREE_BACKDROPS)[number] | (typeof PAID_BACKDROPS)[number];
export const AVATAR_IDS: readonly AvatarId[] = [...FREE_AVATARS, ...PAID_AVATARS];
export const BACKDROP_IDS: readonly BackdropId[] = [...FREE_BACKDROPS, ...PAID_BACKDROPS];

export const isPaidLook = (id: string): id is PaidLookId => Object.hasOwn(LOOK_PRICES, id);

export interface ProfileLook {
  avatar: AvatarId;
  backdrop: BackdropId;
  /** 둘러보기에서 산 유료 그림 */
  owned: PaidLookId[];
  /** 프로필 수정에서 닉네임을 바꾼 횟수 (첫 번째는 무료) */
  nickChanges: number;
}
const DEFAULT: ProfileLook = { avatar: "slotbot", backdrop: "reel", owned: [], nickChanges: 0 };

// ───────── 닉네임 규칙 (서버 api/mysql/account-service.mjs와 같음) ─────────
/** 새로 정하는 닉네임 길이 */
export const NICK_MIN = 2;
export const NICK_MAX = 5;
/** 닉네임 변경: 첫 변경은 무료, 이후 톱니바퀴 이만큼 */
export const NICKNAME_CHANGE_COST = 50;
/** 글자 수 (한글 · 이모지도 한 글자로) */
export const nicknameLength = (s: string) => Array.from(s.trim()).length;
export const nicknameLengthOk = (s: string) => nicknameLength(s) >= NICK_MIN && nicknameLength(s) <= NICK_MAX;
/** 이번에 닉네임을 바꾸면 드는 톱니바퀴 (이 휴대폰 기준. 회원은 서버가 최종 판단) */
export const nicknameChangeCost = (changes: number) => (changes > 0 ? NICKNAME_CHANGE_COST : 0);
const KEY = LOCAL_KEYS.profileLook.key;

let state: ProfileLook = DEFAULT;
/** 회원이 서버에서 산 유료 그림 (로그인하면 지갑을 읽을 때마다 바뀜) */
let serverOwned: PaidLookId[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

const isAvatar = (x: unknown): x is AvatarId => (AVATAR_IDS as readonly unknown[]).includes(x);
const isBackdrop = (x: unknown): x is BackdropId => (BACKDROP_IDS as readonly unknown[]).includes(x);

/** 쓸 수 있는지: 무료이거나 샀거나 */
export function hasLook(id: string, s: { owned: readonly string[] } = state) {
  return !isPaidLook(id) || s.owned.includes(id) || serverOwned.includes(id);
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      const s = raw ? (JSON.parse(raw) as Partial<ProfileLook>) : null;
      if (!s) return;
      const owned = (Array.isArray(s.owned) ? s.owned : []).filter((x): x is PaidLookId => typeof x === "string" && isPaidLook(x));
      state = {
        owned,
        // 회원이 산 그림은 서버를 읽기 전이라 아직 모를 수 있으므로, 고른 것은 그대로 둠 (고를 때 소유를 확인함)
        avatar: isAvatar(s.avatar) ? s.avatar : "slotbot",
        backdrop: isBackdrop(s.backdrop) ? s.backdrop : "reel",
        nickChanges: typeof s.nickChanges === "number" && s.nickChanges >= 0 ? s.nickChanges : 0,
      };
      emit();
    })
    .catch(() => {});
}

function save(next: ProfileLook) {
  state = next;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

// 화면이 다시 그려지도록 소유 목록이 바뀌면 새 객체를 만듦
let snapCache = { ...state, all: [] as string[] };
const subscribe = (f: () => void) => { load(); listeners.add(f); return () => { listeners.delete(f); }; };
const snap = () => {
  const all = [...new Set([...state.owned, ...serverOwned])];
  if (snapCache.avatar !== state.avatar || snapCache.backdrop !== state.backdrop || snapCache.nickChanges !== state.nickChanges || snapCache.all.join() !== all.join()) snapCache = { ...state, all };
  return snapCache;
};

/** 고른 캐릭터 · 배경과 가진 유료 그림(all) */
export function useProfileLook() {
  return useSyncExternalStore(subscribe, snap, snap);
}

/** 고른 것 바꾸기 (가진 것만) */
export function setProfileLook(next: { avatar?: AvatarId; backdrop?: BackdropId }) {
  save({
    ...state,
    avatar: next.avatar && hasLook(next.avatar) ? next.avatar : state.avatar,
    backdrop: next.backdrop && hasLook(next.backdrop) ? next.backdrop : state.backdrop,
  });
}

/** 닉네임을 바꿨음을 기록 (다음 변경부터 유료) */
export function noteNicknameChanged() {
  save({ ...state, nickChanges: state.nickChanges + 1 });
}

/** 둘러보기에서 톱니바퀴로 산 유료 그림 기록 */
export function addOwnedLook(id: PaidLookId) {
  if (state.owned.includes(id)) return;
  save({ ...state, owned: [...state.owned, id] });
}

/** 회원 지갑을 읽었을 때: 서버 'skin' 칸에 있는 유료 그림 */
export function applyServerLooks(ownedSkins: string[]) {
  const next = ownedSkins.filter(isPaidLook);
  if (next.join() === serverOwned.join()) return;
  serverOwned = next;
  emit();
}

/** 둘러보기 데이터 지우기 등 */
export function resetProfileLook() {
  serverOwned = [];
  save(DEFAULT);
}
