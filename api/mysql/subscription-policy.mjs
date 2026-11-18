// 뽑공 프리미엄 월 구독 규칙 (앱 app/src/lib/subscription.ts 의 숫자와 같아야 함 — 서버 테스트가 비교)
export const SUB_PRICE = 4900;
/** 결제가 될 때마다 주는 톱니바퀴 (상점의 '결제하는 순간 톱니바퀴 300개') */
export const SUB_BONUS_GEARS = 300;
/** 자동결제가 실패하면 하루 간격으로 이만큼까지 다시 시도하고, 그래도 안 되면 구독 종료 */
export const SUB_MAX_ATTEMPTS = 3;
export const SUB_RETRY_MS = 24 * 3600 * 1000;
export const SUB_ORDER_NAME = '뽑공 프리미엄 1개월';

/** 한 달 뒤 같은 날 (31일 → 다음 달 마지막 날) */
export function addMonth(d) {
  const t = new Date(d);
  const day = t.getUTCDate();
  t.setUTCDate(1);
  t.setUTCMonth(t.getUTCMonth() + 1);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t;
}

/** 토스 주문번호 (6~64자, 영문 · 숫자 · - _): 구독 기간 시작 시각 + 시도 번호로 정해서 같은 결제를 두 번 하지 않게 */
export function orderIdFor(customerKey, periodStart, attempt) {
  const stamp = new Date(periodStart).toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `pgsub-${customerKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}-${stamp}-${attempt}`;
}

/** 화면에 보여 줄 상태: 기간이 끝난 해지 · 실패 구독은 ended */
export function effectiveStatus(row, now) {
  if (!row) return 'none';
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  if (row.status === 'pending') return end && end > now ? 'canceled' : 'none';
  // 결제 재시도 중(past_due)은 기간이 끝나도 그대로 보여 줌 (프리미엄은 꺼짐)
  if (row.status === 'active' || row.status === 'past_due') return row.status;
  if (!end || end <= now) return 'ended';
  return row.status;
}
