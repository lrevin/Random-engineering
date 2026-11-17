import { AuthError } from '../server/auth.mjs';
import { readJsonBody } from '../server/auth-http.mjs';
import { rateKey, overLimit } from '../server/client-key.mjs';

export function leaderboardRoutes(service) {
  const hits = new Map();
  return async (req, pathname, send) => {
    const board = /^\/leaderboard\/([a-z0-9_-]{1,32})$/.exec(pathname);
    const ranking = /^\/rankings\/(weekly|level|tier)$/.exec(pathname);
    const settings = pathname === '/leaderboard-settings';
    const report = pathname === '/leaderboard-reports';
    if (!board && !ranking && !settings && !report) return false;
    const reply = (status, data) => send(status, data, { 'Cache-Control': 'no-store' });
    const now = Date.now(), key = rateKey(req);
    if (overLimit(hits, key, 60, now)) { reply(429, { error: 'rate_limited' }); return true; }
    try {
      const auth = req.headers.authorization;
      if (board && req.method === 'GET') reply(200, await service.top(auth, board[1], new URL(req.url, 'http://local').searchParams));
      else if (ranking && req.method === 'GET') reply(200, await service.ranking(auth, ranking[1], new URL(req.url, 'http://local').searchParams));
      else if (settings && req.method === 'GET') reply(200, await service.getSettings(auth));
      else if (settings && req.method === 'PUT') reply(200, await service.setSettings(auth, await readJsonBody(req)));
      else if (report && req.method === 'POST') reply(200, await service.report(auth, await readJsonBody(req)));
      else reply(405, { error: 'method_not_allowed' });
    } catch (e) { if (!(e instanceof AuthError)) throw e; reply(e.status, { error: e.code }); }
    return true;
  };
}
