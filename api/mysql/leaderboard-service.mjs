import { connect, transaction } from '../server/db.mjs';
import { AuthError } from '../server/auth.mjs';

/** 서로 다른 사용자 몇 명이 신고하면 랭킹에서 닉네임을 가리는지 */
export const REPORT_MASK = 3;
const REASONS = ['offensive', 'spam', 'other'];

/**
 * 분야별(domain) 전체 유저 랭킹. study_records.rp(그 기록으로 얻은 XP, 서버가 계산해 저장한 값)를
 * 유저별로 합산해 순위를 매긴다. 새 집계 테이블 없이 기존 study_records를 그대로 집계한다 —
 * 유저 수가 적은 캡스톤 규모라 매 요청 집계로도 충분하고, 중복 유지해야 할 상태가 늘지 않는다.
 * 랭킹 숨기기를 켠 사람은 다른 사람에게 안 보이고(본인은 자기 순위를 봄), 신고가 REPORT_MASK명 이상이면 닉네임을 가린다.
 */
export function createLeaderboardService({ auth, connectionFactory = connect }) {
  async function withUser(header, action) {
    const claims = await auth.verifyAccess(header);
    const db = await connectionFactory();
    try {
      return await transaction(db, async () => {
        const [[u]] = await db.execute('SELECT id,status,auth_version FROM users WHERE id=?', [claims.sub]);
        if (!u || u.status !== 'active' || u.auth_version !== claims.av) throw new AuthError('unauthorized', 401);
        return action(db, u.id);
      });
    } finally { await db.end(); }
  }
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
          `SELECT user_id, nickname, uid, xp, rnk FROM (
             SELECT s.user_id,
               CASE WHEN COALESCE(rc.n,0)>=${REPORT_MASK} THEN '학습자' ELSE COALESCE(p.nickname,'학습자') END AS nickname,
               m.friend_code AS uid, SUM(s.rp) AS xp,
               RANK() OVER (ORDER BY SUM(s.rp) DESC) AS rnk
             FROM study_records s
             JOIN users u ON u.id=s.user_id AND u.status='active'
             LEFT JOIN profiles p ON p.user_id=s.user_id
             LEFT JOIN social_members m ON m.user_id=s.user_id
             LEFT JOIN (SELECT target_id, COUNT(*) AS n FROM nickname_reports GROUP BY target_id) rc ON rc.target_id=s.user_id
             WHERE s.domain=? AND (COALESCE(p.leaderboard_hidden,0)=0 OR s.user_id=?)
             GROUP BY s.user_id, p.nickname, m.friend_code, rc.n
           ) ranked WHERE rnk<=? OR user_id=? ORDER BY rnk`,
          [domainId, claims.sub, limit, claims.sub],
        );
        const mine = rows.find((r) => r.user_id === claims.sub) ?? null;
        return {
          domain: domainId,
          entries: rows.filter((r) => r.rnk <= limit).map((r) => {
            const me = r.user_id === claims.sub;
            return { rank: Number(r.rnk), nickname: r.nickname, xp: Number(r.xp), me, uid: me ? null : r.uid ?? null };
          }),
          me: mine ? { rank: Number(mine.rnk), xp: Number(mine.xp) } : null,
        };
      } finally { await db.end(); }
    },
    getSettings: (header) => withUser(header, async (db, id) => {
      const [[p]] = await db.execute('SELECT leaderboard_hidden FROM profiles WHERE user_id=?', [id]);
      return { hidden: !!Number(p?.leaderboard_hidden ?? 0) };
    }),
    setSettings: async (header, body) => {
      if (typeof body?.hidden !== 'boolean') throw new AuthError('invalid_settings');
      return withUser(header, async (db, id) => {
        const [r] = await db.execute('UPDATE profiles SET leaderboard_hidden=? WHERE user_id=?', [body.hidden, id]);
        if (!r.affectedRows) throw new AuthError('not_found', 404);
        return { hidden: body.hidden };
      });
    },
    report: async (header, body) => {
      const uid = String(body?.uid ?? '').toUpperCase();
      const reason = body?.reason ?? 'offensive';
      if (!/^[A-Z2-9]{8}$/.test(uid) || !REASONS.includes(reason)) throw new AuthError('invalid_report');
      return withUser(header, async (db, id) => {
        const [[t]] = await db.execute("SELECT m.user_id FROM social_members m JOIN users u ON u.id=m.user_id AND u.status='active' WHERE m.friend_code=?", [uid]);
        if (!t) throw new AuthError('not_found', 404);
        if (t.user_id === id) throw new AuthError('self', 400);
        await db.execute('INSERT IGNORE INTO nickname_reports(reporter_id,target_id,reason) VALUES (?,?,?)', [id, t.user_id, reason]);
        return { ok: true };
      });
    },
  };
}
