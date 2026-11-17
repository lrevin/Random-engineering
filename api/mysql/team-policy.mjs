// 스터디 팀 규칙. 숫자는 앱 app/src/lib/team.ts 와 같아야 함(서버 테스트가 비교).
/** 팀 인원: 2~4명 (주제는 상관없음) */
export const TEAM_MIN = 2;
export const TEAM_MAX = 4;
/** 'open' = 친구와 들어가고 빈자리는 다른 사람이 채움 · 'friends' = 친구끼리만 */
export const TEAM_MODES = ['open', 'friends'];
/** 주간 목표: 팀원 한 명당 이번 주(월~일, 한국 시간) XP 150 → 팀 전체 합으로 채움 */
export const TEAM_GOAL_PER_MEMBER = 150;
/** 목표를 채우면 이번 주에 XP를 1 이상 얻은 팀원마다 한 번 */
/** 보상을 받으려면 팀에 들어온 뒤 이번 주에 이만큼은 보태야 함 (다 찬 팀에 늦게 들어와 XP 1로 받아 가는 것 방지) */
export const TEAM_MIN_CONTRIBUTION = 50;
export const TEAM_REWARD = { gears: 40, xp: 60 };

export const teamGoal = (count) => TEAM_GOAL_PER_MEMBER * Math.max(count, TEAM_MIN);

/** 팀 진행: 2명 이상이고 팀원 XP 합이 목표 이상이면 달성 */
export function teamProgress(members) {
  const count = members.length, total = members.reduce((a, m) => a + Math.max(0, Number(m.weekXp) || 0), 0), goal = teamGoal(count);
  return { count, total, goal, active: count >= TEAM_MIN, done: count >= TEAM_MIN && total >= goal };
}

/** 이 사람이 이번 주 보상을 받을 수 있는지: 목표 달성 · 팀에 들어온 뒤 이번 주 XP TEAM_MIN_CONTRIBUTION 이상 · 아직 안 받음 */
export const canClaimTeam = (progress, me, claimed) => progress.done && Number(me?.weekXp) >= TEAM_MIN_CONTRIBUTION && !claimed;

/** 들어갈 팀 고르기: 모르는 사람을 받는 팀('open') 중 우리 인원이 다 들어가는 팀을 무작위로, 없으면 null(새 팀) */
export function pickTeam(open, size, randomInt) {
  const fit = open.filter((t) => Number(t.member_count) + size <= TEAM_MAX);
  return fit.length ? fit[randomInt(fit.length)] : null;
}

/** 이번 주 월요일(한국 시간) 날짜 'YYYY-MM-DD' */
export function weekStartKst(now) {
  const kst = new Date(now.getTime() + 9 * 3600e3);
  kst.setUTCDate(kst.getUTCDate() - ((kst.getUTCDay() + 6) % 7));
  return kst.toISOString().slice(0, 10);
}
