/**
 * 톱니바퀴 획득 연출(쿠키런 젤리처럼): 받은 곳에서 톱니바퀴가 터져 나와 화면의 톱니바퀴 개수 칸으로 빨려 들어감.
 * - 출발점: 방금 누른 곳(noteTouch) 또는 광고처럼 미리 알려 준 곳(expectGears)
 * - 도착점: 지금 화면에 보이는 톱니바퀴 개수 칸(registerGearTarget)
 * - 날아가는 동안에는 개수 칸 숫자가 덜 올라가 있다가, 하나씩 도착할 때마다 올라감(pending)
 * 화면을 누르지 않았는데 늘어난 경우(서버 동기화 등)는 연출 없이 숫자만 바뀜.
 */
import { useSyncExternalStore } from "react";
import { Dimensions } from "react-native";

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

let lastTouch: { p: Pt; at: number } | null = null;
let expected: { p: Pt; at: number } | null = null;

/** 화면을 누를 때마다 위치를 기억 (루트에서 부름) */
export function noteTouch(x: number, y: number) {
  lastTouch = { p: { x, y }, at: Date.now() };
}

/** 광고처럼 한참 뒤에 들어오는 보상: 출발점을 미리 알려 둠 (1분 동안 유효) */
export function expectGears(p?: Pt) {
  const { width, height } = Dimensions.get("window");
  expected = { p: p ?? { x: width / 2, y: height / 2 }, at: Date.now() };
}

/** 이번에 늘어난 톱니바퀴를 연출할 출발점 (없으면 연출하지 않음) */
export function takeGearSource(): Pt | null {
  const now = Date.now();
  const p = expected && now - expected.at < 60000 ? expected.p : lastTouch && now - lastTouch.at < 4000 ? lastTouch.p : null;
  expected = null;
  return p;
}

// ───────── 도착점: 톱니바퀴 개수 칸 ─────────
interface Target { measure: () => Promise<Rect | null>; pulse: () => void; focused: boolean; activeAt: number }
const targets = new Map<number, Target>();
let nextId = 1;

export function registerGearTarget(t: Omit<Target, "activeAt">) {
  const id = nextId++;
  targets.set(id, { ...t, activeAt: Date.now() });
  return {
    focus(on: boolean) { const x = targets.get(id); if (x) { x.focused = on; if (on) x.activeAt = Date.now(); } },
    remove() { targets.delete(id); },
  };
}

/** 지금 화면에 보이는(포커스된) 개수 칸 중 가장 최근 것. 없으면 오른쪽 위 */
export async function pickGearTarget(): Promise<{ p: Pt; pulse: () => void }> {
  const { width, height } = Dimensions.get("window");
  const list = [...targets.values()].filter((t) => t.focused).sort((a, b) => b.activeAt - a.activeAt);
  for (const t of list) {
    const r = await t.measure();
    if (r && r.width > 0 && r.x >= 0 && r.y >= 0 && r.x < width && r.y < height) {
      return { p: { x: r.x + Math.min(r.width, 28) / 2 + 2, y: r.y + r.height / 2 }, pulse: t.pulse };
    }
  }
  return { p: { x: width - 60, y: 80 }, pulse: () => {} };
}

// ───────── 아직 도착하지 않은 톱니바퀴 수 (개수 칸은 이만큼 덜 보여 줌) ─────────
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export function addPending(n: number) { pending = Math.max(0, pending + n); emit(); }
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const snap = () => pending;

/** 화면에 보여 줄 톱니바퀴 수: 날아오는 중인 만큼 빼고 */
export function useShownGears(gears: number) {
  return Math.max(0, gears - useSyncExternalStore(subscribe, snap, snap));
}
