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
  /** 릴 회전 한 판 (2.3초 감속 + 철컥): 슬롯 애니메이션과 같은 곡선으로 만든 소리 */
  slot_spin: require("../../assets/sfx/slot_spin.wav"),
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
  /** 톱니바퀴 획득: 터져 나올 때 짤랑 · 하나 도착할 때마다 띵(1→8 점점 높아짐) · 다 모이면 반짝 */
  coin_spill: require("../../assets/sfx/coin_spill.wav"),
  coin1: require("../../assets/sfx/coin1.wav"),
  coin2: require("../../assets/sfx/coin2.wav"),
  coin3: require("../../assets/sfx/coin3.wav"),
  coin4: require("../../assets/sfx/coin4.wav"),
  coin5: require("../../assets/sfx/coin5.wav"),
  coin6: require("../../assets/sfx/coin6.wav"),
  coin7: require("../../assets/sfx/coin7.wav"),
  coin8: require("../../assets/sfx/coin8.wav"),
  coin_done: require("../../assets/sfx/coin_done.wav"),
  /** 오답 보스전: 맞힐 때 보스가 맞는 소리 · 틀릴 때 보스 웃음 · 보스 등장 */
  boss_hit: require("../../assets/sfx/boss_hit.wav"),
  boss_laugh: require("../../assets/sfx/boss_laugh.wav"),
  boss_appear: require("../../assets/sfx/boss_appear.wav"),
} as const;
export type SfxName = keyof typeof FILES;

const KEY = "pg.sfx";
/** 짧게 연달아 나는 소리는 여러 개를 돌려 가며 씀 (앞 소리가 안 끊기게) */
const POOL: Partial<Record<SfxName, number>> = { reel: 3, tick: 2, count: 2, coin8: 2, boss_hit: 2 };
/** 도착 순서대로 높아지는 동전 소리 */
export const COIN_STEPS = ["coin1", "coin2", "coin3", "coin4", "coin5", "coin6", "coin7", "coin8"] as const satisfies readonly SfxName[];

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
  for (const n of ["lever", "slot_spin", "slot_win", "correct", "wrong", "coin_spill", ...COIN_STEPS, "coin_done"] as SfxName[]) { try { player(n); } catch { /* 나중에 */ } }
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

// ───────── 배경 음악 (오답 보스전): 반복 재생, 효과음 설정을 따라 꺼짐 ─────────
const BGM = { boss: require("../../assets/sfx/boss_bgm.wav") } as const;
let bgm: AudioPlayer | null = null;
let bgmName: keyof typeof BGM | null = null;
let bgmFade: ReturnType<typeof setInterval> | null = null;

/** 배경 음악 켜기 (이미 같은 곡이면 그대로) */
export function playBgm(name: keyof typeof BGM, volume = 0.45) {
  bgmName = name;
  if (!enabled) return;
  try {
    if (bgmFade) { clearInterval(bgmFade); bgmFade = null; }
    if (!bgm) { bgm = createAudioPlayer(BGM[name]); bgm.loop = true; }
    bgm.volume = volume;
    bgm.play();
  } catch { /* 소리 실패는 무시 */ }
}
/** 배경 음악 끄기 (짧게 줄이며 멈춤) */
export function stopBgm(fadeMs = 400) {
  bgmName = null;
  const p = bgm;
  if (!p) return;
  if (bgmFade) clearInterval(bgmFade);
  const start = p.volume, steps = Math.max(1, Math.round(fadeMs / 40));
  let i = 0;
  bgmFade = setInterval(() => {
    i++;
    try { p.volume = start * (1 - i / steps); } catch { /* 무시 */ }
    if (i >= steps) {
      if (bgmFade) clearInterval(bgmFade);
      bgmFade = null;
      try { p.pause(); p.seekTo(0).catch(() => {}); p.volume = start; } catch { /* 무시 */ }
    }
  }, 40);
}
// 설정에서 효과음을 끄면 배경 음악도 멈추고, 켜면 다시 (보스전 안일 때)
onSfxChange((on) => {
  if (!bgm) return;
  try { if (on && bgmName) bgm.play(); else bgm.pause(); } catch { /* 무시 */ }
});
