// 비밀번호 찾기 · 탈퇴 철회 · 콕 찌르기 · 예약 알림 (실제 MySQL, V13 적용 시험용 DB)
// 실행: cd api/server && npm run account-notify:test
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { connect } from '../server/db.mjs';
import { createAuth } from '../server/auth.mjs';
import { createPasswordReset } from '../server/password-reset.mjs';
import { purgeExpiredAccounts, createAccountService } from './account-service.mjs';
import { createMemberService } from './member-service.mjs';
import { createNotifier } from './notifier-service.mjs';

test('계정 · 알림: 실제 MySQL', async (t) => {
  const db = await connect(), auth = createAuth({ secret: randomBytes(48).toString('base64url') }), users = [];
  let clock = Date.parse('2026-11-22T11:00:00Z'); // 일요일 20시 (한국)
  const now = () => new Date(clock);
  const sent = [], mails = [];
  const push = { send: async (to, msg) => { sent.push([to, msg]); return 1; }, register: async () => true, unregister: async () => {} };
  const members = createMemberService({ auth, push, now });
  const signup = async (nickname) => {
    const email = randomUUID() + '@example.com', s = await auth.signup({ email, password: 'Password!123' }); users.push(s.user.id);
    await db.execute("INSERT INTO profiles(user_id,nickname,interests,level,study_minutes,reminder_enabled,reminder_time) VALUES (?,?,?,1,10,1,'20:00')", [s.user.id, nickname, JSON.stringify(['algo'])]);
    const h = 'Bearer ' + s.accessToken, { uid } = await members.me(h);
    return { id: s.user.id, h, uid, email };
  };
  t.after(async () => {
    for (const id of users) await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 DAY) WHERE id=?", [id]);
    await purgeExpiredAccounts({ onlyUserIds: users }); await db.end();
  });

  await t.test('비밀번호 찾기: 코드 메일 → 새 비밀번호, 틀린 코드 5번이면 끝, 모르는 이메일도 같은 응답', async () => {
    const a = await signup('찾기'), codes = [];
    const reset = createPasswordReset({ mailer: { send: async (m) => { mails.push(m); } }, now, makeCode: () => { const c = String(100000 + codes.length); codes.push(c); return c; } });
    assert.deepEqual(await reset.forgot({ email: 'nobody-' + randomUUID() + '@example.com' }), { ok: true });
    assert.equal(mails.length, 0, '가입 안 한 이메일은 메일 안 보냄');
    await reset.forgot({ email: a.email.toUpperCase() });
    assert.equal(mails.length, 1); assert.match(mails[0].text, new RegExp(codes[0]));
    await assert.rejects(reset.reset({ email: a.email, code: '999999', password: 'NewPassword!1' }), { code: 'invalid_reset_code' });
    await assert.rejects(reset.reset({ email: a.email, code: codes[0], password: 'short' }), { code: 'weak_password' });
    assert.deepEqual(await reset.reset({ email: a.email, code: codes[0], password: 'NewPassword!1' }), { ok: true });
    await assert.rejects(reset.reset({ email: a.email, code: codes[0], password: 'Another!123' }), { code: 'reset_code_expired' }, '한 번 쓰면 끝');
    await assert.rejects(auth.login({ email: a.email, password: 'Password!123' }), { code: 'invalid_credentials' });
    assert.ok((await auth.login({ email: a.email, password: 'NewPassword!1' })).accessToken);
    await assert.rejects(members.me(a.h), { code: 'unauthorized' }, '예전 로그인은 끊김');
    // 5번 틀리면 코드가 막힘
    await reset.forgot({ email: a.email });
    for (let i = 0; i < 4; i++) await assert.rejects(reset.reset({ email: a.email, code: '000000', password: 'NewPassword!2' }), { code: 'invalid_reset_code' });
    await assert.rejects(reset.reset({ email: a.email, code: '000000', password: 'NewPassword!2' }), { code: 'reset_code_expired' });
    await assert.rejects(reset.reset({ email: a.email, code: codes.at(-1), password: 'NewPassword!2' }), { code: 'reset_code_expired' });
  });

  await t.test('탈퇴 신청 → 30일 안에 다시 로그인하면 철회 (구독 결제 멈춤 · 팀에서 빠짐)', async () => {
    const b = await signup('탈퇴');
    const r = await createAccountService({ auth }).requestDeletion(b.h);
    assert.equal(new Date(r.deleteAfter) - new Date(r.deletionRequestedAt), 30 * 86400e3);
    await db.execute('UPDATE users SET deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 29 DAY) WHERE id=?', [b.id]);
    assert.equal((await purgeExpiredAccounts({ onlyUserIds: [b.id] })).deleted, 0, '30일 전에는 안 지움');
    const s = await auth.login({ email: b.email, password: 'Password!123' });
    assert.equal(s.restored, true);
    const [[u]] = await db.execute('SELECT status,deletion_requested_at FROM users WHERE id=?', [b.id]);
    assert.equal(u.status, 'active'); assert.equal(u.deletion_requested_at, null);
  });

  await t.test('콕 찌르기: 친구만 · 오늘 공부 안 한 친구만 · 하루 1번', async () => {
    const c = await signup('찌름'), d = await signup('받음');
    await assert.rejects(members.poke(c.h, d.uid), { code: 'not_friends' });
    await members.friend(c.h, d.uid, 'request'); await members.friend(d.h, c.uid, 'accept');
    const info = await members.friendInfo(c.h, d.uid);
    assert.equal(info.studiedToday, false); assert.equal(info.pokedToday, false);
    assert.deepEqual(await members.poke(c.h, d.uid), { ok: true, notified: true });
    assert.deepEqual(sent.at(-1), [d.id, { title: '콕!', body: '찌름님이 콕 찔렀어요. 오늘 공부 한 판 어때요?', data: { type: 'poke' }, channelId: 'reminders' }]);
    await assert.rejects(members.poke(c.h, d.uid), { code: 'already_poked' });
    assert.equal((await members.friendInfo(c.h, d.uid)).pokedToday, true);
  });

  await t.test('주간 리포트(일요일 저녁) · 팀 응원(목표 절반 이상) 주 1번', async () => {
    const e = await signup('리포트');
    await db.execute('INSERT INTO push_tokens(token,user_id,platform) VALUES (?,?,?)', ['ExponentPushToken[' + randomBytes(12).toString('hex') + ']', e.id, 'android']);
    const notifier = createNotifier({ push, now });
    const n = sent.length;
    await notifier.tick();
    const mine = sent.slice(n).filter(([to]) => to === e.id);
    assert.equal(mine.length, 1); assert.equal(mine[0][1].title, '이번 주 공부 리포트');
    await notifier.tick();
    assert.equal(sent.slice(n).filter(([to]) => to === e.id).length, 1, '주 1번만');
    clock = Date.parse('2026-11-24T11:00:00Z'); // 화요일
    const m = sent.length; await notifier.tick(); assert.equal(sent.length, m, '평일엔 안 보냄');
  });
});
