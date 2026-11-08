/**
 * 친구 · 1:1 배틀 서버 호출 (약속: api/SOCIAL_API.md)
 * 지금은 시험용 서버(api/mock-social)로 동작하고, 실제 API 서버가 같은 주소 형식을 지원하면 주소만 바꿉니다.
 * 화면에서는 이 파일의 함수만 부릅니다.
 */
import type { QuizQuestion } from "./quiz";

const BASE = (process.env.EXPO_PUBLIC_SOCIAL_URL || "").replace(/\/$/, "");
export const socialEnabled = !!BASE;

export interface Me {
  uid: string;
  nickname: string;
  level: number;
  /** 누적 경험치 (배틀에서 지면 이 값의 5%, 최대 100을 잃음) */
  xp: number;
}

export interface Friend {
  uid: string;
  nickname: string;
  level: number;
  online: boolean;
}

export interface FriendsState {
  friends: Friend[];
  /** 나에게 온 친구 신청 */
  incoming: Friend[];
  /** 내가 보낸 친구 신청 */
  outgoing: Friend[];
}

export type BattleStatus = "pending" | "accepted" | "finished" | "declined" | "canceled" | "expired";

export interface BattleResult {
  score: number;
  total: number;
  submittedAt: string;
}

export interface Battle {
  id: string;
  status: BattleStatus;
  from: { uid: string; nickname: string };
  to: { uid: string; nickname: string };
  /** 배틀 분야 (DOMAINS의 id) */
  domain: string;
  studySec: number;
  quizSec: number;
  createdAt: string;
  /** 수락되면 정해지는 시작 시각 (두 사람 모두 이 시각에 동시에 시작) */
  startAt: string | null;
  /** 수락 뒤에만 받음 */
  topicId: string | null;
  questions: QuizQuestion[] | null;
  results: Record<string, BattleResult>;
  /** 끝나면: 이긴 사람 uid(비기면 null)와 넘어간 경험치 */
  outcome: { winner: string | null; xp: number } | null;
  /** 서버 시각 (휴대폰 시계가 달라도 같은 순간에 시작하도록 보정) */
  serverNow: string;
}

export class SocialError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

let me: Me | null = null;
/** 서버 시각 - 휴대폰 시각 (ms) */
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;

/** 내 정보 (UID · 닉네임 · 레벨). 앱 상태가 바뀔 때마다 갱신 */
export function setMe(next: Me) {
  me = next;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!BASE) throw new SocialError("not_configured", 0);
  if (!me?.uid) throw new SocialError("no_identity", 0);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        // 시험용 서버의 사용자 구분. 실제 서버에서는 로그인 토큰(Authorization: Bearer)으로 바뀜
        "x-pg-uid": me.uid,
        "x-pg-name": encodeURIComponent(me.nickname || "학습자"),
        "x-pg-level": String(me.level),
        "x-pg-xp": String(Math.max(0, Math.floor(me.xp))),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (data?.serverNow) clockOffset = new Date(data.serverNow).getTime() - Date.now();
    if (!res.ok) throw new SocialError(data?.error ?? "server_error", res.status);
    return data as T;
  } catch (e) {
    if (e instanceof SocialError) throw e;
    throw new SocialError("network", 0);
  } finally {
    clearTimeout(timer);
  }
}

/** 사용자에게 보여 줄 한국어 문장 */
export function socialMessage(e: unknown) {
  const code = e instanceof SocialError ? e.code : "";
  return ({
    not_configured: "친구 서버가 아직 연결되지 않았어요.",
    network: "인터넷 연결을 확인해 주세요.",
    not_found: "그 UID의 사용자를 찾지 못했어요.",
    self: "내 UID는 친구로 추가할 수 없어요.",
    already_friends: "이미 친구예요.",
    already_requested: "이미 친구 신청을 보냈어요.",
    not_friends: "친구끼리만 배틀할 수 있어요.",
    busy: "이미 진행 중인 배틀이 있어요.",
    opponent_busy: "친구가 다른 배틀을 하고 있어요.",
    not_pending: "이미 끝났거나 취소된 배틀이에요.",
  } as Record<string, string>)[code] ?? "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

// ───────── 친구 ─────────
export const registerMe = () => call<{ ok: true }>("POST", "/social/me", {});
export const getFriends = () => call<FriendsState>("GET", "/social/friends");
export const requestFriend = (uid: string) => call<FriendsState>("POST", "/social/friends/requests", { uid: uid.trim().toUpperCase() });
export const respondFriend = (uid: string, accept: boolean) =>
  call<FriendsState>("POST", `/social/friends/requests/${uid}/${accept ? "accept" : "decline"}`);
export const removeFriend = (uid: string) => call<FriendsState>("DELETE", `/social/friends/${uid}`);

// ───────── 1:1 배틀 ─────────
export const createBattle = (b: { opponentUid: string; domain: string; topicId: string; studySec: number; questions: QuizQuestion[] }) =>
  call<Battle>("POST", "/battles", b);
/** 나에게 온 신청(incoming)과 지금 내가 참여 중인 배틀(current) */
export const getInbox = () => call<{ incoming: Battle[]; current: Battle | null }>("GET", "/battles/inbox");
export const getBattle = (id: string) => call<Battle>("GET", `/battles/${id}`);
export const acceptBattle = (id: string) => call<Battle>("POST", `/battles/${id}/accept`);
export const declineBattle = (id: string) => call<Battle>("POST", `/battles/${id}/decline`);
export const cancelBattle = (id: string) => call<Battle>("POST", `/battles/${id}/cancel`);
/** 퀴즈 결과 제출. xp: 내 누적 경험치 (지면 이 값의 5%, 최대 100을 잃음) */
export const submitBattle = (id: string, r: { score: number; total: number; xp: number }) =>
  call<Battle>("POST", `/battles/${id}/result`, r);
