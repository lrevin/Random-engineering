import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * 슬롯머신 스킨: 톱니바퀴로 사서 홈의 슬롯머신 색을 바꿉니다. (릴 창 색은 글자가 잘 보이도록 그대로)
 * 산 스킨과 고른 스킨은 이 휴대폰에 저장합니다.
 */
export interface SlotSkin {
  id: string;
  name: string;
  desc: string;
  /** 톱니바퀴 가격 (0 = 처음부터 가짐) */
  price: number;
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

export const SKINS: SlotSkin[] = [
  { id: "classic", name: "클래식 네이비", desc: "뽑공 로고와 같은 기본 슬롯머신", price: 0 },
  {
    id: "cherry", name: "체리 레드", desc: "오락실 느낌의 빨간 슬롯머신", price: 150,
    body: "#c2352c", edge: "#8f211b", lights: ["#ffd166", "#fffaf0"], knob: "#f7b500", knobDeep: "#c98f00", lever: "#5a1612", pointer: "#f7b500",
  },
  {
    id: "mint", name: "민트 소다", desc: "시원한 민트색에 주황 손잡이", price: 150,
    body: "#1f9d8f", edge: "#14756a", lights: ["#fffaf0", "#ffd166"], knob: "#ff7a59", knobDeep: "#d15a3c", lever: "#0f5c54", pointer: "#ff7a59",
  },
  {
    id: "galaxy", name: "갤럭시 퍼플", desc: "보랏빛 몸통에 네온 불빛", price: 250,
    body: "#4b2f8f", edge: "#331f66", lights: ["#7ee0ff", "#ff7ad9"], knob: "#7ee0ff", knobDeep: "#3fa9cc", lever: "#2a1a55", pointer: "#ff7ad9",
  },
  {
    id: "gold", name: "골드 잭팟", desc: "번쩍이는 황금 슬롯머신", price: 400,
    body: "#d4a017", edge: "#a57a0c", lights: ["#e0453a", "#fffaf0"], knob: "#e0453a", knobDeep: "#b02d26", lever: "#7a5a08", pointer: "#e0453a",
  },
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];

interface SkinState { owned: string[]; active: string }
const KEY = "pg.skins";
let state: SkinState = { owned: ["classic"], active: "classic" };
let loaded = false;
const listeners = new Set<() => void>();

function set(next: SkinState, save = true) {
  state = next;
  listeners.forEach((f) => f());
  if (save) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      const s = raw ? (JSON.parse(raw) as Partial<SkinState>) : null;
      if (!s) return;
      const owned = ["classic", ...(Array.isArray(s.owned) ? s.owned : [])].filter((id, i, xs) => SKINS.some((k) => k.id === id) && xs.indexOf(id) === i);
      set({ owned, active: owned.includes(s.active ?? "") ? (s.active as string) : "classic" }, false);
    })
    .catch(() => {});
}

const subscribe = (f: () => void) => {
  load();
  listeners.add(f);
  return () => { listeners.delete(f); };
};
const snapshot = () => state;

/** 가진 스킨 · 쓰는 스킨 (바뀌면 화면이 다시 그려짐) */
export function useSkins() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { owned: s.owned, active: skinById(s.active) };
}

/** 산 스킨을 목록에 넣고 바로 적용 */
export function addSkin(id: string) {
  if (!SKINS.some((s) => s.id === id)) return;
  set({ owned: [...new Set([...state.owned, id])], active: id });
}

/** 가진 스킨으로 바꾸기 */
export function applySkin(id: string) {
  if (state.owned.includes(id)) set({ ...state, active: id });
}

/** 둘러보기 데이터 지우기 등: 처음 상태로 */
export function resetSkins() {
  set({ owned: ["classic"], active: "classic" });
}
