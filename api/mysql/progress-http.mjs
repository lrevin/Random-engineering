import { AuthError } from '../server/auth.mjs';
import { readJsonBody } from '../server/auth-http.mjs';
import { rateKey } from '../server/client-key.mjs';

export function progressRoutes(service) {
  const hits = new Map();
  return async (req, pathname, send) => {
    const m = /^\/me\/progress(?:\/([A-Za-z]{1,32}))?$/.exec(pathname);
    if (!m) return false;
    const reply = (status, data) => send(status, data, { 'Cache-Control': 'no-store' });
    const now = Date.now(), key = rateKey(req);
    for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
    const hit = hits.get(key) ?? { until: now + 60000, n: 0 };
    if (hits.size >= 10000 && !hits.has(key)) { reply(429, { error: 'rate_limited' }); return true; }
    hits.set(key, hit);
    if (++hit.n > 60) { reply(429, { error: 'rate_limited' }); return true; }
    try {
      if (!m[1] && req.method === 'GET') reply(200, await service.list(req.headers.authorization));
      else if (m[1] && req.method === 'PUT') reply(200, await service.save(req.headers.authorization, m[1], await readJsonBody(req, { maxBytes: 300 * 1024 })));
      else reply(405, { error: 'method_not_allowed' });
    } catch (e) { if (!(e instanceof AuthError)) throw e; reply(e.status, { error: e.code }); }
    return true;
  };
}
