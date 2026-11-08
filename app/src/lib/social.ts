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

/** 연장전: 한 문제씩 같이 풀어 한 사람만 맞히면 승리. 문제는 AI가 2개씩 미리 만들어 둠 */
export interface Overtime {
  /** 지금 푸는 문제 번호 (0부터) */
  round: number;
  /** 지금 문제 (아직 안 만들어졌으면 null) */
  question: QuizQuestion | null;
  /** 이 문제를 풀기 시작한 시각 · 제한 시간 */
  roundStartAt: string | null;
  roundSec: number;
  /** 지금까지 만들어 둔 연장전 문제 수 · 올라온 묶음 수 */
  available: number;
  batches: number;
  /** 사람별 문제마다 맞혔는지 (안 냈으면 null) */
  answers: Record<string, (boolean | null)[]>;
  /** 이미 푼 연장전 문제 (결과 화면용) */
  past: QuizQuestion[];
}

export interface Battle {
  id: string;
  /** random = 랜덤 매칭 배틀 (문제를 공부하는 동안 AI가 만듦) */
  kind?: "random";
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
  /** 본 문제 (퀴즈 시작 시각이 지나야 받음). 매칭 배틀은 공부하는 동안 AI가 만들어 올림 */
  questions: QuizQuestion[] | null;
  /** 본 문제가 서버에 올라왔는지 (문제를 만드는 쪽이 확인용) */
  questionsReady?: boolean;
  /** 본 문제 수 (매칭 배틀 5) */
  quizCount?: number;
  /** 퀴즈 시작 시각 = 공부 끝 (문제가 늦게 올라오면 올라온 시각) */
  quizStartAt?: string | null;
  /** 두 사람 다 만점이면 열리는 연장전 */
  overtime?: Overtime | null;
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
    opponent_busy: "상대가 다른 배틀을 하고 있어요.",
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

// ───────── 랜덤 매칭 ─────────
export type MatchState =
  | { status: "none" }
  | { status: "waiting"; id: string; joinedAt: string }
  | { status: "matched"; battle: Battle };

/**
 * 매칭 대기열에 들어감. interests: 내 관심 분야(세부 분야 id), candidates: 관심 분야에서 고른 주제 후보 id들.
 * 서버는 서로의 관심 분야가 겹치는 상대와 맺고, 겹치는 분야의 후보 주제 하나로 배틀을 엶. 공부 시간은 10분 고정.
 */
export const joinMatch = (m: { interests: string[]; candidates: string[] }) => call<MatchState>("POST", "/match", m);
/** 배틀 문제 올리기. batch 0 = 본 문제 5개, 1부터 = 연장전 문제 2개씩. 먼저 올린 것만 인정 */
export const uploadQuestions = (id: string, batch: number, questions: QuizQuestion[]) =>
  call<Battle>("POST", `/battles/${id}/questions`, { batch, questions });
/** 연장전 한 문제 답 제출 */
export const submitOvertime = (id: string, round: number, correct: boolean) =>
  call<Battle>("POST", `/battles/${id}/overtime`, { round, correct });
export const getMatch = () => call<MatchState>("GET", "/match");
export const leaveMatch = () => call<MatchState>("DELETE", "/match");
