/**
 * 뽑공 프리미엄 월 구독 (토스페이먼츠 카드 자동결제). 서버: api/mysql/subscription-service.mjs
 * 카드 등록 · 결제는 서버가 만든 결제 페이지를 브라우저로 열어서 하고, 끝나면 ppobgong://billing 으로 돌아옴.
 * 카드 정보 · 결제 키는 앱에 들어오지 않음.
 */
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api";
import { mysqlAuth } from "./auth";

/** 월 구독 가격 · 결제마다 주는 톱니바퀴 (서버 subscription-policy.mjs 와 같아야 함) */
export const SUB_PRICE = 4900;
export const SUB_BONUS_GEARS = 300;
const RETURN_URL = "ppobgong://billing";

export interface Subscription {
  /** 결제가 켜져 있는지 (서버에 토스 키가 있는지) */
  available: boolean;
  /** none: 구독 안 함 · active: 매달 결제 · canceled: 해지(기간 끝까지 이용) · past_due: 결제 실패, 다시 시도 중 · ended: 끝남 */
  status: "none" | "active" | "canceled" | "past_due" | "ended";
  amount: number;
  premium: boolean;
  currentPeriodEnd: string | null;
  nextChargeAt: string | null;
  canceledAt: string | null;
  /** 토스가 가린 카드 번호 일부 */
  card: string | null;
  failedAttempts: number;
}

export const getSubscription = () => mysqlAuth.apiRequest("/me/subscription") as Promise<Subscription>;
export const cancelSubscription = () => mysqlAuth.apiRequest("/me/subscription/cancel", {}, "POST") as Promise<Subscription>;
export const resumeSubscription = () => mysqlAuth.apiRequest("/me/subscription/resume", {}, "POST") as Promise<Subscription>;

/** 결제 페이지를 열어 카드 등록 · 첫 달 결제. 결과: success / cancel(창을 닫음) / fail(code) */
export async function startSubscription(): Promise<{ result: "success" | "cancel" | "fail"; code?: string }> {
  const { path } = (await mysqlAuth.apiRequest("/me/subscription/checkout", {}, "POST")) as { path: string };
  const r = await WebBrowser.openAuthSessionAsync(`${API_URL}${path}`, RETURN_URL);
  if (r.type !== "success") return { result: "cancel" };
  const q = new URL(r.url.replace(/^ppobgong:\/\//, "https://app/")).searchParams;
  const result = q.get("result");
  if (result === "success") return { result: "success" };
  if (result === "cancel") return { result: "cancel" };
  return { result: "fail", code: q.get("code") ?? undefined };
}

/** 사용자에게 보여 줄 문장 */
export function subscriptionMessage(code?: string) {
  return ({
    billing_unavailable: "결제를 준비하고 있어요. 잠시 후 다시 시도해 주세요.",
    already_subscribed: "이미 프리미엄을 구독하고 있어요.",
    subscription_canceled: "해지한 구독의 기간이 남아 있어요. '해지 취소'를 눌러 주세요.",
    billing_expired: "결제 시간이 지났어요. 다시 시도해 주세요.",
    PAYMENT_PENDING: "결제를 확인하고 있어요. 잠시 후 다시 열어 주세요.",
    REJECT_CARD_COMPANY: "카드사에서 결제를 거절했어요. 한도 · 잔액을 확인해 주세요.",
    INVALID_CARD_NUMBER: "카드 번호가 올바르지 않아요. 다시 확인해 주세요.",
    INVALID_CARD_EXPIRATION: "카드 유효기간이 올바르지 않아요.",
    INVALID_BIRTH_DAY_FORMAT: "생년월일 형식이 올바르지 않아요.",
    NOT_SUPPORTED_CARD_TYPE: "이 카드는 자동결제에 쓸 수 없어요. 다른 카드로 등록해 주세요.",
    rate_limited: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
    network_error: "인터넷 연결을 확인해 주세요.",
  } as Record<string, string>)[code ?? ""] ?? "결제를 끝내지 못했어요. 다시 시도해 주세요.";
}

/** "12월 18일" */
export const monthDay = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
