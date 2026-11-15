import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AuthError } from './auth.mjs';
import { readJsonBody } from './auth-http.mjs';

/**
 * 카카오 로그인 (서버가 카카오와 직접 주고받는 방식, PKCE 비슷하게 앱을 묶음)
 *
 * 1) 앱: 임의 문자열 verifier를 만들고 challenge=SHA256(verifier)를 붙여
 *    GET /auth/kakao/start?challenge=... 를 브라우저로 연다.
 * 2) 서버: challenge를 서명한 state와 함께 카카오 로그인 화면으로 보낸다.
 * 3) 카카오 → GET /auth/kakao/callback?code&state
 *    서버가 code를 카카오 토큰으로 바꾸고 /v2/user/me 로 회원번호를 받아 우리 계정 세션을 만든다.
 *    세션은 60초짜리 일회용 코드로만 보관하고 앱 주소(ppobgong://auth/kakao?code=...)로 돌려보낸다.
 * 4) 앱: POST /auth/kakao/exchange {code, verifier} → 세션(accessToken, refreshToken)
 *    verifier가 맞아야 하므로, 다른 앱이 ppobgong:// 주소를 가로채도 세션을 못 가져간다.
 *
 * 카카오 키(REST API 키, Client Secret)는 서버 환경변수에만 둔다. 앱에는 넣지 않는다.
 */
const KAUTH = 'https://kauth.kakao.com', KAPI = 'https://kapi.kakao.com';
export const KAKAO_APP_REDIRECT = 'ppobgong://auth/kakao';
const b64url = buf => Buffer.from(buf).toString('base64url');
export const challengeOf = verifier => b64url(createHash('sha256').update(verifier).digest());

export function kakaoRoutes(auth, {
  restKey = process.env.KAKAO_REST_API_KEY,
  clientSecret = process.env.KAKAO_CLIENT_SECRET,
  redirectUri = process.env.KAKAO_REDIRECT_URI,
  secret = process.env.JWT_SECRET,
  appRedirect = KAKAO_APP_REDIRECT,
  fetcher = fetch,
  codeSeconds = 60,
  limits = { start: 30, callback: 30, exchange: 30 },
} = {}) {
  if (!restKey || !redirectUri) return null; // 키가 없으면 카카오 로그인을 켜지 않음
  const key = new TextEncoder().encode(`kakao-state:${secret}`);
  /** 일회용 코드 → {session, challenge, until}. 서버 한 대 기준이라 메모리에 둔다 (재시작되면 진행 중이던 로그인만 다시 하면 됨) */
  const codes = new Map();
  const hits = new Map();

  const redirect = (send, url) => send(302, undefined, { Location: url, 'Cache-Control': 'no-store' });
  const back = (send, params) => redirect(send, `${appRedirect}?${new URLSearchParams(params)}`);
  const sweep = now => {
    for (const [k, v] of codes) if (v.until <= now) codes.delete(k);
    for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
  };
  const limited = (req, route, now) => {
    const k = `${req.socket.remoteAddress}:${route}`;
    const hit = hits.get(k) ?? { until: now + 60000, count: 0 };
    hit.count++; hits.set(k, hit);
    return hits.size > 10000 || hit.count > (limits[route] ?? 30);
  };

  async function kakaoUser(code) {
    const form = new URLSearchParams({ grant_type: 'authorization_code', client_id: restKey, redirect_uri: redirectUri, code });
    if (clientSecret) form.set('client_secret', clientSecret);
    const tokenRes = await fetcher(`${KAUTH}/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form,
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenRes.ok) throw new AuthError('kakao_failed', 502);
    const token = await tokenRes.json();
    if (typeof token?.access_token !== 'string') throw new AuthError('kakao_failed', 502);
    const meRes = await fetcher(`${KAPI}/v2/user/me`, {
      headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000),
    });
    if (!meRes.ok) throw new AuthError('kakao_failed', 502);
    const me = await meRes.json();
    const id = me?.id;
    if (!(typeof id === 'number' && Number.isSafeInteger(id) && id > 0) && !(typeof id === 'string' && /^[0-9]{1,20}$/.test(id))) throw new AuthError('kakao_failed', 502);
    const account = me.kakao_account ?? {};
    // 카카오가 확인한 이메일만 쓴다
    const email = account.is_email_valid && account.is_email_verified && typeof account.email === 'string' ? account.email : null;
    return { subject: String(id), email };
  }

  return async (req, pathname, send) => {
    const match = /^\/auth\/kakao\/(start|callback|exchange)$/.exec(pathname);
    if (!match) return false;
    const route = match[1], now = Date.now();
    sweep(now);
    if (req.method !== (route === 'exchange' ? 'POST' : 'GET')) { send(405, { error: 'method_not_allowed' }); return true; }
    if (limited(req, route, now)) {
      if (route === 'callback') back(send, { error: 'rate_limited' }); else send(429, { error: 'rate_limited' });
      return true;
    }
    const query = new URL(req.url, 'http://local').searchParams;

    if (route === 'start') {
      const challenge = query.get('challenge') ?? '';
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) { send(400, { error: 'bad_request' }); return true; }
      const state = await new SignJWT({ c: challenge, n: b64url(randomBytes(12)) })
        .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(key);
      const url = new URL(`${KAUTH}/oauth/authorize`);
      url.search = new URLSearchParams({ client_id: restKey, redirect_uri: redirectUri, response_type: 'code', state }).toString();
      redirect(send, url.toString());
      return true;
    }

    if (route === 'callback') {
      // 사용자가 취소하면 카카오가 error=access_denied 로 돌려보냄
      if (query.get('error')) { back(send, { error: query.get('error') === 'access_denied' ? 'cancelled' : 'kakao_failed' }); return true; }
      let challenge;
      try { ({ payload: { c: challenge } } = await jwtVerify(query.get('state') ?? '', key, { algorithms: ['HS256'] })); }
      catch { back(send, { error: 'expired' }); return true; }
      const code = query.get('code');
      if (typeof challenge !== 'string' || !code || code.length > 512) { back(send, { error: 'bad_request' }); return true; }
      try {
        const session = await auth.kakaoLogin(await kakaoUser(code));
        const once = b64url(randomBytes(32));
        codes.set(once, { session, challenge, until: now + codeSeconds * 1000 });
        back(send, { code: once });
      } catch (error) {
        if (!(error instanceof AuthError)) console.error('Kakao login failed: ' + (error?.message ?? error));
        back(send, { error: error instanceof AuthError ? error.code : 'server_error' });
      }
      return true;
    }

    // exchange
    const reply = (status, data) => send(status, data, { 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    try {
      const body = await readJsonBody(req, { maxBytes: 1024 });
      const entry = typeof body.code === 'string' ? codes.get(body.code) : undefined;
      if (!entry || typeof body.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(body.verifier)) throw new AuthError('unauthorized', 401);
      codes.delete(body.code); // 한 번 시도하면 버림 (맞든 틀리든)
      if (entry.until <= now || challengeOf(body.verifier) !== entry.challenge) throw new AuthError('unauthorized', 401);
      reply(200, entry.session);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      reply(error.status, { error: error.code });
    }
    return true;
  };
}
