// 예약 푸시 알림 (API 서버가 10분마다 tick, GET_LOCK 으로 서버가 여러 대여도 한 번만)
// - 주간 공부 리포트: 일요일 19~22시(한국 시간), 알림을 켠 회원에게 "이번 주 n분 · XP · 지난주 대비" (주 1번)
// - 스터디 팀 응원: 토 · 일 18~22시, 주간 목표를 절반 이상 채웠지만 아직 못 채운 팀의 팀원에게 "n XP 남았어요" (팀마다 주 1번)
// 같은 알림을 두 번 보내지 않게 notification_log(kind, ref, period)에 먼저 기록하고 보냄
import { connect } from '../server/db.mjs';
import { weekStartKst, teamProgress } from './team-policy.mjs';
import { WEEK_XP_SQL } from './team-service.mjs';

const kstParts = (d) => { const k = new Date(d.getTime() + 9 * 3600e3); return { dow: k.getUTCDay(), hour: k.getUTCHours() }; };
/** 한국 월요일 0시 (UTC) */
const weekSince = (week) => new Date(new Date(week + 'T00:00:00Z').getTime() - 9 * 3600e3);

export function createNotifier({ push, connectionFactory = connect, now = () => new Date(), log = console.error, limit = 300 } = {}) {
  async function claim(db, kind, ref, period, userId) {
    const [r] = await db.execute('INSERT IGNORE INTO notification_log(kind,ref,period,user_id) VALUES (?,?,?,?)', [kind, ref, period, userId ?? null]);
    return r.affectedRows > 0;
  }
  async function weeklyReports(db) {
    const week = weekStartKst(now()), since = weekSince(week), before = new Date(since.getTime() - 7 * 86400e3);
    const [users] = await db.execute(`SELECT DISTINCT p.user_id FROM push_tokens t JOIN profiles p ON p.user_id=t.user_id AND p.reminder_enabled=1
      JOIN users u ON u.id=p.user_id AND u.status='active'
      WHERE NOT EXISTS(SELECT 1 FROM notification_log l WHERE l.kind='weekly' AND l.ref=p.user_id AND l.period=?) LIMIT ${Number(limit)}`, [week]);
    let sent = 0;
    for (const { user_id: id } of users) {
      const [[s]] = await db.execute(`SELECT
        (SELECT COALESCE(SUM(study_sec),0) FROM study_records WHERE user_id=? AND studied_at>=?) AS sec,
        (SELECT COALESCE(SUM(study_sec),0) FROM study_records WHERE user_id=? AND studied_at>=? AND studied_at<?) AS lastSec,
        (SELECT COALESCE(SUM(amount),0) FROM xp_ledger WHERE user_id=? AND created_at>=?)+(SELECT COALESCE(SUM(awarded_xp),0) FROM speed_runs WHERE user_id=? AND status='completed' AND completed_at>=?) AS xp`,
        [id, since, id, before, since, id, since, id, since]);
      if (!(await claim(db, 'weekly', id, week, id))) continue;
      const min = Math.round(Number(s.sec) / 60), diff = min - Math.round(Number(s.lastSec) / 60), xp = Math.max(0, Number(s.xp));
      const body = min || xp
        ? `이번 주 ${min}분 공부하고 ${xp} XP를 얻었어요. 지난주보다 ${diff >= 0 ? '+' : ''}${diff}분이에요.`
        : '이번 주는 아직 공부 기록이 없어요. 오늘 주제 하나 뽑아 볼까요?';
      sent += (await push.send(id, { title: '이번 주 공부 리포트', body, data: { type: 'weekly_report' }, channelId: 'reminders' })) > 0 ? 1 : 0;
    }
    return sent;
  }
  async function teamNudges(db) {
    const week = weekStartKst(now()), since = weekSince(week);
    const [teams] = await db.execute(`SELECT t.id FROM study_teams t WHERE t.member_count>=2
      AND NOT EXISTS(SELECT 1 FROM notification_log l WHERE l.kind='team' AND l.ref=t.id AND l.period=?) LIMIT ${Number(limit)}`, [week]);
    let sent = 0;
    for (const { id } of teams) {
      const [members] = await db.execute(`SELECT m.user_id,${WEEK_XP_SQL} AS week_xp FROM study_team_members m JOIN users u ON u.id=m.user_id AND u.status='active' WHERE m.team_id=?`, [since, since, since, id]);
      const p = teamProgress(members.map((r) => ({ weekXp: Number(r.week_xp) })));
      if (!p.active || p.done || p.total < p.goal / 2) continue;
      if (!(await claim(db, 'team', id, week, null))) continue;
      for (const m of members) sent += (await push.send(m.user_id, { title: '스터디 팀 주간 목표', body: `팀 목표까지 ${p.goal - p.total} XP 남았어요! 일요일 자정 전에 같이 채워 봐요.`, data: { type: 'team_nudge' }, channelId: 'reminders' })) > 0 ? 1 : 0;
    }
    return sent;
  }
  return {
    /** 지금 보낼 예약 알림을 보냄. 반환: 보낸 수 */
    async tick() {
      if (!push) return 0;
      const db = await connectionFactory();
      try {
        const [[lock]] = await db.query("SELECT GET_LOCK(SHA2(CONCAT(DATABASE(),':notifier'),256),0) AS ok");
        if (Number(lock.ok) !== 1) return 0;
        try {
          const { dow, hour } = kstParts(now());
          let sent = 0;
          if (dow === 0 && hour >= 19 && hour < 22) sent += await weeklyReports(db);
          if ((dow === 6 || dow === 0) && hour >= 18 && hour < 22) sent += await teamNudges(db);
          return sent;
        } finally { await db.query("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(),':notifier'),256))").catch(() => {}); }
      } catch (e) { log('Notifier: ' + (e?.code ?? e?.message ?? e)); return 0; }
      finally { await db.end(); }
    },
    weeklyReports: () => connectionFactory().then(async (db) => { try { return await weeklyReports(db); } finally { await db.end(); } }),
    teamNudges: () => connectionFactory().then(async (db) => { try { return await teamNudges(db); } finally { await db.end(); } }),
  };
}
