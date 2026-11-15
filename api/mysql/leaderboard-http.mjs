import { AuthError } from '../server/auth.mjs';
import { readJsonBody } from '../server/auth-http.mjs';
import { rateKey } from '../server/client-key.mjs';

export function leaderboardRoutes(service) {
  const hits = new Map();
  return async (req, pathname, send) => {
    const board = /^\/leaderboard\/([a-z0-9_-]{1,32})$/.exec(pathname);
    const settings = pathname === '/leaderboard-settings';
    const report = pathname === '/leaderboard-reports';
    if (!board && !settings && !report) return false;
    const reply = (status, data) => send(status, data, { 'Cache-Control': 'no-store' });
    const now = Date.now(), key = rateKey(req);
    for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
    const hit = hits.get(key) ?? { until: now + 60000, n: 0 };
    if (hits.size >= 10000 && !hits.has(key)) { reply(429, { error: 'rate_limited' }); return true; }
    hits.set(key, hit);
    if (++hit.n > 60) { reply(429, { error: 'rate_limited' }); return true; }
    try {
      const auth = req.headers.authorization;
      if (board && req.method === 'GET') reply(200, await service.top(auth, board[1], new URL(req.url, 'http://local').searchParams));
      else if (settings && req.method === 'GET') reply(200, await service.getSettings(auth));
      else if (settings && req.method === 'PUT') reply(200, await service.setSettings(auth, await readJsonBody(req)));
      else if (report && req.method === 'POST') reply(200, await service.report(auth, await readJsonBody(req)));
      else reply(405, { error: 'method_not_allowed' });
    } catch (e) { if (!(e instanceof AuthError)) throw e; reply(e.status, { error: e.code }); }
    return true;
  };
}
