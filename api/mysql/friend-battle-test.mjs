// 친구 1:1 배틀 신청 · 푸시 · 친구 정보 (실제 MySQL, V11 적용 · 문제 은행 가져오기 끝난 시험용 DB)
// 실행: cd api/server && npm run friend-battle:test
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { connect } from '../server/db.mjs';
import { createAuth } from '../server/auth.mjs';
import { purgeExpiredAccounts } from './account-service.mjs';
import { createBattleService } from './battle-service.mjs';
import { createMemberService } from './member-service.mjs';

test('친구 1:1 배틀 신청: 실제 MySQL', async (t) => {
  const db = await connect(), auth = createAuth({ secret: randomBytes(48).toString('base64url') }), users = [];
  let clock = Date.now();
  const sent = [];
  const push = { send: async (to, msg) => { sent.push([to, msg]); return 1; }, register: async () => true, unregister: async () => {} };
  const battles = createBattleService({ auth, push, now: () => new Date(clock) });
  const members = createMemberService({ auth, push, now: () => new Date(clock) });
  const signup = async (nickname) => {
    const s = await auth.signup({ email: randomUUID() + '@example.com', password: 'Password!123' }); users.push(s.user.id);
    const h = 'Bearer ' + s.accessToken;
    await db.execute("INSERT INTO profiles(user_id,nickname,interests,level,study_minutes,reminder_enabled,reminder_time) VALUES (?,?,?,1,10,0,'20:00')", [s.user.id, nickname, JSON.stringify(['algo'])]);
    const { uid } = await members.me(h);
    return { id: s.user.id, h, uid };
  };
  t.after(async () => {
    for (const id of users) await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 DAY) WHERE id=?", [id]);
    await purgeExpiredAccounts({ onlyUserIds: users }); await db.end();
  });
  const a = await signup('신청자'), b = await signup('받는이'), stranger = await signup('남');
  await members.friend(a.h, b.uid, 'request'); await members.friend(b.h, a.uid, 'accept');
  const tickets = async (u) => (await members.wallet(u.h)).state.freeTickets;

  await t.test('친구가 아니면 신청 불가', async () => {
    await assert.rejects(battles.challenge(a.h, { uid: stranger.uid, requestId: randomUUID() }), { code: 'not_friends' });
  });

  await t.test('접속 안 한 친구에게 신청하면 푸시, 배틀권 예약 · 받은 사람 inbox에 보임', async () => {
    await db.execute('UPDATE social_members SET last_seen_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE) WHERE user_id=?', [b.id]);
    const before = await tickets(a), requestId = randomUUID();
    const r = await battles.challenge(a.h, { uid: b.uid, requestId });
    assert.equal(r.notified, true); assert.equal(r.challenge.status, 'pending'); assert.equal(r.challenge.friend.nickname, '받는이');
    assert.deepEqual(sent.at(-1), [b.id, { title: '1:1 배틀 신청', body: '신청자님에게 1:1 배틀 신청이 왔어요.', data: { type: 'battle_challenge', challengeId: r.challenge.id } }]);
    assert.equal(await tickets(a), before - 1);
    assert.equal((await battles.challenge(a.h, { uid: b.uid, requestId })).challenge.id, r.challenge.id, '같은 요청 재전송은 같은 신청');
    await assert.rejects(battles.challenge(a.h, { uid: b.uid, requestId: randomUUID() }), { code: 'challenge_pending' });
    const inbox = await battles.inbox(b.h);
    assert.equal(inbox.incoming.length, 1); assert.equal(inbox.incoming[0].friend.nickname, '신청자');
    // 거절하면 배틀권 반환
    await battles.respond(b.h, r.challenge.id, 'decline');
    assert.equal(await tickets(a), before);
    await assert.rejects(battles.respond(b.h, r.challenge.id, 'accept'), { code: 'not_pending' });
  });

  await t.test('접속 중인 친구에게는 푸시 안 보냄 · 수락하면 배틀 시작', async () => {
    await battles.inbox(b.h); // 앱이 열려 있음
    const n = sent.length;
    const r = await battles.challenge(a.h, { uid: b.uid, requestId: randomUUID() });
    assert.equal(r.notified, false); assert.equal(sent.length, n);
    await assert.rejects(battles.respond(a.h, r.challenge.id, 'accept'), { code: 'not_found' }, '보낸 사람은 수락 못 함');
    const acc = await battles.respond(b.h, r.challenge.id, 'accept');
    assert.equal(acc.challenge.status, 'accepted'); assert.equal(acc.battle.kind, 'friend'); assert.equal(acc.battle.status, 'accepted');
    const mine = await battles.inbox(a.h);
    assert.equal(mine.current.id, acc.battle.id, '신청한 사람도 배틀로');
    await assert.rejects(battles.challenge(a.h, { uid: b.uid, requestId: randomUUID() }), { code: 'busy' });
    await battles.forfeit(b.h, acc.battle.id);
    const info = await members.friendInfo(a.h, b.uid);
    assert.equal(info.nickname, '받는이'); assert.deepEqual(info.versus, { wins: 1, losses: 0, draws: 0 });
    await assert.rejects(members.friendInfo(a.h, stranger.uid), { code: 'not_found' });
  });

  await t.test('10분이 지나면 만료되고 배틀권 반환', async () => {
    const before = await tickets(a);
    await battles.challenge(a.h, { uid: b.uid, requestId: randomUUID() });
    assert.equal(await tickets(a), before - 1);
    clock += 11 * 60 * 1000;
    const inbox = await battles.inbox(b.h);
    assert.equal(inbox.incoming.length, 0);
    assert.equal(await tickets(a), before);
  });
});
