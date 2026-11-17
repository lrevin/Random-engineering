import { AuthError } from '../server/auth.mjs';
import { readJsonBody } from '../server/auth-http.mjs';
import { rateKey, overLimit } from '../server/client-key.mjs';

export function progressRoutes(service) {
  const hits = new Map();
  return async (req, pathname, send) => {
    const m = /^\/me\/progress(?:\/([A-Za-z]{1,32}))?$/.exec(pathname);
    if (!m) return false;
    const reply = (status, data) => send(status, data, { 'Cache-Control': 'no-store' });
    const now = Date.now(), key = rateKey(req);
    if (overLimit(hits, key, 60, now)) { reply(429, { error: 'rate_limited' }); return true; }
    try {
      if (!m[1] && req.method === 'GET') reply(200, await service.list(req.headers.authorization));
      else if (m[1] && req.method === 'PUT') reply(200, await service.save(req.headers.authorization, m[1], await readJsonBody(req, { maxBytes: 300 * 1024 })));
      else reply(405, { error: 'method_not_allowed' });
    } catch (e) { if (!(e instanceof AuthError)) throw e; reply(e.status, { error: e.code }); }
    return true;
  };
}
