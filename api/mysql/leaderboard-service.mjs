import {rewardSql} from './reward-eligibility.mjs';
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
/** 앱(src/lib/rank.ts)과 같은 규칙: 레벨 n→n+1에 50+10(n-1) XP, 최대 100레벨 */
export function levelOf(totalXp) {
  let level = 1, floor = 0;
  while (level < 100 && totalXp >= floor + 50 + 10 * (level - 1)) { floor += 50 + 10 * (level - 1); level++; }
  return level;
}
/** 앱과 같은 분야 랭크 기준: 브론즈 0 · 실버 30 · 골드 100 · 플래티넘 250 · 다이아 500 · 엔지니어 1000점(+서로 다른 주제 30개) */
export const DOMAIN_TIER_MIN = [0, 30, 100, 250, 500, 1000];
export function domainTier(points, topics) {
  let i = 0;
  while (i + 1 < DOMAIN_TIER_MIN.length && points >= DOMAIN_TIER_MIN[i + 1]) i++;
  if (i === DOMAIN_TIER_MIN.length - 1 && topics < 30) i--;
  return i;
}
/** 이번 주 월요일 0시(한국 시간)를 DB 시각(UTC) 문자열로 */
export function weekStartUtc(nowMs) {
  const kst = new Date(nowMs + 9 * 3600e3);
  const back = (kst.getUTCDay() + 6) % 7;
  const start = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - back) - 9 * 3600e3;
  return new Date(start).toISOString().slice(0, 23).replace('T', ' ');
}
export const RANKING_KINDS = ['weekly', 'level', 'tier'];

export function createLeaderboardService({ auth, connectionFactory = connect, now = () => Date.now() }) {
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
             JOIN quiz_attempts a ON a.id=s.attempt_id
             JOIN users u ON u.id=s.user_id AND u.status='active'
             LEFT JOIN profiles p ON p.user_id=s.user_id
             LEFT JOIN social_members m ON m.user_id=s.user_id
             LEFT JOIN (SELECT target_id, COUNT(*) AS n FROM nickname_reports GROUP BY target_id) rc ON rc.target_id=s.user_id
             WHERE s.domain=? AND ${rewardSql('leaderboard','s')} AND (COALESCE(p.leaderboard_hidden,0)=0 OR s.user_id=?)
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
    /**
     * 전체 랭킹 세 가지 (분야 상관없음)
     * - weekly: 이번 주(월요일 0시, 한국 시간부터) 얻은 XP
     * - level: 누적 XP → 레벨
     * - tier: 공부한 분야 중 가장 높은 분야 랭크(같으면 그 분야 점수)
     * 숨기기 · 신고 가림은 분야별 랭킹과 같음. 점수 0인 사람은 빼고, 같은 점수는 같은 순위(RANK).
     */
    async ranking(header, kind, params) {
      const claims = await auth.verifyAccess(header);
      if (!RANKING_KINDS.includes(kind)) throw new AuthError('not_found', 404);
      const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? 50) || 50));
      const since = weekStartUtc(now());
      const db = await connectionFactory();
      try {
        const people = `FROM users u
             LEFT JOIN profiles p ON p.user_id=u.id
             LEFT JOIN social_members m ON m.user_id=u.id
             LEFT JOIN (SELECT target_id, COUNT(*) AS n FROM nickname_reports GROUP BY target_id) rc ON rc.target_id=u.id
             WHERE u.status='active' AND (COALESCE(p.leaderboard_hidden,0)=0 OR u.id=?)`;
        const name = `CASE WHEN COALESCE(rc.n,0)>=${REPORT_MASK} THEN '학습자' ELSE COALESCE(p.nickname,'학습자') END AS nickname, m.friend_code AS uid`;
        let scored;
        if (kind === 'tier') {
          const [users] = await db.execute(`SELECT u.id AS user_id, ${name} ${people}`, [claims.sub]);
          const [doms] = await db.execute(
            `SELECT s.user_id, s.domain,
               SUM(LEAST(COALESCE(s.rank_score,s.score), IF(s.study_type='battle',5,s.quiz_total))) AS points,
               COUNT(DISTINCT s.topic_id) AS topics
             FROM study_records s JOIN quiz_attempts a ON a.id=s.attempt_id
             WHERE ${rewardSql('rank', 's')}
             GROUP BY s.user_id, s.domain`, []);
          const best = new Map();
          for (const d of doms) {
            const points = Number(d.points), tier = domainTier(points, Number(d.topics));
            const b = best.get(d.user_id);
            if (!b || tier > b.tier || (tier === b.tier && points > b.value)) best.set(d.user_id, { tier, value: points, domain: d.domain });
          }
          scored = users.filter((u) => best.has(u.user_id)).map((u) => ({ ...u, ...best.get(u.user_id) }))
            .sort((a, b) => b.tier - a.tier || b.value - a.value);
        } else {
          const w = kind === 'weekly';
          const [rows] = await db.execute(
            `SELECT u.id AS user_id, ${name},
               (SELECT COALESCE(SUM(x.amount),0) FROM xp_ledger x WHERE x.user_id=u.id${w ? ' AND x.created_at>=?' : ''})
               + (SELECT COALESCE(SUM(r.awarded_xp),0) FROM speed_runs r WHERE r.user_id=u.id AND r.status='completed'${w ? ' AND r.completed_at>=?' : ''})
               + (SELECT COALESCE(SUM(b.reward_xp),0) FROM boss_runs b WHERE b.user_id=u.id AND b.status='cleared'${w ? ' AND b.finished_at>=?' : ''})
               + (SELECT COALESCE(SUM(tr.reward_xp),0) FROM study_team_rewards tr WHERE tr.user_id=u.id${w ? ' AND tr.created_at>=?' : ''}) AS xp
             ${people}`, w ? [since, since, since, since, claims.sub] : [claims.sub]);
          scored = rows.map((r) => ({ ...r, value: Math.max(0, Number(r.xp)) })).filter((r) => r.value > 0)
            .sort((a, b) => b.value - a.value);
        }
        // 같은 점수(tier는 랭크+점수)면 같은 순위
        let prev = null, rank = 0;
        const ranked = scored.map((r, i) => {
          const key = kind === 'tier' ? `${r.tier}:${r.value}` : String(r.value);
          if (key !== prev) { rank = i + 1; prev = key; }
          const me = r.user_id === claims.sub;
          const e = { rank, nickname: r.nickname, value: r.value, me, uid: me ? null : r.uid ?? null };
          if (kind === 'level') e.level = levelOf(r.value);
          if (kind === 'tier') { e.tier = r.tier; e.domain = r.domain; }
          return e;
        });
        const mine = ranked.find((e) => e.me) ?? null;
        return { kind, since: kind === 'weekly' ? since.replace(' ', 'T') + 'Z' : null, entries: ranked.filter((e) => e.rank <= limit), me: mine };
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
