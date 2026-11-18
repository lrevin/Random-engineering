/**
 * 토스페이먼츠 카드 자동결제(빌링) API 호출 (서버 전용).
 * 시크릿 키는 서버 환경변수 TOSS_SECRET_KEY 에만 둔다 (앱 · 저장소에 넣지 않음). 없으면 null → 결제 기능 꺼짐.
 * - 빌링키 발급: POST /v1/billing/authorizations/issue {authKey, customerKey}
 * - 자동결제 승인: POST /v1/billing/{billingKey} {customerKey, amount, orderId, orderName} (최대 60초)
 * - 주문번호로 결제 조회: GET /v1/payments/orders/{orderId} (응답을 못 받았을 때 실제 결제됐는지 확인)
 * - 빌링키 삭제: DELETE /v1/billing/{billingKey}
 * 문서: https://docs.tosspayments.com/guides/v2/billing/integration
 */
const BASE = 'https://api.tosspayments.com';

export class TossError extends Error {
  constructor(code, message, status) { super(code); this.code = code; this.tossMessage = message; this.status = status; }
}

export function createToss({ secretKey = process.env.TOSS_SECRET_KEY, fetcher = fetch } = {}) {
  if (!secretKey) return null;
  const authorization = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
  async function call(method, path, body, idempotencyKey) {
    const res = await fetcher(BASE + path, {
      method,
      headers: { Authorization: authorization, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(65000),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* 빈 본문 · 잘못된 응답 */ }
    if (!res.ok) throw new TossError(typeof data?.code === 'string' ? data.code : `HTTP_${res.status}`, typeof data?.message === 'string' ? data.message.slice(0, 250) : '', res.status);
    return data;
  }
  return {
    issue: (authKey, customerKey) => call('POST', '/v1/billing/authorizations/issue', { authKey, customerKey }),
    charge: (billingKey, { customerKey, amount, orderId, orderName }) =>
      call('POST', `/v1/billing/${encodeURIComponent(billingKey)}`, { customerKey, amount, orderId, orderName }, orderId),
    byOrder: (orderId) => call('GET', `/v1/payments/orders/${encodeURIComponent(orderId)}`),
    removeKey: (billingKey) => call('DELETE', `/v1/billing/${encodeURIComponent(billingKey)}`),
  };
}
