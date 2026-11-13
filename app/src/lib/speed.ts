import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCAL_KEYS } from "./local-data";
import { dateKey } from "./stats";

/**
 * 스피드 퀴즈: 1분 동안 공부한 적 있는 주제의 4지선다 문제를 연달아 풂.
 * 맞힌 만큼 사용자 경험치(레벨)만 오르고, 공부 기록을 남기지 않아 분야 랭크는 오르지 않음.
 */
export const SPEED_SEC = 60;
/** 정답 1개당 경험치 · 하루에 받을 수 있는 최대 경험치 (반복으로 레벨을 올리는 걸 막음) */
export const SPEED_XP_PER_CORRECT = 3;
export const SPEED_DAILY_XP_CAP = 150;

const KEY = LOCAL_KEYS.speed.key;
export interface SpeedStore { best: number; day: string; xpToday: number; plays: number }
const EMPTY: SpeedStore = { best: 0, day: "", xpToday: 0, plays: 0 };

export async function readSpeed(): Promise<SpeedStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<SpeedStore>) : null;
    const today = dateKey(new Date());
    return {
      best: s?.best ?? 0,
      plays: s?.plays ?? 0,
      day: today,
      xpToday: s?.day === today ? s?.xpToday ?? 0 : 0,
    };
  } catch {
    return { ...EMPTY, day: dateKey(new Date()) };
  }
}

/** 한 판 끝: 최고 기록 갱신, 오늘 받을 경험치 계산(상한까지). 돌려주는 값은 이번에 받은 경험치 */
export async function finishSpeed(correct: number): Promise<{ store: SpeedStore; xp: number; newBest: boolean }> {
  const s = await readSpeed();
  const xp = Math.max(0, Math.min(correct * SPEED_XP_PER_CORRECT, SPEED_DAILY_XP_CAP - s.xpToday));
  const store = { ...s, best: Math.max(s.best, correct), xpToday: s.xpToday + xp, plays: s.plays + 1 };
  await AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {});
  return { store, xp, newBest: correct > s.best };
}
