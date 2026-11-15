import { connect } from '../server/db.mjs';
import { AuthError } from '../server/auth.mjs';

/**
 * 분야별(domain) 전체 유저 랭킹. study_records.rp(그 기록으로 얻은 XP, 서버가 계산해 저장한 값)를
 * 유저별로 합산해 순위를 매긴다. 새 집계 테이블 없이 기존 study_records를 그대로 집계한다 —
 * 유저 수가 적은 캡스톤 규모라 매 요청 집계로도 충분하고, 중복 유지해야 할 상태가 늘지 않는다.
 */
export function createLeaderboardService({ auth, connectionFactory = connect }) {
  return {
    async top(header, domainId, params) {
      const claims = await auth.verifyAccess(header);
      if (typeof domainId !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(domainId)) throw new AuthError('not_found', 404);
      const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? 50) || 50));
      const db = await connectionFactory();
      try {
        const [[d]] = await db.execute('SELECT id FROM domains WHERE id=? AND is_active=1', [domainId]);
        if (!d) throw new AuthError('not_found', 404);
        const [rows] = await db.execute(
          `SELECT user_id, nickname, xp, rnk FROM (
             SELECT s.user_id, COALESCE(p.nickname,'학습자') AS nickname, SUM(s.rp) AS xp,
               RANK() OVER (ORDER BY SUM(s.rp) DESC) AS rnk
             FROM study_records s
             JOIN users u ON u.id=s.user_id AND u.status='active'
             LEFT JOIN profiles p ON p.user_id=s.user_id
             WHERE s.domain=?
             GROUP BY s.user_id, p.nickname
           ) ranked WHERE rnk<=? OR user_id=? ORDER BY rnk`,
          [domainId, limit, claims.sub],
        );
        const mine = rows.find((r) => r.user_id === claims.sub) ?? null;
        return {
          domain: domainId,
          entries: rows.filter((r) => r.rnk <= limit).map((r) => ({ rank: Number(r.rnk), nickname: r.nickname, xp: Number(r.xp), me: r.user_id === claims.sub })),
          me: mine ? { rank: Number(mine.rnk), xp: Number(mine.xp) } : null,
        };
      } finally { await db.end(); }
    },
  };
}
