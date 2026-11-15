import { AuthError } from '../server/auth.mjs';

export function leaderboardRoutes(service) {
  const hits = new Map();
  return async (req, pathname, send) => {
    const m = /^\/leaderboard\/([a-z0-9_-]{1,32})$/.exec(pathname);
    if (!m || req.method !== 'GET') return false;
    const reply = (status, data) => send(status, data, { 'Cache-Control': 'no-store' });
    const now = Date.now(), key = req.socket.remoteAddress;
    for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
    const hit = hits.get(key) ?? { until: now + 60000, n: 0 };
    if (hits.size >= 10000 && !hits.has(key)) { reply(429, { error: 'rate_limited' }); return true; }
    hits.set(key, hit);
    if (++hit.n > 60) { reply(429, { error: 'rate_limited' }); return true; }
    try {
      const url = new URL(req.url, 'http://local');
      reply(200, await service.top(req.headers.authorization, m[1], url.searchParams));
    } catch (e) { if (!(e instanceof AuthError)) throw e; reply(e.status, { error: e.code }); }
    return true;
  };
}
