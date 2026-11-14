import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboardService } from '../mysql/leaderboard-service.mjs';
import { AuthError } from './auth.mjs';

function fakeAuth(sub) { return { verifyAccess: async () => ({ sub, av: 1 }) }; }
function fakeDb(rows) {
  return { async execute(sql) {
    if (sql.includes('FROM domains')) return [[{ id: 'cs' }]];
    if (sql.includes('RANK() OVER')) return [rows];
    throw new Error('unexpected query: ' + sql);
  }, async end() {} };
}

test('leaderboard: 상위 N + 내 순위(상위 밖이어도) 반환', async () => {
  const rows = [
    { user_id: 'u1', nickname: '에이스', xp: 300, rnk: 1 },
    { user_id: 'u2', nickname: '비실', xp: 50, rnk: 2 },
  ];
  const service = createLeaderboardService({ auth: fakeAuth('u2'), connectionFactory: async () => fakeDb(rows) });
  const r = await service.top('Bearer x', 'cs', new URLSearchParams('limit=1'));
  assert.equal(r.domain, 'cs');
  assert.deepEqual(r.entries, [{ rank: 1, nickname: '에이스', xp: 300, me: false }]);
  assert.deepEqual(r.me, { rank: 2, xp: 50 });
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
