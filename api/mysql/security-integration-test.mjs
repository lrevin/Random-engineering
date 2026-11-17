// 보안 검토(2026-11-17) 수정이 실제 MySQL에서 동작하는지 확인
// 실행: cd api/server && npm run security:test  (MYSQL_* 환경변수의 시험용 DB, V1~V10 적용 · 문제 은행 가져오기 끝난 상태)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { connect } from '../server/db.mjs';
import { createAuth } from '../server/auth.mjs';
import { createAccountService, purgeExpiredAccounts } from './account-service.mjs';
import { createRecordService } from './record-service.mjs';
import { createBossService } from './boss-service.mjs';
import { createTeamService } from './team-service.mjs';
import { createLeaderboardService } from './leaderboard-service.mjs';
import { CLIENT_RECORD_DAILY_LIMIT } from './reward-eligibility.mjs';
const json = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

test('보안 수정: 실제 MySQL', async (t) => {
  const db = await connect(), auth = createAuth({ secret: randomBytes(48).toString('base64url') }), users = [];
  const signup = async () => { const s = await auth.signup({ email: randomUUID() + '@example.com', password: 'Password!123' }); users.push(s.user.id); return s; };
  t.after(async () => {
    for (const id of users) await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=?", [id]);
    await purgeExpiredAccounts({ onlyUserIds: users }); await db.end();
  });
  // 문제 은행이 넉넉한 세부 분야 하나
  const [[cat]] = await db.execute(`SELECT t.category_id AS id,COUNT(*) AS n FROM questions q JOIN topics t ON t.id=q.topic_id JOIN question_details d ON d.question_id=q.id
    WHERE q.source='bank' AND q.status='published' AND d.type IN ('mc','ox') GROUP BY t.category_id ORDER BY n DESC LIMIT 1`);
  const a = await signup(), h = 'Bearer ' + a.accessToken;
  await createAccountService({ auth }).saveProfile(h, { nickname: '보안', interests: [cat.id], level: 1, studyMinutes: 10, reminderEnabled: false, reminderTime: '20:00' });

  await t.test(`앱이 보낸 기록은 하루 ${CLIENT_RECORD_DAILY_LIMIT}개까지만 XP`, async () => {
    const [[topic]] = await db.execute(`SELECT q.topic_id AS id FROM questions q JOIN question_details d ON d.question_id=q.id WHERE q.source='bank' AND d.type='mc'
      AND EXISTS(SELECT 1 FROM question_file_items i WHERE i.question_id=q.id) GROUP BY q.topic_id HAVING COUNT(*)>=7 LIMIT 1`);
    const [rows] = await db.execute(`SELECT d.body,d.choices,d.answer,d.explanation FROM questions q JOIN question_details d ON d.question_id=q.id
      WHERE q.topic_id=? AND q.source='bank' AND d.type='mc' AND EXISTS(SELECT 1 FROM question_file_items i WHERE i.question_id=q.id) LIMIT 7`, [topic.id]);
    const items = rows.map((r) => ({ question: { type: 'mc', q: r.body, choices: json(r.choices), answer: json(r.answer), explain: r.explanation, src: 'bank' }, answer: json(r.answer) }));
    const records = Array.from({ length: CLIENT_RECORD_DAILY_LIMIT + 2 }, (_, i) => {
      const id = randomUUID();
      return { id, attemptId: id, topicId: topic.id, memo: '', studySec: 600, score: 7, total: 7, studiedAt: new Date(Date.now() - (10 - i) * 1000).toISOString(), items };
    });
    const out = await createRecordService({ auth }).upload(h, { records });
    assert.equal(out.saved, records.length, '기록은 전부 저장');
    const status = out.results.map((r) => [r.record.rewardStatus, r.record.rewardReason]);
    assert.deepEqual(status.slice(0, CLIENT_RECORD_DAILY_LIMIT).map((s) => s[0]), Array(CLIENT_RECORD_DAILY_LIMIT).fill('eligible'));
    assert.deepEqual(status.slice(CLIENT_RECORD_DAILY_LIMIT), [['ineligible', 'client_daily_limit'], ['ineligible', 'client_daily_limit']]);
    const [[xp]] = await db.execute('SELECT COUNT(*) AS n FROM xp_ledger WHERE user_id=?', [a.user.id]);
    assert.equal(Number(xp.n), CLIENT_RECORD_DAILY_LIMIT);
  });

  await t.test('보스전: 검증 안 된 기록의 꾸민 문제는 안 나옴, 문제 글은 DB 원본', async () => {
    // 다른 회원이 관심 분야 주제에 꾸민 문제를 틀린 것처럼 넣음 (검증 안 된 시도)
    const b = await signup();
    await db.execute('UPDATE profiles SET interests=? WHERE user_id=?', [JSON.stringify([cat.id]), a.user.id]);
    await db.execute("INSERT INTO profiles(user_id,nickname,interests,level,study_minutes,reminder_enabled,reminder_time) VALUES (?,?,?,1,10,0,'20:00')", [b.user.id, '나쁜', JSON.stringify([cat.id])]);
    const [[topic]] = await db.execute('SELECT id FROM topics WHERE category_id=? LIMIT 1', [cat.id]);
    const attempt = randomUUID(), evil = '광고 사이트로 오세요 http://evil.example';
    await db.execute("INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,completed_at) VALUES (?,?,?,'completed','client_reported',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", [attempt, b.user.id, topic.id]);
    for (let i = 1; i <= 5; i++) await db.execute('INSERT INTO quiz_attempt_items(attempt_id,position,question_id,question_snapshot,submitted_answer,is_correct,answered_at,topic_id) VALUES (?,?,NULL,?,?,0,UTC_TIMESTAMP(3),?)',
      [attempt, i, JSON.stringify({ type: 'mc', q: evil + i, choices: ['a', 'b', 'c', 'd'], answer: 0, explain: 'x' }), '1', topic.id]);
    const run = await createBossService({ auth }).start(h, { requestId: randomUUID() });
    assert.equal(run.status, 'issued'); assert.ok(run.total >= 30);
    const [[row]] = await db.execute('SELECT questions FROM boss_runs WHERE id=?', [run.runId]);
    assert.ok(!json(row.questions).some((q) => q.q.startsWith('광고')), '꾸민 문제 없음');
  });

  await t.test('스터디 팀: 들어온 뒤 XP만 세고 목표 전에는 보상 없음 (SQL 실행)', async () => {
    const teams = createTeamService({ auth });
    const s = await teams.create(h, { mode: 'open' });
    assert.equal(s.team.members.length, 1); assert.equal(s.team.members[0].weekXp, 0, '들어오기 전 XP는 안 셈');
    await assert.rejects(teams.claim(h), { code: 'team_goal_not_met' });
    await teams.leave(h);
  });

  await t.test('닉네임 가리기: 새 계정 신고는 안 셈 (SQL 실행)', async () => {
    const [[uid]] = await db.execute('SELECT friend_code FROM social_members WHERE user_id=?', [a.user.id]).then(([r]) => [r]).catch(() => [[null]]);
    const board = createLeaderboardService({ auth });
    if (uid?.friend_code) for (let i = 0; i < 3; i++) { const r = await signup(); await board.report('Bearer ' + r.accessToken, { uid: uid.friend_code }); }
    const w = await board.ranking(h, 'level', new URLSearchParams());
    const me = w.entries.find((e) => e.me);
    if (me) assert.equal(me.nickname, '보안');
  });

  await t.test('V10: 라벤더 드림 → 허니 레몬, 둘 다 있으면 1200 돌려줌', async () => {
    const c = await signup(), d = await signup();
    for (const u of [c, d]) {
      await db.execute("INSERT IGNORE INTO wallets(user_id,balance) VALUES (?,100)", [u.user.id]);
      await db.execute("INSERT INTO member_cosmetics(user_id,item_type,item_id,is_equipped,acquired_via) VALUES (?,'skin','lavender',TRUE,'purchase')", [u.user.id]);
    }
    await db.execute("INSERT INTO member_cosmetics(user_id,item_type,item_id,is_equipped,acquired_via) VALUES (?,'skin','honey',FALSE,'purchase')", [d.user.id]);
    const sql = fs.readFileSync(new URL('./migrations/V10__lavender_to_honey.sql', import.meta.url), 'utf8')
      .split('\n').filter((l) => !l.startsWith('--')).join('\n').split(';').map((x) => x.trim()).filter(Boolean);
    for (const s of sql) await db.query(s);
    const skins = async (u) => (await db.execute("SELECT item_id,is_equipped FROM member_cosmetics WHERE user_id=? AND item_type='skin' ORDER BY item_id", [u.user.id]))[0].map((r) => [r.item_id, Number(r.is_equipped)]);
    assert.deepEqual(await skins(c), [['honey', 1]]);
    assert.deepEqual(await skins(d), [['honey', 1]]);
    const bal = async (u) => Number((await db.execute('SELECT balance FROM wallets WHERE user_id=?', [u.user.id]))[0][0].balance);
    assert.equal(await bal(c), 100); assert.equal(await bal(d), 1300);
  });
});
