import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboardService } from '../mysql/leaderboard-service.mjs';
import { AuthError } from './auth.mjs';

function fakeAuth(sub) { return { verifyAccess: async () => ({ sub, av: 1 }) }; }
function fakeDb(rows, calls = []) {
  return { async execute(sql, args) {
    calls.push([sql.replace(/\s+/g, ' '), args]);
    if (sql.includes('FROM domains')) return [[{ id: 'cs' }]];
    if (sql.includes('RANK() OVER')) return [rows];
    if (sql.includes('FROM users WHERE id=?')) return [[{ id: args[0], status: 'active', auth_version: 1 }]];
    if (sql.includes('FROM social_members')) return [args[0] === 'SELFUID2' ? [{ user_id: 'u2' }] : args[0] === 'ACEUID22' ? [{ user_id: 'u1' }] : []];
    if (sql.includes('UPDATE profiles')) return [{ affectedRows: 1 }];
    return [[]];
  }, async beginTransaction() {}, async commit() {}, async rollback() {}, async end() {} };
}

test('leaderboard: 상위 N + 내 순위(상위 밖이어도) 반환, 다른 사람만 신고용 uid', async () => {
  const rows = [
    { user_id: 'u1', nickname: '에이스', uid: 'ACEUID22', xp: 300, rnk: 1 },
    { user_id: 'u2', nickname: '비실', uid: 'SELFUID2', xp: 50, rnk: 2 },
  ];
  const calls = [];
  const service = createLeaderboardService({ auth: fakeAuth('u2'), connectionFactory: async () => fakeDb(rows, calls) });
  const r = await service.top('Bearer x', 'cs', new URLSearchParams('limit=1'));
  assert.equal(r.domain, 'cs');
  assert.deepEqual(r.entries, [{ rank: 1, nickname: '에이스', xp: 300, me: false, uid: 'ACEUID22' }]);
  assert.deepEqual(r.me, { rank: 2, xp: 50 });
  const q = calls.find(([s]) => s.includes('RANK() OVER'))[0];
  assert.match(q, /leaderboard_hidden,0\)=0 OR s\.user_id=\?/, '숨긴 사람은 본인에게만 보임');
  assert.match(q, /COALESCE\(rc\.n,0\)>=3 THEN '학습자'/, '신고 3명 이상이면 닉네임 가림');
});

test('leaderboard: 없는 분야는 404', async () => {
  const service = createLeaderboardService({
    auth: fakeAuth('u1'),
    connectionFactory: async () => ({ async execute(sql) { if (sql.includes('FROM domains')) return [[]]; throw new Error('should not run'); }, async end() {} }),
  });
  await assert.rejects(() => service.top('Bearer x', 'nope', new URLSearchParams()), (e) => e instanceof AuthError && e.status === 404);
});

test('leaderboard: 잘못된 분야 id 형식은 즉시 404 (쿼리 없이)', async () => {
  const service = createLeaderboardService({ auth: fakeAuth('u1'), connectionFactory: async () => { throw new Error('should not connect'); } });
  await assert.rejects(() => service.top('Bearer x', 'has space', new URLSearchParams()), (e) => e instanceof AuthError && e.status === 404);
});

test('leaderboard: 숨기기 설정 · 신고 (자기 자신·형식 오류는 거절)', async () => {
  const calls = [];
  const service = createLeaderboardService({ auth: fakeAuth('u2'), connectionFactory: async () => fakeDb([], calls) });
  assert.deepEqual(await service.setSettings('Bearer x', { hidden: true }), { hidden: true });
  await assert.rejects(() => service.setSettings('Bearer x', { hidden: 'yes' }), (e) => e.code === 'invalid_settings');
  assert.deepEqual(await service.report('Bearer x', { uid: 'aceuid22', reason: 'offensive' }), { ok: true });
  assert.ok(calls.some(([s, a]) => s.startsWith('INSERT IGNORE INTO nickname_reports') && a[0] === 'u2' && a[1] === 'u1'));
  await assert.rejects(() => service.report('Bearer x', { uid: 'SELFUID2' }), (e) => e.code === 'self');
  await assert.rejects(() => service.report('Bearer x', { uid: 'bad' }), (e) => e.code === 'invalid_report');
});
