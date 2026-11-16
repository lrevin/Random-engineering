import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecallArgs, recallItem } from '../mysql/admin-recall.mjs';
import { validateRecord } from '../mysql/record-service.mjs';

test('admin-recall 인자 읽기', () => {
  assert.deepEqual(parseRecallArgs(['huwqvqtv']), { code: 'HUWQVQTV', topics: 5 });
  assert.deepEqual(parseRecallArgs(['HUWQVQTV', '--topics', '3']), { code: 'HUWQVQTV', topics: 3 });
  assert.throws(() => parseRecallArgs(['HUWQVQTV', '--topics', '9']));
  assert.throws(() => parseRecallArgs(['nope']));
});

test('admin-recall: 기본 문제로 만든 기록이 앱 업로드 검증을 그대로 통과하고 오답 2개를 가짐', () => {
  const mc = (n, a) => ({ type: 'mc', body: `문제 ${n}은?`, choices: JSON.stringify(['가', '나', '다', '라']), answer: String(a), explanation: `해설 ${n}입니다.` });
  const ox = (n, a) => ({ type: 'ox', body: `진술 ${n}이다.`, choices: null, answer: JSON.stringify(a), explanation: `해설 ${n}입니다.` });
  const rows = [mc(1, 2), ox(2, true), mc(3, 0), mc(4, 1), ox(5, false), mc(6, 3), mc(7, 2)];
  const items = rows.map((r, k) => recallItem(r, k < 2));
  const id = '11111111-2222-4333-8444-555555555555';
  const p = validateRecord({ id, attemptId: id, topicId: 'os-01', memo: '', studySec: 900, score: 5, total: 7, studiedAt: '2026-11-12T11:00:00.000Z', items });
  assert.equal(p.score, 5);
  assert.notEqual(items[0].answer, items[0].question.answer);
  assert.equal(items[1].answer, false);
  assert.ok(items.every((x) => x.question.src === 'bank'));
});
