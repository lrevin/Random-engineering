import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUB_PRICE, SUB_BONUS_GEARS, addMonth, orderIdFor, effectiveStatus } from '../mysql/subscription-policy.mjs';
import { billingPage } from '../mysql/subscription-http.mjs';
import { createToss } from './toss.mjs';

test('월 구독 규칙: 한 달 뒤 · 주문번호 · 상태', () => {
  assert.equal(addMonth(new Date('2026-01-31T03:00:00Z')).toISOString(), '2026-02-28T03:00:00.000Z');
  assert.equal(addMonth(new Date('2028-01-31T03:00:00Z')).toISOString(), '2028-02-29T03:00:00.000Z');
  assert.equal(addMonth(new Date('2026-12-15T00:00:00Z')).toISOString(), '2027-01-15T00:00:00.000Z');
  assert.match(orderIdFor('8d1f0c2a-1111-4222-8333-444455556666', new Date('2026-11-18T10:05:00Z'), 3), /^pgsub-8d1f0c2a1111-202611181005-3$/);
  const now = new Date('2026-11-18T00:00:00Z'), later = '2026-12-01 00:00:00.000Z', past = '2026-11-01T00:00:00Z';
  assert.equal(effectiveStatus(null, now), 'none');
  assert.equal(effectiveStatus({ status: 'canceled', current_period_end: later }, now), 'canceled');
  assert.equal(effectiveStatus({ status: 'canceled', current_period_end: past }, now), 'ended');
  assert.equal(effectiveStatus({ status: 'past_due', current_period_end: past }, now), 'past_due');
  assert.equal(effectiveStatus({ status: 'pending', current_period_end: null }, now), 'none');
});

test('앱 가격 · 보너스가 서버와 같음', () => {
  const app = readFileSync(new URL('../../app/src/lib/subscription.ts', import.meta.url), 'utf8');
  assert.match(app, new RegExp(`SUB_PRICE = ${SUB_PRICE};`)); assert.match(app, new RegExp(`SUB_BONUS_GEARS = ${SUB_BONUS_GEARS};`));
  assert.doesNotMatch(app, /TOSS_SECRET|test_sk_|live_sk_/, '앱에 시크릿 키 없음');
});

test('결제 페이지: 값이 스크립트를 깨지 못함 · 토스 SDK v2', () => {
  const html = billingPage({ clientKey: 'k', customerKey: '"</script><img src=x onerror=alert(1)>', amount: 4900, t: 't' });
  assert.ok(!html.includes('</script><img'));
  assert.match(html, /js\.tosspayments\.com\/v2\/standard/); assert.match(html, /requestBillingAuth\(\{method:"CARD"/);
});

test('토스 호출: Basic 인증(시크릿 키 + 콜론) · 결제 주문번호를 멱등 키로', async () => {
  const seen = [];
  const toss = createToss({ secretKey: 'test_sk_abc', fetcher: async (url, init) => { seen.push([url, init]); return new Response(JSON.stringify({ status: 'DONE' }), { status: 200 }); } });
  await toss.charge('bk/1', { customerKey: 'c', amount: 4900, orderId: 'o-1', orderName: 'n' });
  assert.equal(seen[0][0], 'https://api.tosspayments.com/v1/billing/bk%2F1');
  assert.equal(seen[0][1].headers.Authorization, 'Basic ' + Buffer.from('test_sk_abc:').toString('base64'));
  assert.equal(seen[0][1].headers['Idempotency-Key'], 'o-1');
  assert.equal(createToss({ secretKey: '' }), null);
  const failing = createToss({ secretKey: 'k', fetcher: async () => new Response(JSON.stringify({ code: 'REJECT_CARD_COMPANY', message: 'm' }), { status: 400 }) });
  await assert.rejects(failing.issue('a', 'c'), (e) => e.code === 'REJECT_CARD_COMPANY' && e.status === 400);
});
