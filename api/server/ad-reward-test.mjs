import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifySsv, adRewardRoutes, kstDayStartUtc } from '../mysql/ad-reward.mjs';

// 구글 대신 시험용 키로 서명한 SSV 요청을 만들어 확인 (DB 없이)
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const getKey = async id => (id === '123' ? publicKey : null);
function signed(params, keyId = '123') {
  const msg = new URLSearchParams(params).toString();
  const sig = sign('sha256', Buffer.from(msg), { key: privateKey, dsaEncoding: 'der' }).toString('base64url');
  return `${msg}&signature=${sig}&key_id=${keyId}`;
}
const base = { ad_network: '5450213213286189855', ad_unit: '1651172098', reward_amount: '10', reward_item: '톱니바퀴', timestamp: '1700000000000', transaction_id: 'abc123', user_id: '11111111-2222-3333-4444-555555555555' };

test('SSV 서명 확인', async () => {
  const q = signed(base);
  assert.equal((await verifySsv(q, getKey)).get('transaction_id'), 'abc123');
  assert.equal(await verifySsv(q.replace('abc123', 'abc124'), getKey), null); // 값 바꾸면 실패
  assert.equal(await verifySsv(signed(base, '999'), getKey), null); // 모르는 키
  assert.equal(await verifySsv('user_id=x', getKey), null);
});

test('SSV 경로: 지급 / 서명 오류 / 콘솔 확인 요청 / 다른 광고 단위', async () => {
  const grants = [];
  const service = { async grant(u, t) { grants.push([u, t]); return grants.length > 1 ? 'duplicate' : 'granted'; } };
  const route = adRewardRoutes(service, { getKey, adUnits: ['ca-app-pub-2812024386507663/1651172098'] });
  const call = async url => { let out; await route({ method: 'GET', url }, '/ads/admob/ssv', (s, b) => { out = [s, b]; }); return out; };
  assert.deepEqual(await call('/ads/admob/ssv?' + signed(base)), [200, { ok: true, result: 'granted' }]);
  assert.deepEqual(await call('/ads/admob/ssv?' + signed(base)), [200, { ok: false, result: 'duplicate' }]);
  assert.equal((await call('/ads/admob/ssv?' + signed(base).replace('reward_amount=10', 'reward_amount=99')))[0], 403);
  const { user_id, ...noUser } = base;
  assert.deepEqual(await call('/ads/admob/ssv?' + signed(noUser)), [200, { ok: true, test: true }]);
  assert.deepEqual(await call('/ads/admob/ssv?' + signed({ ...base, ad_unit: '42' })), [200, { ok: false, reason: 'unknown_ad_unit' }]);
  assert.deepEqual(grants, [[base.user_id, 'abc123'], [base.user_id, 'abc123']]);
});

test('한국 시간 하루 시작', () => {
  assert.equal(kstDayStartUtc(new Date('2026-11-14T16:30:00Z')), '2026-11-14 15:00:00'); // KST 15일 01:30 → 15일 0시
  assert.equal(kstDayStartUtc(new Date('2026-11-14T14:59:00Z')), '2026-11-13 15:00:00');
});
