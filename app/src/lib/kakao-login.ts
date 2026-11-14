import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api";
import { AuthApiError, type AuthSession } from "./auth-client";
import { mysqlAuth } from "./auth";

/** 서버(api/server/kakao.mjs)가 로그인 뒤 돌려보내는 앱 주소 */
const RETURN_URL = "ppobgong://auth/kakao";

const b64url = (b64: string) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function randomVerifier() {
  const bytes = Crypto.getRandomBytes(32);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return b64url(btoa(bin));
}

/**
 * 카카오 로그인: 브라우저에서 카카오 로그인 → 서버가 계정 확인 → 앱으로 일회용 코드 → 세션.
 * 사용자가 창을 닫거나 취소하면 null.
 */
export async function kakaoSignIn(): Promise<AuthSession | null> {
  // 서버에 카카오 키가 아직 없으면 브라우저를 열지 않고 안내
  const health = await fetch(`${API_URL}/health`).then((r) => r.json()).catch(() => null);
  if (!health) throw new AuthApiError("network_error");
  if (!health.kakao) throw new AuthApiError("kakao_unavailable", 503);
  const verifier = randomVerifier();
  const challenge = b64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/kakao/start?challenge=${challenge}`, RETURN_URL);
  if (result.type !== "success") return null;
  const params = new URL(result.url.replace(/^ppobgong:\/\//, "https://app/")).searchParams;
  const error = params.get("error");
  if (error === "cancelled") return null;
  if (error) throw new AuthApiError(error, 400);
  const code = params.get("code");
  if (!code) throw new AuthApiError("kakao_failed", 400);
  return mysqlAuth.kakaoExchange(code, verifier);
}
