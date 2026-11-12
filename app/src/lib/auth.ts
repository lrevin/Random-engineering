import { API_URL } from "./api";
import { createAuthClient, AuthApiError } from "./auth-client";
import { authStorage } from "./auth-storage";
import { authErrorMessage as legacyErrorMessage } from "./supabase";
export const AUTH_PROVIDER = process.env.EXPO_PUBLIC_AUTH_PROVIDER ?? "supabase";
if (AUTH_PROVIDER !== "supabase" && AUTH_PROVIDER !== "mysql") {
  throw new Error("EXPO_PUBLIC_AUTH_PROVIDER must be supabase or mysql");
}
if (AUTH_PROVIDER === "mysql" && !API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is required for MySQL authentication");
}
export const mysqlAuth = AUTH_PROVIDER === "mysql" ? createAuthClient(API_URL, authStorage) : null;
export function authErrorMessage(error: unknown) {
  if (!(error instanceof AuthApiError)) return legacyErrorMessage(error);
  const messages: Record<string, string> = {
    invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
    invalid_email: "이메일 형식을 확인해 주세요.",
    email_taken: "이미 가입된 이메일이에요. 로그인해 주세요.",
    weak_password: "비밀번호는 대문자·소문자·숫자·특수문자를 포함해 8자 이상, UTF-8 기준 72바이트 이하로 정해 주세요.",
    unauthorized: "로그인이 만료됐어요. 다시 로그인해 주세요.",
    rate_limited: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    network_error: "서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.",
    database_unavailable: "서버에 잠시 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
    invalid_profile: "프로필 입력값을 확인해 주세요.",
    invalid_interests: "존재하는 관심 분야를 선택해 주세요.",
    account_deleting: "탈퇴 신청 중인 계정이에요. 7일 이내에는 아래에서 취소할 수 있어요.",
    deletion_period_expired: "탈퇴 신청 후 7일이 지나 취소할 수 없어요.",
    feature_not_migrated: "이 계정의 회원 탈퇴 기능은 아직 연결되지 않았어요.",
  };
  return messages[error.code] ?? "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
