/** 분야별 전체 유저 랭킹 서버 호출 (약속: GET /leaderboard/:domain) */
import { mysqlAuth } from "./auth";
import { API_URL } from "./api";

const BASE = API_URL.replace(/\/$/, "");
export const leaderboardEnabled = !!BASE;

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  xp: number;
  me: boolean;
}

export interface Leaderboard {
  domain: string;
  entries: LeaderboardEntry[];
  me: { rank: number; xp: number } | null;
}

export class LeaderboardError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export async function getLeaderboard(domain: string, limit = 50): Promise<Leaderboard> {
  if (!BASE) throw new LeaderboardError("not_configured", 0);
  try {
    return await mysqlAuth.apiRequest(`/leaderboard/${domain}?limit=${limit}`, undefined, "GET");
  } catch (error) {
    const e = error as { code?: string; status?: number };
    throw new LeaderboardError(e.code ?? "network", e.status ?? 0);
  }
}

export function leaderboardMessage(e: unknown) {
  const code = e instanceof LeaderboardError ? e.code : "";
  return (
    ({
      not_found: "아직 그 분야 랭킹이 없어요.",
      unauthorized: "로그인 후 이용해 주세요.",
      not_configured: "랭킹 서버가 아직 연결되지 않았어요.",
      network: "인터넷 연결을 확인해 주세요.",
      rate_limited: "요청이 많아 잠시 대기 중이에요. 잠시 후 다시 확인해 주세요.",
    } as Record<string, string>)[code] ?? "랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
  );
}
