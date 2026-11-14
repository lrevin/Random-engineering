import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { question, loadBank, rowsFor, readPool, writePool } from '../shared/question-store.mjs';
import { createServer } from './server.mjs';

const q = { type: 'mc', q: '옳은 것은?', choices: ['가', '나', '다', '라'], answer: 0, explain: '설명입니다.' };
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-questions-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('same topic in multiple files merges without dropping questions', t => {
  const dir = temp(t);
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ 'os-01': [q] }));
  fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ 'os-01': [{ ...q, q: '두 번째 질문은?' }] }));
  assert.equal(loadBank(dir, { 'os-01': {} })['os-01'].length, 2);
  assert.throws(() => loadBank(dir, {}), /invalid topic/);
  fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ 'os-01': [q] }));
  assert.throws(() => loadBank(dir, { 'os-01': {} }), /duplicate/);
});

test('rejects malformed answers and choices', () => {
  for (const invalid of [{ ...q, answer: true }, { ...q, answer: 4 }, { ...q, choices: ['가','가','다','라'] },
    { ...q, choices: ['가',' 가 ','다','라'] }, { type: 'ox', q: '문장이다.', answer: 1, explain: '설명' }]) {
    assert.throws(() => question(invalid));
  }
  assert.equal(question({ type: 'ox', q: '문장이다.', answer: false, explain: '설명' }).answer, false);
});

test('derived row identity survives reordering and changes with content', () => {
  const first = rowsFor({ 'os-01': [q] })[0];
  assert.equal(first.id, rowsFor({ 'os-01': [{ explain: q.explain, answer: 0, choices: q.choices, q: q.q, type: 'mc' }] })[0].id);
  assert.notEqual(first.id, rowsFor({ 'os-01': [{ ...q, answer: 1 }] })[0].id);
  assert.notEqual(first.id, rowsFor({ 'os-02': [q] })[0].id);
});

test('atomic pool writes preserve metadata; corrupt pools fail instead of resetting', t => {
  const dir = temp(t), file = path.join(dir, 'os-01.json');
  assert.deepEqual(readPool(file), []);
  writePool(file, [{ ...q, reviewed: 2, served: 3 }]);
  assert.equal(readPool(file)[0].served, 3);
  assert.deepEqual(fs.readdirSync(dir), ['os-01.json']);
  assert.throws(() => writePool(file, [{ ...q, answer: 8 }]));
  assert.equal(readPool(file)[0].served, 3);
  fs.writeFileSync(file, '{');
  assert.throws(() => readPool(file));
});

test('HTTP JSON API handles known empty topics, ETags, prefixes, CORS and traversal', async t => {
  const server = createServer({ topics: { 'os-01': {}, 'os-02': {} }, bank: { 'os-01': [q] } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const a = await fetch(`${base}/api/quiz-bank/os-01`);
  assert.equal(a.status, 200);
  assert.deepEqual(await a.json(), { questions: [q] });
  assert.equal((await fetch(`${base}/quiz-bank/os-01`, { headers: { 'If-None-Match': a.headers.get('etag') } })).status, 304);
  assert.deepEqual(await (await fetch(`${base}/quiz-bank/os-02`)).json(), { questions: [] });
  for (const p of ['unknown', '__proto__', '%2e%2e%2fsecret']) assert.equal((await fetch(`${base}/quiz-bank/${p}`)).status, 404);
  assert.equal((await fetch(`${base}/quiz-bank/%ZZ`)).status, 400);
  assert.equal((await fetch(base, { method: 'OPTIONS' })).status, 204);
  assert.equal((await fetch(`${base}/auth/signup`, { method: 'POST' })).status, 404);
});

test('all repository JSON validates and every exported row has a unique id', () => {
  const rows = rowsFor(loadBank());
  assert.ok(rows.length > 0);
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length);
});
