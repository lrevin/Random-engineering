/**
 * 스터디 팀 (서버 api/mysql/team-service.mjs, 규칙 숫자는 team-policy.mjs와 같아야 함 — 서버 테스트가 비교)
 * - 2~4명, 주제 상관없음. 친구를 먼저 초대한 뒤 '빈자리 채우기'(모르는 사람으로 채움) 또는 '친구끼리만'으로 꾸림
 * - 주간 목표: 팀원 이번 주 XP 합이 (150 × 인원) 이상 → 이번 주 XP를 얻은 팀원마다 톱니바퀴 40 · XP 60 한 번
 * 둘러보기(게스트)는 서버를 못 쓰므로 예시 팀원으로 화면만 미리 봄 (보상 없음).
 */
import { mysqlAuth } from "./auth";
import { AuthApiError } from "./auth-client";
import { weekStartKst } from "./boss";

export const TEAM_MIN = 2;
export const TEAM_MAX = 4;
export const TEAM_GOAL_PER_MEMBER = 150;
export const TEAM_REWARD = { gears: 40, xp: 60 };
export type TeamMode = "open" | "friends";

export interface TeamMember { nickname: string; uid: string | null; me: boolean; leader: boolean; weekXp: number; claimed: boolean; bot?: boolean }
export interface TeamInvite { id: string; status: "pending" | "accepted" | "declined"; nickname: string; uid: string | null }
export interface TeamProgress { count: number; total: number; goal: number; active: boolean; done: boolean }
export interface TeamState {
  week: { start: string; end: string };
  team: null | { id: string; mode: TeamMode; leader: boolean; members: TeamMember[]; progress: TeamProgress; reward: { gears: number; xp: number }; canClaim: boolean };
  invites: { incoming: TeamInvite[]; outgoing: TeamInvite[] };
  /** 둘러보기 예시 화면 */
  preview?: boolean;
}

export const teamGoal = (count: number) => TEAM_GOAL_PER_MEMBER * Math.max(count, TEAM_MIN);
export function teamProgress(members: { weekXp: number }[]): TeamProgress {
  const count = members.length, total = members.reduce((a, m) => a + Math.max(0, m.weekXp || 0), 0), goal = teamGoal(count);
  return { count, total, goal, active: count >= TEAM_MIN, done: count >= TEAM_MIN && total >= goal };
}

// ───────── 서버 (회원) ─────────
const call = <T,>(path: string, body?: unknown, method?: "GET" | "POST") => mysqlAuth.apiRequest(path, body, method) as Promise<T>;
export const getTeam = () => call<TeamState>("/me/team");
export const inviteFriends = (friendUids: string[]) => call<TeamState>("/me/team/invites", { friendUids }, "POST");
export const respondInvite = (id: string, action: "accept" | "decline" | "cancel") => call<TeamState>(`/me/team/invites/${id}/${action}`, {}, "POST");
export const createTeam = (mode: TeamMode) => call<TeamState>("/me/team/create", { mode }, "POST");
export const leaveTeam = () => call<TeamState>("/me/team/leave", {}, "POST");
export const claimTeamReward = () => call<TeamState>("/me/team/claim", {}, "POST");

export function teamMessage(e: unknown) {
  const code = e instanceof AuthApiError ? e.code : "";
  return ({
    team_already_joined: "이미 스터디 팀에 들어가 있어요.",
    team_friend_joined: "그 친구는 이미 다른 팀에 있어요.",
    team_party_full: `팀은 ${TEAM_MAX}명까지예요. 초대할 수 있는 자리가 없어요.`,
    team_full: "팀이 다 찼어요.",
    team_need_friend: "친구끼리만 꾸리려면 초대를 수락한 친구가 1명 이상 있어야 해요.",
    team_waiting_leader: "친구가 팀을 꾸리는 중이에요. 친구가 시작하면 같이 들어가요.",
    team_invite_closed: "이미 끝난 초대예요.",
    team_required: "먼저 스터디 팀에 들어가 주세요.",
    team_goal_not_met: "아직 주간 목표를 채우지 못했어요.",
    team_reward_no_xp: "이번 주에 공부해서 XP를 얻은 팀원만 보상을 받을 수 있어요.",
    team_reward_claimed: "이번 주 보상은 이미 받았어요.",
    not_friends: "친구로 등록된 사람만 초대할 수 있어요.",
    unauthorized: "로그인 후 이용해 주세요.",
    network_error: "인터넷 연결을 확인해 주세요.",
  } as Record<string, string>)[code] ?? "스터디 팀 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

// ───────── 둘러보기 예시 (게스트) ─────────
const BOTS = [
  { nickname: "별빛코더", weekXp: 180 },
  { nickname: "새벽공부", weekXp: 95 },
  { nickname: "오답사냥", weekXp: 40 },
];
export function previewTeam(nickname: string, myWeekXp: number, mode: TeamMode | null): TeamState {
  const start = weekStartKst(), end = new Date(start + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 6);
  const others = mode === "friends" ? BOTS.slice(0, 1) : BOTS;
  const members: TeamMember[] = [
    { nickname: nickname || "나", uid: null, me: true, leader: true, weekXp: myWeekXp, claimed: false },
    ...others.map((b) => ({ ...b, uid: null, me: false, leader: false, claimed: false, bot: true })),
  ];
  return {
    preview: true,
    week: { start, end: end.toISOString().slice(0, 10) },
    team: mode ? { id: "preview", mode, leader: true, members, progress: teamProgress(members), reward: TEAM_REWARD, canClaim: false } : null,
    invites: { incoming: [], outgoing: [] },
  };
}
