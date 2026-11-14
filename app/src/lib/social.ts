/**
 * 친구 · 1:1 배틀 서버 호출 (약속: api/SOCIAL_API.md)
 * 자체 API의 로그인 토큰으로 회원을 확인합니다. 배틀 시간·출제·승패·XP는 서버에서 관리합니다.
 * 화면에서는 이 파일의 함수만 부릅니다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { mysqlAuth } from "./auth";
import { API_URL } from "./api";
import type { QuizQuestion } from "./quiz";

const BASE = API_URL.replace(/\/$/, "");
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

export type BattleStatus = "pending" | "accepted" | "finished" | "declined" | "canceled" | "expired" | "void";

export interface BattleResult {
  score: number;
  total: number;
  submittedAt: string;
}

/** 연장전: 한 문제씩 같이 풀어 한 사람만 맞히면 승리. 서버가 보존한 기본 문제에서 최대 5문항 출제 */
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
  mySubmitted: boolean;
  myAnswer: number | boolean | null;
  /** 이미 푼 연장전 문제 (결과 화면용) */
  past: QuizQuestion[];
}

export interface Battle {
  revision?: number;
  studySkip?: {count: number; required: 2; myAgreed: boolean};
  phase: "countdown" | "study" | "quiz" | "submitted" | "overtime" | "finished" | "void";
  myAnswers: (number | boolean | null)[];
  mySubmitted: boolean;
  quizEndAt: string;
  reason?: string;
  recordId?: string | null;
  id: string;
  /** random = 서버의 공통 관심 주제 랜덤 매칭 배틀 */
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
  /** 본 문제 (퀴즈 시작 시각이 지나야 받음). 서버의 기본 문제 은행에서 공통 출제 */
  questions: QuizQuestion[] | null;
  /** 본 문제가 서버에 올라왔는지 (문제를 만드는 쪽이 확인용) */
  questionsReady?: boolean;
  /** 본 문제 수 (매칭 배틀 5) */
  quizCount?: number;
  /** 퀴즈 시작 시각 = 고정된 공부 종료 시각 */
  quizStartAt?: string | null;
  /** 점수가 같으면 열리는 연장전 */
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


/** 서버 시각 - 휴대폰 시각 (ms) */
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;

/** 내 정보 (UID · 닉네임 · 레벨). 앱 상태가 바뀔 때마다 갱신 */
export function setMe(_next: Me) {
  // Kept for existing screen callers; identity is server-authoritative.
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!BASE) throw new SocialError("not_configured", 0);
  // The API derives identity from the authenticated session, never from local Me data.
  try {
    const data = await mysqlAuth.apiRequest(path, body, method as "GET" | "POST" | "DELETE");
    if (data?.serverNow) clockOffset = new Date(data.serverNow).getTime() - Date.now();
    return data as T;
  } catch (error) {
    const e = error as {code?: string; status?: number};
    throw new SocialError(e.code ?? "network", e.status ?? 0);
  }
}

/** 사용자에게 보여 줄 한국어 문장 */
export function socialMessage(e: unknown) {
  const code = e instanceof SocialError ? e.code : "";
  return ({
    rate_limited: "요청이 많아 잠시 대기 중이에요. 잠시 후 다시 확인해 주세요.",
    network_error: "인터넷 연결을 확인해 주세요.",
    database_unavailable: "서버 연결이 지연되고 있어요. 잠시 후 다시 확인해 주세요.",
    no_tickets: "사용할 배틀권이 없어요.",
    no_match_topics: "관심 분야에 배틀용 문제가 부족해요. 다른 관심 분야를 선택해 주세요.",
    answer_conflict: "이미 저장된 답안이 있어요. 진행 상태를 새로 불러와 주세요.",
    not_studying: "학습 중에만 스킵에 동의할 수 있어요.",
    not_answering: "답안 제출 시간이 지났어요. 진행 상태를 확인해 주세요.",
    unauthorized: "로그인 후 이용해 주세요.",
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
export const registerMe = () => call<{ ok: true; uid: string }>("POST", "/social/me", {});
export const getFriends = () => call<FriendsState>("GET", "/social/friends");
export const requestFriend = (uid: string) => call<FriendsState>("POST", "/social/friends/requests", { uid: uid.trim().toUpperCase() });
export const respondFriend = (uid: string, accept: boolean) =>
  call<FriendsState>("POST", `/social/friends/requests/${uid}/${accept ? "accept" : "decline"}`);
export const removeFriend = (uid: string) => call<FriendsState>("DELETE", `/social/friends/${uid}`);

// 배틀의 시간·답안·승패·XP는 서버가 결정합니다.
export const getInbox = () => call<{ incoming: Battle[]; current: Battle | null }>("GET", "/battles/inbox");
export const getBattle = (id: string) => call<Battle>("GET", `/battles/${id}`);
export const getBattleHistory = () => call<{battles: Battle[]}>("GET", "/battles/history");
export const setStudySkip = (id: string, agree: boolean) => call<Battle>("POST", `/battles/${id}/study-skip`, {agree});
export const answerBattle = (id: string, position: number, answer: number | boolean) => call<Battle>("POST", `/battles/${id}/answers`, {position, answer});
export const submitBattle = (id: string) => call<Battle>("POST", `/battles/${id}/result`, {});
export const forfeitBattle = (id: string) => call<Battle>("POST", `/battles/${id}/forfeit`, {});
export const submitOvertime = (id: string, round: number, answer: number | boolean) => call<Battle>("POST", `/battles/${id}/overtime`, {round, answer});
export type MatchState = {status:"none"} | {status:"waiting";id:string;joinedAt:string;expiresAt:string} | {status:"matched";battle:Battle};
// 미응답 요청은 같은 UUID로 재시도합니다. 앱 재실행 후에도 중복 차감되지 않습니다.
export async function joinMatch() {
  const owner = mysqlAuth.getUserId();
  if (!owner) throw new SocialError("unauthorized",401);
  const key="pg.match.request."+owner;
  let requestId=await AsyncStorage.getItem(key);
  if(!requestId){requestId=Crypto.randomUUID();await AsyncStorage.setItem(key,requestId);}
  if(mysqlAuth.getUserId()!==owner)throw new SocialError("unauthorized",401);
  const result=await call<MatchState>("POST","/match",{requestId});
  await AsyncStorage.removeItem(key);
  return result;
}
export const getMatch = () => call<MatchState>("GET", "/match");
export const leaveMatch = (entryId:string) => call<MatchState>("DELETE", "/match", {entryId});
