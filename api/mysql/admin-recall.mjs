import { randomUUID } from 'node:crypto';
import { connect, safeError } from '../server/db.mjs';
import { adminAccessToken, createAuth } from '../server/auth.mjs';
import { createRecordService } from './record-service.mjs';

/**
 * 운영자용(시연·시험 계정): 친구 UID(8자리) 회원에게 '오늘의 복습' 대상이 되는 공부 기록을 넣습니다.
 * EC2에서 api/server 폴더 기준으로 실행합니다.
 *
 *   npm run admin:recall -- HUWQVQTV               # 주제 5개
 *   npm run admin:recall -- HUWQVQTV --topics 3
 *
 * - 앱이 올리는 것과 같은 업로드 경로(record-service upload)를 그대로 써서 기본 문제 검증·보상 규칙을 똑같이 통과합니다.
 * - 관심 분야의 기본 문제 7개로 푼 기록을 3~5일 전 날짜로 올립니다 (복습은 마지막 공부 2일 뒤부터 대상).
 * - 기록마다 5개 정답 · 2개 오답이라 '오답 다시 풀기'에도 문제가 생깁니다. 기록이므로 XP도 함께 쌓입니다.
 */
const QUIZ = 7, WRONG = 2;

export function parseRecallArgs(argv) {
  const [code, ...rest] = argv;
  if (!/^[A-Z2-9]{8}$/.test(String(code ?? '').toUpperCase())) throw new Error('친구 UID 8자리를 첫 번째로 적어 주세요. 예: HUWQVQTV');
  let topics = 5;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--topics') {
      topics = Number(rest[++i]);
      if (!Number.isInteger(topics) || topics < 1 || topics > 5) throw new Error('--topics 는 1~5 (복습은 한 번에 최대 5주제)');
    } else throw new Error('알 수 없는 옵션: ' + rest[i]);
  }
  return { code: code.toUpperCase(), topics };
}

const json = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/** 기본 문제 1개를 앱이 보내는 형식으로. wrong이면 일부러 다른 답을 고름 */
export function recallItem(row, wrong) {
  const answer = json(row.answer);
  const question = row.type === 'mc'
    ? { type: 'mc', q: row.body, choices: json(row.choices), answer, explain: row.explanation, src: 'bank' }
    : { type: 'ox', q: row.body, answer, explain: row.explanation, src: 'bank' };
  const picked = !wrong ? answer : row.type === 'mc' ? (answer + 1) % 4 : !answer;
  return { question, answer: picked };
}

export async function adminRecall({ code, topics }, { connectionFactory = connect, now = new Date(), secret = process.env.JWT_SECRET } = {}) {
  const db = await connectionFactory();
  let user, chosen;
  try {
    const [[u]] = await db.execute(
      "SELECT u.id,u.auth_version,p.interests FROM social_members m JOIN users u ON u.id=m.user_id AND u.status='active' LEFT JOIN profiles p ON p.user_id=u.id WHERE m.friend_code=?", [code]);
    if (!u) throw new Error('그 UID의 회원을 찾지 못했어요: ' + code);
    user = u;
    const interests = json(u.interests ?? '[]');
    // 기본 문제가 7개 이상 있는 주제 중 관심 분야(세부 분야) 것을 먼저, 모자라면 아무 주제나
    const [rows] = await db.execute(`SELECT t.id, t.category_id FROM topics t
      JOIN questions q ON q.topic_id=t.id AND q.source='bank' AND EXISTS(SELECT 1 FROM question_file_items i WHERE i.question_id=q.id)
      WHERE t.is_active=1 GROUP BY t.id, t.category_id HAVING COUNT(*)>=${QUIZ}`);
    const pool = [...rows.filter((r) => interests.includes(r.category_id)), ...rows.filter((r) => !interests.includes(r.category_id))];
    chosen = [...new Set(pool.map((r) => r.id))].slice(0, topics);
    if (!chosen.length) throw new Error('기본 문제가 있는 주제가 없어요.');
    for (const [i, topicId] of chosen.entries()) {
      const [qs] = await db.execute(`SELECT d.type,d.body,d.choices,d.answer,d.explanation FROM questions q JOIN question_details d ON d.question_id=q.id
        WHERE q.topic_id=? AND q.source='bank' AND EXISTS(SELECT 1 FROM question_file_items i WHERE i.question_id=q.id) ORDER BY q.id LIMIT ${QUIZ}`, [topicId]);
      chosen[i] = { topicId, items: qs.map((r, k) => recallItem(r, k < WRONG)) };
    }
  } finally { await db.end(); }

  // 그 회원의 짧은 로그인 토큰을 서버 비밀키로 만들어, 앱과 같은 업로드 경로로 올림
  const token = await adminAccessToken(user, secret);
  const records = chosen.map(({ topicId, items }, i) => {
    const at = new Date(now.getTime() - (3 + (i % 3)) * 86400000);
    at.setUTCHours(11, 0, 0, 0); // 한국 시각 저녁 8시
    const id = randomUUID();
    return { id, attemptId: id, topicId, memo: '', studySec: 900, score: QUIZ - WRONG, total: QUIZ, studiedAt: at.toISOString(), items };
  });
  const service = createRecordService({ auth: createAuth({ secret, connectionFactory }), connectionFactory, now: () => now });
  const result = await service.upload('Bearer ' + token, { records });
  return { userId: user.id, saved: result.saved, results: result.results.map((r) => ({ topicId: records[r.index].topicId, ok: r.ok, error: r.error ?? null })) };
}

// 직접 실행했을 때만 (시험에서 import 할 때는 실행 안 함)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/admin-recall.mjs')) {
  try { console.log(JSON.stringify(await adminRecall(parseRecallArgs(process.argv.slice(2))), null, 1)); }
  catch (error) { console.error('admin-recall 실패: ' + (error instanceof Error && !error.code ? error.message : safeError(error))); process.exitCode = 1; }
}
