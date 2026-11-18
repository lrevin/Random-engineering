// 뽑공 프리미엄 월 구독 (실제 MySQL + 가짜 토스). V12 적용된 시험용 DB
// 실행: cd api/server && npm run subscription:test
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { connect } from '../server/db.mjs';
import { createAuth } from '../server/auth.mjs';
import { TossError } from '../server/toss.mjs';
import { purgeExpiredAccounts } from './account-service.mjs';
import { createMemberService } from './member-service.mjs';
import { createSubscriptionService } from './subscription-service.mjs';
import { billingPage } from './subscription-http.mjs';
import { SUB_PRICE, SUB_BONUS_GEARS, addMonth, orderIdFor } from './subscription-policy.mjs';

test('구독 규칙', () => {
  assert.equal(addMonth(new Date('2026-01-31T03:00:00Z')).toISOString(), '2026-02-28T03:00:00.000Z');
  assert.equal(addMonth(new Date('2026-11-18T10:00:00Z')).toISOString(), '2026-12-18T10:00:00.000Z');
  const id = orderIdFor('8d1f0c2a-1111-4222-8333-444455556666', new Date('2026-11-18T10:05:00Z'), 2);
  assert.match(id, /^[A-Za-z0-9_-]{6,64}$/); assert.equal(id, 'pgsub-8d1f0c2a1111-202611181005-2');
  const html = billingPage({ clientKey: 'test_ck_x', customerKey: 'c</script><script>alert(1)', amount: 4900, t: 'tok' });
  assert.ok(!html.includes('</script><script>alert(1)')); assert.match(html, /월 4,900원/);
});

test('월 구독: 실제 MySQL', async (t) => {
  const db = await connect(), auth = createAuth({ secret: randomBytes(48).toString('base64url') }), users = [];
  let clock = Date.parse('2026-11-18T03:00:00Z');
  const now = () => new Date(clock);
  const calls = [];
  let chargeMode = 'ok';
  const toss = {
    issue: async (authKey, customerKey) => { calls.push(['issue', authKey, customerKey]); if (authKey === 'bad') throw new TossError('INVALID_AUTH_KEY', 'x', 400); return { billingKey: 'bk_' + customerKey.slice(0, 8), customerKey, card: { number: '43301234****123*' } }; },
    charge: async (billingKey, body) => {
      calls.push(['charge', body.orderId, body.amount]);
      if (chargeMode === 'decline') throw new TossError('REJECT_CARD_COMPANY', '한도 초과', 400);
      if (chargeMode === 'timeout') throw new Error('The operation was aborted due to timeout');
      return { status: 'DONE', paymentKey: 'pk_' + body.orderId, orderId: body.orderId, approvedAt: now().toISOString() };
    },
    byOrder: async (orderId) => { calls.push(['byOrder', orderId]); if (chargeMode === 'paidBeforeTimeout') return { status: 'DONE', paymentKey: 'pk_late', approvedAt: now().toISOString() }; throw new TossError('NOT_FOUND_PAYMENT', '', 404); },
    removeKey: async (k) => { calls.push(['removeKey', k]); },
  };
  const subs = createSubscriptionService({ auth, toss, clientKey: 'test_ck_fake', secret: 's'.repeat(40), now, log: () => {} });
  const members = createMemberService({ auth, now });
  const signup = async () => { const s = await auth.signup({ email: randomUUID() + '@example.com', password: 'Password!123' }); users.push(s.user.id); return { id: s.user.id, h: 'Bearer ' + s.accessToken }; };
  t.after(async () => {
    for (const id of users) await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=?", [id]);
    await purgeExpiredAccounts({ onlyUserIds: users }); await db.end();
  });
  const a = await signup();
  const premium = async (u) => (await members.wallet(u.h)).state.premium;
  const balance = async (u) => (await members.wallet(u.h)).balance;
  const register = async (u, authKey = 'ak_ok') => {
    const { path } = await subs.checkout(u.h);
    const token = new URLSearchParams(path.split('?')[1]).get('t');
    const page = await subs.page(token);
    return subs.complete(token, page.customerKey, authKey);
  };

  await t.test('토스 키가 없으면 결제가 꺼짐', async () => {
    const off = createSubscriptionService({ auth, toss: null, clientKey: '', secret: 's'.repeat(40), now });
    assert.equal((await off.status(a.h)).available, false);
    await assert.rejects(off.checkout(a.h), { code: 'billing_unavailable' });
  });

  await t.test('카드 등록 → 첫 달 결제 → 프리미엄 + 톱니바퀴 300', async () => {
    assert.equal(await premium(a), false);
    const before = await balance(a);
    const { path } = await subs.checkout(a.h);
    const token = new URLSearchParams(path.split('?')[1]).get('t'), page = await subs.page(token);
    assert.equal((await subs.complete(token, 'someone-else-customer-key', 'ak')).code, 'bad_request', '다른 customerKey 거절');
    await assert.rejects(subs.page('forged'), { code: 'billing_expired' });
    assert.deepEqual(await subs.complete(token, page.customerKey, 'ak_ok'), { ok: true });
    const s = await subs.status(a.h);
    assert.equal(s.status, 'active'); assert.equal(s.premium, true); assert.equal(s.card, '카드 43301234****123*');
    assert.equal(s.currentPeriodEnd, '2026-12-18T03:00:00.000Z'); assert.equal(s.nextChargeAt, '2026-12-18T03:00:00.000Z');
    assert.equal(await premium(a), true); assert.equal(await balance(a), before + SUB_BONUS_GEARS);
    assert.equal(calls.filter((c) => c[0] === 'charge').at(-1)[2], SUB_PRICE);
    assert.deepEqual(await subs.complete(token, page.customerKey, 'ak_ok'), { ok: true, already: true }, '두 번 돌아와도 한 번만');
    await assert.rejects(subs.checkout(a.h), { code: 'already_subscribed' });
  });

  await t.test('해지하면 기간 끝까지 프리미엄, 해지 취소 가능, 기간 끝나면 종료 · 빌링키 삭제', async () => {
    let s = await subs.cancel(a.h);
    assert.equal(s.status, 'canceled'); assert.equal(s.premium, true); assert.equal(s.nextChargeAt, null);
    await assert.rejects(subs.checkout(a.h), { code: 'subscription_canceled' });
    s = await subs.resume(a.h); assert.equal(s.status, 'active'); assert.equal(s.nextChargeAt, '2026-12-18T03:00:00.000Z');
    await subs.cancel(a.h);
    clock = Date.parse('2026-12-18T03:05:00Z');
    const n = calls.length;
    await subs.renewDue();
    assert.ok(!calls.slice(n).some((c) => c[0] === 'charge'), '해지한 구독은 결제 안 함');
    assert.ok(calls.slice(n).some((c) => c[0] === 'removeKey'));
    assert.equal((await subs.status(a.h)).status, 'ended'); assert.equal(await premium(a), false);
  });

  await t.test('매달 자동결제: 성공하면 한 달 연장 + 톱니바퀴', async () => {
    const b = await signup();
    clock = Date.parse('2026-11-18T03:00:00Z');
    await register(b);
    const before = await balance(b);
    clock = Date.parse('2026-12-18T03:01:00Z');
    await subs.renewDue();
    const s = await subs.status(b.h);
    assert.equal(s.currentPeriodEnd, '2027-01-18T03:00:00.000Z'); assert.equal(await balance(b), before + SUB_BONUS_GEARS);
    await subs.renewDue();
    assert.equal(calls.filter((c) => c[0] === 'charge' && c[1].endsWith('-202612180300-1')).length, 1, '같은 달 두 번 결제 안 함');
  });

  await t.test('자동결제 실패: 하루 간격 3번 시도 후 종료', async () => {
    const c = await signup();
    clock = Date.parse('2026-11-18T03:00:00Z');
    await register(c);
    chargeMode = 'decline';
    clock = Date.parse('2026-12-18T03:01:00Z'); await subs.renewDue();
    let s = await subs.status(c.h); assert.equal(s.status, 'past_due'); assert.equal(s.premium, false); assert.equal(s.failedAttempts, 1);
    clock += 24 * 3600e3 + 60e3; await subs.renewDue();
    clock += 24 * 3600e3 + 60e3; await subs.renewDue();
    s = await subs.status(c.h); assert.equal(s.status, 'ended');
    chargeMode = 'ok';
  });

  await t.test('응답을 못 받은 결제는 실패로 치지 않고 주문번호로 확인 (두 번 결제 안 함)', async () => {
    const d = await signup();
    clock = Date.parse('2026-11-18T03:00:00Z');
    await register(d);
    chargeMode = 'timeout';
    clock = Date.parse('2026-12-18T03:01:00Z'); await subs.renewDue();
    let s = await subs.status(d.h); assert.equal(s.status, 'active'); assert.equal(s.failedAttempts, 0);
    chargeMode = 'paidBeforeTimeout';
    const n = calls.length;
    clock += 11 * 60e3; await subs.renewDue();
    assert.ok(calls.slice(n).some((x) => x[0] === 'byOrder')); assert.ok(!calls.slice(n).some((x) => x[0] === 'charge'));
    s = await subs.status(d.h); assert.equal(s.currentPeriodEnd, '2027-01-18T03:00:00.000Z');
    chargeMode = 'ok';
  });

  await t.test('첫 결제가 거절되면 카드 등록을 지우고 구독 안 됨', async () => {
    const e = await signup();
    chargeMode = 'decline';
    const r = await register(e);
    assert.deepEqual(r, { ok: false, code: 'REJECT_CARD_COMPANY' });
    const s = await subs.status(e.h); assert.equal(s.status, 'none'); assert.equal(s.premium, false);
    chargeMode = 'ok';
    assert.deepEqual(await register(e), { ok: true }, '다시 등록하면 됨');
  });
});
