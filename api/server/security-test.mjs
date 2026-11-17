// 보안 검토(2026-11-17)에서 고친 것들 확인 (DB 없이)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { overLimit } from './client-key.mjs';
import { quizProxyRoutes, QUIZ_DAILY_LIMIT, QUIZ_FRESH_DAILY_LIMIT } from './quiz-proxy.mjs';
import { adRewardRoutes } from '../mysql/ad-reward.mjs';
import { createServer } from './server.mjs';
import { CLIENT_RECORD_DAILY_LIMIT } from '../mysql/reward-eligibility.mjs';

test('요청 제한 표가 가득 차도 새 사람은 막지 않고 가장 오래된 칸을 버림', () => {
  const hits = new Map();
  for (let i = 0; i < 5; i++) assert.equal(overLimit(hits, 'fake' + i, 10, 1000, { max: 5 }), false);
  assert.equal(overLimit(hits, 'real', 10, 1000, { max: 5 }), false);
  assert.equal(hits.size, 5); assert.ok(!hits.has('fake0') && hits.has('real'));
  for (let i = 0; i < 9; i++) overLimit(hits, 'real', 10, 1000, { max: 5 });
  assert.equal(overLimit(hits, 'real', 10, 1000, { max: 5 }), true);
  assert.equal(overLimit(hits, 'real', 10, 61001, { max: 5 }), false, '1분 지나면 다시');
});

test('전체 요청은 IP마다 분당 한도', async () => {
  const server = createServer({ topics: {}, bank: {}, ipLimit: 3 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/health`;
  try {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await fetch(url)).status);
    assert.deepEqual(codes, [200, 200, 200, 429]);
  } finally { server.close(); }
});

function fakeReq(body, auth = 'Bearer ok') {
  const data = Buffer.from(JSON.stringify(body));
  return { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, async *[Symbol.asyncIterator]() { yield data; } };
}
const auth = { async me(h) { if (h !== 'Bearer ok') { const { AuthError } = await import('./auth.mjs'); throw new AuthError('unauthorized', 401); } return { user: { id: 'u1' } }; } };

test('퀴즈 AI는 로그인 회원만, 토큰은 서버가 붙이고, 하루 횟수 · 새로 만들기 횟수 제한', async () => {
  assert.equal(quizProxyRoutes(auth, { url: 'http://q', token: '' }), null, '토큰 없으면 꺼짐');
  const sent = [];
  const fetcher = async (url, init) => { sent.push([url, init.headers['x-quiz-token'], JSON.parse(init.body)]); return { ok: true, json: async () => ({ questions: [{ q: 'a' }], fresh: 1 }) }; };
  const route = quizProxyRoutes(auth, { url: 'http://q/', token: 'secret-token', fetcher, now: () => new Date('2026-11-17T03:00:00Z') });
  const call = async (body, h) => { let out; await route(fakeReq(body, h), '/me/quiz', (s, b) => { out = [s, b]; }); return out; };
  assert.equal((await call({ topicId: 'os-01' }, 'Bearer bad'))[0], 401);
  assert.equal((await call({ topicId: '../x' }))[0], 400);
  assert.deepEqual(await call({ topicId: 'os-01', count: 4, avoid: ['x'], fresh: true }), [200, { questions: [{ q: 'a' }], fresh: 1 }]);
  assert.deepEqual(sent[0], ['http://q/quiz', 'secret-token', { topicId: 'os-01', count: 4, avoid: ['x'], fresh: true }]);
  for (let i = 1; i < QUIZ_DAILY_LIMIT; i++) await call({ topicId: 'os-01', fresh: true });
  assert.equal(sent.filter(([, , b]) => b.fresh).length, QUIZ_FRESH_DAILY_LIMIT, '새로 만들기는 하루 한도까지만');
  assert.deepEqual(await call({ topicId: 'os-01' }), [429, { error: 'quiz_daily_limit' }]);
  assert.equal(sent.length, QUIZ_DAILY_LIMIT);
});

test('앱에는 퀴즈 서버 토큰이 없음', () => {
  const quiz = readFileSync(new URL('../../app/src/lib/quiz.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(quiz, /QUIZ_SERVER_TOKEN|x-quiz-token/);
});

test('광고 단위 설정이 없으면 광고 보상을 지급하지 않음', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const msg = new URLSearchParams({ ad_unit: '1', transaction_id: 't1', user_id: '11111111-2222-3333-4444-555555555555' }).toString();
  const q = `${msg}&signature=${sign('sha256', Buffer.from(msg), { key: privateKey, dsaEncoding: 'der' }).toString('base64url')}&key_id=1`;
  const grants = [];
  const route = adRewardRoutes({ async grant(...a) { grants.push(a); return 'granted'; } }, { getKey: async () => publicKey, adUnits: [] });
  let out; const err = console.error; console.error = () => {};
  try { await route({ method: 'GET', url: '/ads/admob/ssv?' + q }, '/ads/admob/ssv', (s, b) => { out = [s, b]; }); } finally { console.error = err; }
  assert.deepEqual(out, [200, { ok: false, reason: 'ad_units_not_configured' }]);
  assert.equal(grants.length, 0);
});

test('규칙이 코드에 들어 있음: 기록 하루 제한 · 보스전 검증 문제만 · 팀은 들어온 뒤 XP · 믿을 만한 신고만', () => {
  assert.equal(CLIENT_RECORD_DAILY_LIMIT, 3);
  const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.match(src('../mysql/record-service.mjs'), /client_daily_limit/);
  const boss = src('../mysql/boss-service.mjs');
  assert.match(boss, /a\.verification_status='server_verified'/); assert.doesNotMatch(boss, /question_snapshot/);
  assert.match(src('../mysql/team-service.mjs'), /GREATEST\(\?,m\.joined_at\)/);
  assert.match(src('../mysql/leaderboard-service.mjs'), /ru\.created_at<=DATE_SUB/);
});
