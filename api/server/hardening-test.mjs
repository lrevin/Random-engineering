import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressService } from '../mysql/progress-service.mjs';
import { nicknameAllowed } from './nickname-policy.mjs';
import { clientErrorRoutes } from './client-errors.mjs';
import { Readable } from 'node:stream';

const auth = { verifyAccess: async () => ({ sub: 'u1', av: 1 }) };
function fakeDb(calls) {
  return {
    async execute(sql, args) {
      calls.push([sql.replace(/\s+/g, ' '), args]);
      if (sql.includes('FROM users WHERE id=?')) return [[{ id: 'u1', status: 'active', auth_version: 1 }]];
      if (sql.includes('SELECT name,value')) return [[{ name: 'exam', value: '{"results":[]}', updated: '2026-11-15T01:00:00.000Z' }]];
      if (sql.includes('AS updated FROM user_progress')) return [[{ updated: '2026-11-15T02:00:00.000Z' }]];
      return [[]];
    },
    async beginTransaction() {}, async commit() {}, async rollback() {}, async end() {},
  };
}

test('학습 진행 보관: 목록 · 저장, 허용 안 된 이름과 잘못된 값은 거절', async () => {
  const calls = [];
  const service = createProgressService({ auth, connectionFactory: async () => fakeDb(calls) });
  assert.deepEqual(await service.list('Bearer x'), { items: { exam: { value: { results: [] }, updatedAt: '2026-11-15T01:00:00.000Z' } } });
  assert.deepEqual(await service.save('Bearer x', 'recall', { value: { 'os-01': 1 } }), { updatedAt: '2026-11-15T02:00:00.000Z' });
  assert.ok(calls.some(([s, a]) => s.startsWith('INSERT INTO user_progress') && a[1] === 'recall'));
  assert.throws(() => service.save('Bearer x', 'gears', { value: {} }), (e) => e.status === 404);
  assert.throws(() => service.save('Bearer x', 'exam', { value: 'x' }), (e) => e.code === 'invalid_progress');
  assert.throws(() => service.save('Bearer x', 'exam', { value: { big: 'a'.repeat(300 * 1024) } }), (e) => e.status === 413);
});

test('닉네임 금칙어: 띄어쓰기 · 숫자 · 기호 우회도 잡고, 일반 닉네임은 통과', () => {
  for (const bad of ['시발', '시 1 발', 'ㅅ.ㅂ', 'Fuck123', '운영자', '뽑공 공식']) assert.equal(nicknameAllowed(bad), false, bad);
  for (const ok of ['공대생', '열공하는토끼', 'study_kim', '이재빈']) assert.equal(nicknameAllowed(ok), true, ok);
});

test('앱 오류 보고: 한 줄로 잘라서 로그에 남기고 204', async () => {
  const lines = [];
  const handle = clientErrorRoutes({ log: (m) => lines.push(m) });
  const body = JSON.stringify({ where: 'screen', message: 'boom\nsecond line', stack: 'at x', version: '1.0.0', platform: 'android' });
  const req = Object.assign(Readable.from([Buffer.from(body)]), { method: 'POST', headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '203.0.113.1' } });
  let status;
  assert.equal(await handle(req, '/client-errors', (s) => { status = s; }), true);
  assert.equal(status, 204);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[client-error\] screen \| boom second line \| at x \| 1\.0\.0 android$/);
  assert.equal(await handle(req, '/other', () => {}), false);
});
