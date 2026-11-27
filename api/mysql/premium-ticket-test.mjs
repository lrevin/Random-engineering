// 시연용 뽑공 프리미엄 티켓 (실제 MySQL). V12 이상 적용된 시험용 DB
// 실행: cd api/server && npm run premium-ticket:test
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { connect } from '../server/db.mjs';
import { createAuth } from '../server/auth.mjs';
import { purgeExpiredAccounts } from './account-service.mjs';
import { createMemberService, PREMIUM_TICKET_DAYS } from './member-service.mjs';
import { adminGrant } from './admin-grant.mjs';

test('프리미엄 티켓: 운영자 지급 → 사용하면 30일 프리미엄 → 기간이 끝나면 일반', async (t) => {
  const db = await connect(), auth = createAuth({ secret: randomBytes(48).toString('base64url') }), users = [];
  let clock = Date.parse('2026-11-27T03:00:00Z');
  const now = () => new Date(clock);
  const members = createMemberService({ auth, now });
  t.after(async () => {
    for (const id of users) await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 DAY) WHERE id=?", [id]);
    await purgeExpiredAccounts({ onlyUserIds: users }); await db.end();
  });
  const s = await auth.signup({ email: randomUUID() + '@example.com', password: 'Password!123' });
  users.push(s.user.id);
  const h = 'Bearer ' + s.accessToken, code = 'T' + randomBytes(4).toString('hex').toUpperCase().replace(/[^A-Z2-9]/g, 'K').slice(0, 7);
  await db.execute('INSERT INTO social_members(user_id,friend_code) VALUES (?,?)', [s.user.id, code]);
  const op = (action) => members.operate(h, { requestId: randomUUID(), action, payload: {} });

  // 프리미엄(운영자)이던 계정을 시연 준비 상태로: 일반 + 톱니바퀴 1500 + 티켓 1장
  await adminGrant({ code, gears: 999999, premium: true }, { now: now() });
  assert.equal((await members.wallet(h)).state.premium, true);
  const r = await adminGrant({ code, gears: 1500, premium: false, premiumTickets: 1 }, { now: now() });
  assert.deepEqual(r, { userId: s.user.id, balance: 1500, premium: false, premiumTickets: 1, subscribed: false });
  let w = await members.wallet(h);
  assert.equal(w.state.premium, false); assert.equal(w.state.premiumTickets, 1); assert.equal(w.balance, 1500);

  // 사용: 바로 프리미엄, 티켓 0장, 30일 뒤 만료, 톱니바퀴는 그대로
  w = await op('use_premium_ticket');
  assert.equal(w.state.premium, true); assert.equal(w.state.premiumTickets, 0); assert.equal(w.balance, 1500);
  assert.equal(w.state.premiumUntil, new Date(clock + PREMIUM_TICKET_DAYS * 86400000).toISOString());
  await assert.rejects(op('use_premium_ticket'), (e) => e.code === 'no_premium_ticket');

  // 다른 지갑 작업을 해도 프리미엄이 운영자 값으로 굳지 않음
  await op('buy_freeze');
  clock += 29 * 86400000;
  assert.equal((await members.wallet(h)).state.premium, true);
  clock += 2 * 86400000;
  w = await members.wallet(h);
  assert.equal(w.state.premium, false); assert.equal(w.state.premiumUntil, null);

  // 운영자가 프리미엄을 끄면 티켓 기간도 끝남
  await adminGrant({ code, premium: null, gears: null, premiumTickets: 1 }, { now: now() });
  await op('use_premium_ticket');
  assert.equal((await members.wallet(h)).state.premium, true);
  await adminGrant({ code, premium: false, gears: null }, { now: now() });
  assert.equal((await members.wallet(h)).state.premium, false);
});
