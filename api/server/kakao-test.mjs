import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { kakaoRoutes, challengeOf } from './kakao.mjs';
import { AuthError } from './auth.mjs';

// DB 없이: 가짜 auth + 가짜 카카오 API로 시작 → 콜백 → 교환 흐름을 검사
function setup({ kakaoId = 1234567890, status = 'active' } = {}) {
  const calls = [];
  const auth = { async kakaoLogin(v) { calls.push(v); if (status === 'deleting') throw new AuthError('account_deleting', 401);
    return { accessToken: 'a', refreshToken: 'r'.repeat(64), expiresIn: 900, user: { id: 'u1', email: v.email }, isNew: true }; } };
  const fetcher = async (url, init) => {
    if (String(url).endsWith('/oauth/token')) {
      assert.equal(init.body.get('code'), 'good-code');
      assert.equal(init.body.get('client_secret'), 'sec');
      return new Response(JSON.stringify({ access_token: 'kakao-token' }), { status: 200 });
    }
    assert.equal(init.headers.Authorization, 'Bearer kakao-token');
    return new Response(JSON.stringify({ id: kakaoId, kakao_account: { email: 'A@b.com', is_email_valid: true, is_email_verified: true } }), { status: 200 });
  };
  const handle = kakaoRoutes(auth, { restKey: 'rest', clientSecret: 'sec', redirectUri: 'https://x/auth/kakao/callback', secret: 's'.repeat(40), fetcher });
  const server = http.createServer(async (req, res) => {
    const send = (st, body, extra = {}) => { res.writeHead(st, { 'Content-Type': 'application/json', ...extra }); res.end(body === undefined ? undefined : JSON.stringify(body)); };
    if (!(await handle(req, new URL(req.url, 'http://l').pathname, send))) send(404, { error: 'nf' });
  });
  return { server, calls };
}

test('kakao start → callback → exchange', async t => {
  const { server, calls } = setup();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const verifier = randomBytes(32).toString('base64url'), challenge = challengeOf(verifier);

  assert.equal((await fetch(`${base}/auth/kakao/start?challenge=short`, { redirect: 'manual' })).status, 400);
  const start = await fetch(`${base}/auth/kakao/start?challenge=${challenge}`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const authorize = new URL(start.headers.get('location'));
  assert.equal(authorize.host, 'kauth.kakao.com');
  assert.equal(authorize.searchParams.get('client_id'), 'rest');
  const state = authorize.searchParams.get('state');

  // 위조한 state는 거절
  const bad = await fetch(`${base}/auth/kakao/callback?code=good-code&state=xxx`, { redirect: 'manual' });
  assert.match(bad.headers.get('location'), /^ppobgong:\/\/auth\/kakao\?error=expired$/);
  // 취소
  const cancel = await fetch(`${base}/auth/kakao/callback?error=access_denied&state=${state}`, { redirect: 'manual' });
  assert.match(cancel.headers.get('location'), /error=cancelled/);

  const cb = await fetch(`${base}/auth/kakao/callback?code=good-code&state=${state}`, { redirect: 'manual' });
  const back = new URL(cb.headers.get('location'));
  assert.equal(back.protocol, 'ppobgong:');
  const code = back.searchParams.get('code');
  assert.ok(code);
  assert.deepEqual(calls, [{ subject: '1234567890', email: 'A@b.com' }]);

  const post = body => fetch(`${base}/auth/kakao/exchange`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  // verifier가 틀리면 거절되고 코드도 버려짐
  assert.equal((await post({ code, verifier: randomBytes(32).toString('base64url') })).status, 401);
  assert.equal((await post({ code, verifier })).status, 401);

  // 새로 받은 코드는 맞는 verifier로 한 번만
  const cb2 = await fetch(`${base}/auth/kakao/callback?code=good-code&state=${state}`, { redirect: 'manual' });
  const code2 = new URL(cb2.headers.get('location')).searchParams.get('code');
  const ok = await post({ code: code2, verifier });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).user.id, 'u1');
  assert.equal((await post({ code: code2, verifier })).status, 401);
});

test('kakao: 탈퇴 신청 중인 계정은 오류로 돌려보냄', async t => {
  const { server } = setup({ status: 'deleting' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = await fetch(`${base}/auth/kakao/start?challenge=${challengeOf(randomBytes(32).toString('base64url'))}`, { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cb = await fetch(`${base}/auth/kakao/callback?code=good-code&state=${state}`, { redirect: 'manual' });
  assert.match(cb.headers.get('location'), /error=account_deleting/);
});

test('kakao: 키가 없으면 꺼짐', () => {
  assert.equal(kakaoRoutes({}, { restKey: '', redirectUri: '' }), null);
});
