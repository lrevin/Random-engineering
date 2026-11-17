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

test('rankings: 주 시작은 한국 시간 월요일 0시 · 레벨 · 분야 랭크 규칙이 앱과 같음', async () => {
  const { weekStartUtc, levelOf, domainTier } = await import('../mysql/leaderboard-service.mjs');
  // 2026-11-16(월) 08:59 KST = 11-15 23:59 UTC → 그 주 월요일 0시 KST = 11-15 15:00 UTC
  assert.equal(weekStartUtc(Date.parse('2026-11-15T23:59:00Z')), '2026-11-15 15:00:00.000');
  // 일요일 23:00 KST는 지난주 월요일(11-09) 0시 KST = 11-08 15:00 UTC
  assert.equal(weekStartUtc(Date.parse('2026-11-15T14:00:00Z')), '2026-11-08 15:00:00.000');
  assert.equal(levelOf(0), 1); assert.equal(levelOf(49), 1); assert.equal(levelOf(50), 2); assert.equal(levelOf(110), 3);
  assert.equal(domainTier(0, 1), 0); assert.equal(domainTier(30, 1), 1); assert.equal(domainTier(1000, 29), 4); assert.equal(domainTier(1000, 30), 5);
});

function rankDb(handler, calls = []) {
  return { async execute(sql, args) { calls.push([sql.replace(/\s+/g, ' '), args]); return handler(sql, args); }, async end() {} };
}

test('rankings: 주간 XP · 레벨은 점수 0 제외, 같은 점수는 같은 순위, 숨김 · 신고 조건 포함', async () => {
  const calls = [];
  const rows = [
    { user_id: 'u1', nickname: '에이스', uid: 'ACEUID22', xp: '120' },
    { user_id: 'u2', nickname: '나', uid: 'SELFUID2', xp: '120' },
    { user_id: 'u3', nickname: '삼', uid: 'THREEUID', xp: '60' },
    { user_id: 'u4', nickname: '영', uid: 'ZEROUID2', xp: '0' },
  ];
  const service = createLeaderboardService({ auth: fakeAuth('u2'), now: () => Date.parse('2026-11-16T03:00:00Z'), connectionFactory: async () => rankDb(() => [rows], calls) });
  const w = await service.ranking('Bearer x', 'weekly', new URLSearchParams());
  assert.deepEqual(w.entries.map((e) => [e.rank, e.nickname, e.value, e.me, e.uid]), [[1, '에이스', 120, false, 'ACEUID22'], [1, '나', 120, true, null], [3, '삼', 60, false, 'THREEUID']]);
  assert.equal(w.since, '2026-11-15T15:00:00.000Z');
  const [q, args] = calls[0];
  assert.match(q, /x\.created_at>=\?/); assert.match(q, /r\.completed_at>=\?/);
  assert.deepEqual(args, ['2026-11-15 15:00:00.000', '2026-11-15 15:00:00.000', '2026-11-15 15:00:00.000', '2026-11-15 15:00:00.000', 'u2']);
  assert.match(q, /leaderboard_hidden,0\)=0 OR u\.id=\?/); assert.match(q, /COALESCE\(rc\.n,0\)>=3 THEN '학습자'/);
  const l = await service.ranking('Bearer x', 'level', new URLSearchParams('limit=1'));
  assert.equal(l.entries.length, 2); assert.equal(l.entries[0].level, 3); assert.equal(l.me.rank, 1);
  assert.doesNotMatch(calls.at(-1)[0], /created_at>=/, '레벨은 누적');
});

test('rankings: 분야 랭크는 사람마다 가장 높은 분야로, 랭크 → 점수 순', async () => {
  const users = [
    { user_id: 'u1', nickname: '가', uid: 'AAAAAAA2' },
    { user_id: 'u2', nickname: '나', uid: 'BBBBBBB2' },
    { user_id: 'u3', nickname: '다', uid: 'CCCCCCC2' },
  ];
  const doms = [
    { user_id: 'u1', domain: 'cs', points: '40', topics: '3' },   // 실버 40
    { user_id: 'u1', domain: 'ee', points: '120', topics: '9' },  // 골드 120 ← 대표
    { user_id: 'u2', domain: 'cs', points: '35', topics: '2' },   // 실버 35
    { user_id: 'u3', domain: 'me', points: '150', topics: '5' },  // 골드 150
  ];
  const service = createLeaderboardService({ auth: fakeAuth('u2'), connectionFactory: async () => rankDb((sql) => [sql.includes('FROM study_records') && !sql.includes('nickname_reports') ? doms : users]) });
  const r = await service.ranking('Bearer x', 'tier', new URLSearchParams());
  assert.deepEqual(r.entries.map((e) => [e.rank, e.nickname, e.tier, e.domain, e.value]), [[1, '다', 2, 'me', 150], [2, '가', 2, 'ee', 120], [3, '나', 1, 'cs', 35]]);
  assert.equal(r.me.rank, 3);
});

test('rankings: 없는 종류는 404', async () => {
  const service = createLeaderboardService({ auth: fakeAuth('u1'), connectionFactory: async () => { throw new Error('should not connect'); } });
  await assert.rejects(() => service.ranking('Bearer x', 'monthly', new URLSearchParams()), (e) => e instanceof AuthError && e.status === 404);
});
