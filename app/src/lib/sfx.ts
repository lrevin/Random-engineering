import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * 효과음 (assets/sfx: 직접 합성한 짧은 wav, 저작권 문제 없음. 다시 만들기: python scripts/make_sfx.py app/assets/sfx)
 * - 설정 > 효과음 으로 끄고 켤 수 있음 (기본 켬)
 * - 무음 모드(아이폰 벨소리 스위치)에서는 소리 안 남
 * - 소리가 실패해도 앱 동작에는 영향 없음
 */
const FILES = {
  lever: require("../../assets/sfx/lever.wav"),
  reel: require("../../assets/sfx/reel.wav"),
  reel_stop: require("../../assets/sfx/reel_stop.wav"),
  slot_win: require("../../assets/sfx/slot_win.wav"),
  match: require("../../assets/sfx/match.wav"),
  count: require("../../assets/sfx/count.wav"),
  go: require("../../assets/sfx/go.wav"),
  victory: require("../../assets/sfx/victory.wav"),
  defeat: require("../../assets/sfx/defeat.wav"),
  correct: require("../../assets/sfx/correct.wav"),
  wrong: require("../../assets/sfx/wrong.wav"),
  tick: require("../../assets/sfx/tick.wav"),
  gear: require("../../assets/sfx/gear.wav"),
  chest: require("../../assets/sfx/chest.wav"),
  levelup: require("../../assets/sfx/levelup.wav"),
} as const;
export type SfxName = keyof typeof FILES;

const KEY = "pg.sfx";
/** 짧게 연달아 나는 소리는 여러 개를 돌려 가며 씀 (앞 소리가 안 끊기게) */
const POOL: Partial<Record<SfxName, number>> = { reel: 3, tick: 2, count: 2 };

let enabled = true;
let ready = false;
const players = new Map<SfxName, { list: AudioPlayer[]; next: number }>();
const listeners = new Set<(on: boolean) => void>();

function player(name: SfxName) {
  let slot = players.get(name);
  if (!slot) {
    slot = { list: Array.from({ length: POOL[name] ?? 1 }, () => createAudioPlayer(FILES[name])), next: 0 };
    players.set(name, slot);
  }
  const p = slot.list[slot.next];
  slot.next = (slot.next + 1) % slot.list.length;
  return p;
}

/** 앱 시작 때 한 번: 저장된 설정 읽기 + 자주 쓰는 소리 미리 불러오기 */
export async function initSfx() {
  if (ready) return;
  ready = true;
  try { enabled = (await AsyncStorage.getItem(KEY)) !== "off"; } catch { /* 기본 켬 */ }
  try { await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }); } catch { /* 기본 모드 */ }
  for (const n of ["lever", "reel", "reel_stop", "correct", "wrong"] as SfxName[]) { try { player(n); } catch { /* 나중에 */ } }
}

export function sfx(name: SfxName, volume = 1) {
  if (!enabled) return;
  try {
    const p = player(name);
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch { /* 소리 실패는 무시 */ }
}

export const sfxEnabled = () => enabled;
export function setSfxEnabled(on: boolean) {
  enabled = on;
  AsyncStorage.setItem(KEY, on ? "on" : "off").catch(() => {});
  listeners.forEach((l) => l(on));
}
export function onSfxChange(l: (on: boolean) => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** 슬롯 릴이 한 칸 지날 때마다 딸깍: 애니메이션과 같은 감속 곡선으로 시각을 미리 계산해 예약 */
export function scheduleReelTicks(steps: number, duration: number, ease: (t: number) => number) {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let last = 0, lastAt = -1e9;
  for (let i = 1; i <= 240; i++) {
    const t = i / 240, idx = Math.floor(ease(t) * steps), at = t * duration;
    if (idx > last) {
      last = idx;
      if (at - lastAt >= 45) { lastAt = at; timers.push(setTimeout(() => sfx("reel", 0.6), at)); }
    }
  }
  return () => timers.forEach(clearTimeout);
}
