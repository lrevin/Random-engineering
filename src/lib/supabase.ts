import "./storage-polyfill";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** .env.local 에 Supabase 정보가 없으면 null — 이때 앱은 "둘러보기(게스트)" 모드로만 동작합니다. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

if (supabase) {
  AppState.addEventListener("change", (s) => {
    if (s === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Supabase 오류 메시지를 사용자용 한국어로 바꿉니다. */
export function authErrorMessage(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (/Email not confirmed/i.test(m)) return "메일함에서 인증 링크를 먼저 눌러 주세요.";
  if (/already registered|already been registered/i.test(m)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (/Password should be at least/i.test(m)) return "비밀번호는 8자 이상으로 정해 주세요.";
  if (/rate limit/i.test(m)) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  if (/invalid.*email|Unable to validate email/i.test(m)) return "이메일 형식을 확인해 주세요.";
  if (/network|fetch/i.test(m)) return "인터넷 연결을 확인해 주세요.";
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}
