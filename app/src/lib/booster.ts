import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * 경험치 2배 부스터: 톱니바퀴로 사면 BOOST_MIN분 동안 퀴즈로 얻는 경험치가 2배.
 * 이미 켜져 있을 때 또 사면 남은 시간 뒤에 이어 붙음 (최대 BOOST_MAX_MIN분까지 쌓아 둠).
 * 프리미엄 회원도 쓸 수 있는 반복 지출처 (배틀 경험치는 해당 없음).
 */
export const BOOST_COST = 40;
export const BOOST_MIN = 30;
export const BOOST_MAX_MIN = 120;

const KEY = "pg.boost";
let until = 0;
let loaded = false;
const listeners = new Set<() => void>();

function set(next: number, save = true) {
  until = next;
  listeners.forEach((f) => f());
  if (save) AsyncStorage.setItem(KEY, String(next)).catch(() => {});
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => { const n = Number(raw); if (n > 0) set(n, false); })
    .catch(() => {});
}

const subscribe = (f: () => void) => {
  load();
  listeners.add(f);
  return () => { listeners.delete(f); };
};
const snapshot = () => until;

/** 지금 부스터가 켜져 있는지 (퀴즈 채점할 때) */
export const boostActive = (now = Date.now()) => until > now;

/** 더 살 수 있는지 (쌓인 시간이 최대보다 적을 때) */
export const canStackBoost = (now = Date.now()) => Math.max(until, now) + BOOST_MIN * 60000 - now <= BOOST_MAX_MIN * 60000;

/** 산 부스터를 켬 (톱니바퀴는 부르는 쪽에서 먼저 냄) */
export function addBoost(now = Date.now()) {
  set(Math.max(until, now) + BOOST_MIN * 60000);
}

export function resetBoost() {
  set(0);
}

/** 남은 부스터 시간(ms). 켜져 있는 동안 1초마다 다시 그려짐 */
export function useBoost() {
  const u = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (u <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [u]);
  return { left: Math.max(0, u - now), active: u > now };
}

/** 남은 시간 표시 (예: "29:41") */
export const fmtLeft = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
