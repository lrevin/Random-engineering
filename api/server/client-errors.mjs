import { readJsonBody } from './auth-http.mjs';
import { clientIp } from './client-key.mjs';

/**
 * 앱 화면이 오류로 멈췄을 때 앱이 보내는 오류 내용을 서버 로그에 한 줄로 남김 (DB 저장 없음).
 * 로그인 없이도 받지만 주소별로 분당 20건까지만, 길이도 잘라서 남김. 개인정보는 앱에서 보내지 않음.
 */
export function clientErrorRoutes({ log = console.error } = {}) {
  const hits = new Map();
  return async (req, pathname, send) => {
    if (pathname !== '/client-errors') return false;
    if (req.method !== 'POST') { send(405, { error: 'method_not_allowed' }); return true; }
    const now = Date.now(), key = clientIp(req);
    for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
    const hit = hits.get(key) ?? { until: now + 60000, n: 0 };
    if (hits.size >= 10000 && !hits.has(key)) { send(429, { error: 'rate_limited' }); return true; }
    hits.set(key, hit);
    if (++hit.n > 20) { send(429, { error: 'rate_limited' }); return true; }
    let body;
    try { body = await readJsonBody(req, { maxBytes: 8192 }); } catch { send(400, { error: 'bad_request' }); return true; }
    const clean = (v, n) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, n);
    log(`[client-error] ${clean(body.where, 40)} | ${clean(body.message, 300)} | ${clean(body.stack, 600)} | ${clean(body.version, 20)} ${clean(body.platform, 10)}`);
    send(204);
    return true;
  };
}
