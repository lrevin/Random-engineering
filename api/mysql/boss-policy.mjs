// 오답 보스전 규칙. 숫자는 앱 app/src/lib/boss.ts 와 같아야 함(서버 테스트가 비교).
/** 한 판 = 50문제: 내 관심 분야를 고른 사람들이 자주 · 많이 틀린 문제부터, 모자라면 그 분야 문제 은행에서 채움 */
export const BOSS_QUESTIONS = 50;
/** 30번 맞히면 보스 처치 (한 번 맞힐 때마다 보스 체력 -10, 체력 300) */
export const CLEAR_HITS = 30;
export const BOSS_HIT = 10;
export const BOSS_MAX_HP = CLEAR_HITS * BOSS_HIT;
/** 내 체력 100, 틀릴 때마다 -5 → 20번 틀리면 실패 */
export const PLAYER_HP = 100;
export const PLAYER_HIT = 5;
/** 한 주(월~일, 한국 시간)에 한 판 */
export const BOSS_RUNS_PER_WEEK = 1;
/** 집계 기간: 최근 60일 오답 */
export const POOL_DAYS = 60;
/** 클리어 전용 테마와 확률 (1/10000 = 0.01%) */
export const BOSS_THEME = 'eclipse';
export const BOSS_THEME_ODDS = 10000;

/** 남은 체력이 많을수록 보상이 큼: 100 → 톱니바퀴 100 · 200 XP, 50 → 70 · 140, 5 → 43 · 86 */
export function bossReward(hp) {
  if (!(hp > 0)) return { gears: 0, xp: 0 };
  const k = Math.min(hp, PLAYER_HP) / PLAYER_HP;
  return { gears: Math.round(40 + 60 * k), xp: Math.round(80 + 120 * k) };
}

/** 0.01% 추첨: randomInt(n) 은 0 이상 n 미만 정수 */
export const rollBossTheme = (randomInt) => randomInt(BOSS_THEME_ODDS) === 0;

/** 저장된 문제 모양(quiz_attempt_items.question_snapshot) → 보스 문제 (4지선다 · O/X만) */
export function bossQuestion(s) {
  if (!s || typeof s.q !== 'string' || !s.q.trim()) return null;
  if (s.type === 'mc' && Array.isArray(s.choices) && s.choices.length === 4 && Number.isInteger(s.answer) && s.answer >= 0 && s.answer < 4)
    return { q: s.q, choices: s.choices.map(String), answer: s.answer, explain: String(s.explain ?? '') };
  if (s.type === 'ox' && typeof s.answer === 'boolean')
    return { q: s.q, choices: ['O (맞다)', 'X (틀리다)'], answer: s.answer ? 0 : 1, explain: String(s.explain ?? '') };
  return null;
}

/**
 * 보스 문제 50개: hot(많이 틀린 순, {snapshot, topic, wrong, rate}) 먼저, 모자라면 fill(문제 은행, 무작위)로 채움.
 * 같은 문제는 한 번만. 순서는 섞어서 냄 (어느 문제가 몇 명에게 틀렸는지는 wrong으로 화면에 보여 줌)
 */
export function buildBoss(hot, fill, randomInt) {
  const seen = new Set(), list = [];
  const add = (item, wrong) => {
    const q = bossQuestion(item.snapshot);
    if (!q || seen.has(q.q) || list.length >= BOSS_QUESTIONS) return;
    seen.add(q.q);
    list.push({ ...q, topic: item.topic ?? null, wrong });
  };
  for (const item of hot) add(item, Math.max(1, Number(item.wrong) || 1));
  const rest = [...fill];
  for (let i = rest.length - 1; i > 0; i--) { const j = randomInt(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  for (const item of rest) add(item, 0);
  for (let i = list.length - 1; i > 0; i--) { const j = randomInt(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

/** 답 하나 반영: 맞히면 보스 -10, 틀리면 나 -5. 보스 0 → 클리어, 나 0 또는 문제가 다 떨어지면 → 실패 */
export function applyBossAnswer(run, correct) {
  let bossHp = run.bossHp, playerHp = run.playerHp;
  if (correct) bossHp = Math.max(0, bossHp - BOSS_HIT);
  else playerHp = Math.max(0, playerHp - PLAYER_HIT);
  const next = run.position + 1;
  const status = bossHp === 0 ? 'cleared' : playerHp === 0 || next >= run.total ? 'failed' : 'issued';
  return { bossHp, playerHp, status, next };
}
