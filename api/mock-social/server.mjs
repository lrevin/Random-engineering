// 친구 · 1:1 배틀 시험용 서버 (메모리 저장 — 껐다 켜면 사라짐). 약속: api/SOCIAL_API.md
// 실행: node api/mock-social/server.mjs   (기본 http://0.0.0.0:8790)
// 실제 서비스에서는 api/server(MySQL·로그인 토큰)에 같은 주소로 붙입니다. 여기서는 x-pg-uid 헤더로 사용자를 구분합니다.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 8790);
const ONLINE_MS = 30_000;          // 이 시간 안에 요청이 있으면 접속 중
const PENDING_MS = 120_000;        // 배틀 신청 유효 시간
const START_DELAY_MS = 8_000;      // 수락 뒤 시작까지 (두 사람 화면 맞추는 시간)
const GRACE_MS = 15_000;           // 퀴즈 마감 뒤 결과 기다리는 시간
// FAST=1 이면 빠른 시험용 (공부 20초 · 퀴즈 60초)
const FAST = process.env.FAST === '1';
const QUIZ_SEC = FAST ? 60 : 5 * 60;
const STUDY_SEC = FAST ? 20 : 10 * 60;   // 매칭 배틀 공부 시간: 10분 고정
const QUIZ_COUNT = 5;                    // 매칭 배틀 본 문제 수 (전부 AI 출제)
const OT_SEC = FAST ? 20 : 45;           // 연장전 한 문제 제한 시간
const OT_MAX = 10;                       // 연장전 최대 문제 수 (넘으면 무승부)
const OT_WAIT_MS = 120_000;              // 연장전 문제가 이 시간 안에 안 올라오면 무승부
const Q_WAIT_MS = 180_000;               // 본 문제가 공부 끝 뒤 이 시간 안에 안 올라오면 무승부
const XP_RATE = 0.05, XP_MAX = 100;

const users = new Map();           // uid → { uid, nickname, level, xp, lastSeen }
const friends = new Set();         // "A|B" (사전순)
const requests = new Set();        // "from>to"
const battles = new Map();         // id → battle
const queue = new Map();           // 랜덤 매칭 대기: uid → { id, uid, interests, candidates, joinedAt }
const MATCH_WAIT_MS = 180_000;     // 매칭 대기 최대 3분

const pair = (a, b) => [a, b].sort().join('|');
const isFriend = (a, b) => friends.has(pair(a, b));
const now = () => Date.now();
const iso = (ms) => new Date(ms).toISOString();
const pub = (u) => ({ uid: u.uid, nickname: u.nickname, level: u.level, online: now() - u.lastSeen < ONLINE_MS });

function friendsState(uid) {
  const list = [...friends].filter((k) => k.split('|').includes(uid)).map((k) => k.split('|').find((x) => x !== uid));
  const incoming = [...requests].filter((r) => r.endsWith('>' + uid)).map((r) => r.split('>')[0]);
  const outgoing = [...requests].filter((r) => r.startsWith(uid + '>')).map((r) => r.split('>')[1]);
  const view = (ids) => ids.map((id) => users.get(id)).filter(Boolean).map(pub);
  return { friends: view(list), incoming: view(incoming), outgoing: view(outgoing) };
}

const active = (b) => b.status === 'pending' || b.status === 'accepted';
const isIn = (b, uid) => b.from.uid === uid || b.to.uid === uid;

/** 시간이 지난 배틀 정리: 응답 없는 신청은 만료, 퀴즈 마감이 지나면 채점 */
function settle(b) {
  if (b.status === 'pending' && now() - Date.parse(b.createdAt) > PENDING_MS) b.status = 'expired';
  if (b.status !== 'accepted') return;
  if (b.ot) return settleOvertime(b);
  const studyEnd = Date.parse(b.startAt) + b.studySec * 1000;
  if (!b.questionsAt) {
    if (now() > studyEnd + Q_WAIT_MS) finish(b, null); // 문제를 못 만들었으면 무승부로 닫음
    return;
  }
  const deadline = quizStart(b) + b.quizSec * 1000 + GRACE_MS;
  if (Object.keys(b.results).length === 2 || now() > deadline) {
    const [a, c] = [b.from.uid, b.to.uid];
    // 점수가 같으면 비기지 않고 연장전 (AI가 2문제씩 만들어 한 문제씩 풂). 둘 다 안 냈으면 그냥 무승부
    const tied = b.results[a] && b.results[c] && b.results[a].score === b.results[c].score;
    if (b.kind === 'random' && tied) {
      b.ot = { round: 0, roundStartAt: null, needSince: now(), answers: { [a]: [], [c]: [] } };
      return settleOvertime(b);
    }
    finish(b);
  }
}

const quizStart = (b) => Math.max(Date.parse(b.startAt) + b.studySec * 1000, b.questionsAt ?? 0);
const otQuestions = (b) => b.batches.slice(1).flat();

/** 연장전: 문제가 있으면 시작, 둘 다 냈거나 시간이 지나면 판정 (한 사람만 맞히면 승리, 아니면 다음 문제) */
function settleOvertime(b) {
  const ot = b.ot;
  const [a, c] = [b.from.uid, b.to.uid];
  if (!ot.roundStartAt) {
    if (otQuestions(b).length > ot.round) ot.roundStartAt = now();
    else if (now() - ot.needSince > OT_WAIT_MS) return finish(b, null);
    return;
  }
  const both = ot.answers[a][ot.round] != null && ot.answers[c][ot.round] != null;
  if (!both && now() < ot.roundStartAt + OT_SEC * 1000 + 3000) return;
  const ra = ot.answers[a][ot.round] === true, rc = ot.answers[c][ot.round] === true; // 안 낸 사람은 틀림
  ot.answers[a][ot.round] = ra;
  ot.answers[c][ot.round] = rc;
  if (ra !== rc) return finish(b, ra ? a : c);
  ot.round++;
  ot.roundStartAt = null;
  ot.needSince = now();
  if (ot.round >= OT_MAX) return finish(b, null);
  settleOvertime(b);
}

/** 채점. forced: 연장전 승자(uid) · null이면 무승부 · undefined면 점수로 */
function finish(b, forced) {
  const a = b.from.uid, c = b.to.uid;
  const sa = b.results[a]?.score ?? 0, sc = b.results[c]?.score ?? 0; // 안 낸 사람은 0점
  const winner = forced !== undefined ? forced : sa === sc ? null : sa > sc ? a : c;
  if (!winner) b.outcome = { winner: null, xp: 0 };
  else {
    const loser = winner === a ? c : a;
    const loserXp = b.xpAtSubmit[loser] ?? users.get(loser)?.xp ?? 0;
    b.outcome = { winner, xp: Math.min(XP_MAX, Math.floor(Math.max(0, loserXp) * XP_RATE)) };
  }
  b.status = 'finished';
}

/** 주제 id "pl-04" → 세부 분야 id "pl" */
const catOf = (topicId) => String(topicId).replace(/-\d+$/, '');
const shuffled = (xs) => [...xs].sort(() => Math.random() - 0.5);

/** 랜덤 매칭: 서로의 관심 분야에 들어가는 주제를 찾음 (먼저 기다린 사람 후보부터). 없으면 null = 매칭 안 됨 */
function pickTopic(waiting, comer) {
  const fits = (t, who) => !who.interests.length || who.interests.includes(catOf(t));
  return shuffled(waiting.candidates).find((t) => fits(t, comer)) ?? shuffled(comer.candidates).find((t) => fits(t, waiting)) ?? null;
}

function dropStaleQueue() {
  for (const [id, e] of queue) if (now() - e.joinedAt > MATCH_WAIT_MS) queue.delete(id);
}

function view(b, uid) {
  settle(b);
  const open = b.status === 'accepted' || b.status === 'finished';
  const { xpAtSubmit, batches, questionsAt, ot, ...rest } = b;
  const qStart = questionsAt ? quizStart(b) : null;
  const all = otQuestions(b);
  return {
    ...rest,
    topicId: open || b.from.uid === uid ? b.topicId : null,
    // 본 문제는 퀴즈 시작 시각이 지나야 보여 줌
    questions: open && qStart && (now() >= qStart || b.status === 'finished') ? batches[0] : null,
    questionsReady: !!questionsAt,
    quizStartAt: qStart ? iso(qStart) : null,
    overtime: ot ? {
      round: ot.round, roundSec: OT_SEC, roundStartAt: ot.roundStartAt ? iso(ot.roundStartAt) : null,
      question: ot.roundStartAt && b.status === 'accepted' ? all[ot.round] ?? null : null,
      available: all.length, batches: batches.length - 1, answers: ot.answers,
      past: all.slice(0, b.status === 'finished' ? ot.round + 1 : ot.round),
    } : null,
    serverNow: iso(now()),
  };
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-pg-uid, x-pg-name, x-pg-level, x-pg-xp',
  });
  res.end(body === undefined ? undefined : JSON.stringify(body.serverNow ? body : { ...body, serverNow: iso(now()) }));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 512_000) throw new Error('too_large');
  }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const path = new URL(req.url, 'http://local').pathname.replace(/^\/api(?=\/)/, '');
  const uid = String(req.headers['x-pg-uid'] || '').toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(uid)) return send(res, 401, { error: 'unauthorized' });
  const me = users.get(uid) ?? { uid, nickname: '학습자', level: 1, xp: 0, lastSeen: 0 };
  me.nickname = decodeURIComponent(String(req.headers['x-pg-name'] || me.nickname)).slice(0, 20) || '학습자';
  me.level = Number(req.headers['x-pg-level']) || me.level;
  me.xp = Math.max(0, Number(req.headers['x-pg-xp']) || 0);
  me.lastSeen = now();
  users.set(uid, me);

  let body = {};
  try {
    if (req.method === 'POST') body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'bad_request' });
  }
  let m;
  try {
    // ── 친구
    if (req.method === 'POST' && path === '/social/me') return send(res, 200, { ok: true });
    if (req.method === 'GET' && path === '/social/friends') return send(res, 200, friendsState(uid));
    if (req.method === 'POST' && path === '/social/friends/requests') {
      const to = String(body.uid || '').toUpperCase();
      if (to === uid) return send(res, 400, { error: 'self' });
      if (!users.has(to)) return send(res, 404, { error: 'not_found' });
      if (isFriend(uid, to)) return send(res, 409, { error: 'already_friends' });
      if (requests.has(to + '>' + uid)) { requests.delete(to + '>' + uid); friends.add(pair(uid, to)); } // 서로 신청하면 바로 친구
      else if (requests.has(uid + '>' + to)) return send(res, 409, { error: 'already_requested' });
      else requests.add(uid + '>' + to);
      return send(res, 200, friendsState(uid));
    }
    if (req.method === 'POST' && (m = /^\/social\/friends\/requests\/([A-Z0-9]+)\/(accept|decline)$/.exec(path))) {
      const from = m[1];
      if (!requests.delete(from + '>' + uid)) return send(res, 404, { error: 'not_found' });
      if (m[2] === 'accept') friends.add(pair(uid, from));
      return send(res, 200, friendsState(uid));
    }
    if (req.method === 'DELETE' && (m = /^\/social\/friends\/([A-Z0-9]+)$/.exec(path))) {
      friends.delete(pair(uid, m[1]));
      return send(res, 200, friendsState(uid));
    }

    // ── 랜덤 매칭
    if (path === '/match') {
      dropStaleQueue();
      const mine = [...battles.values()].filter((b) => { settle(b); return active(b) && isIn(b, uid); });
      if (req.method === 'GET') {
        if (mine[0]?.status === 'accepted') return send(res, 200, { status: 'matched', battle: view(mine[0], uid) });
        const e = queue.get(uid);
        return send(res, 200, e ? { status: 'waiting', id: e.id, joinedAt: iso(e.joinedAt) } : { status: 'none' });
      }
      if (req.method === 'DELETE') {
        queue.delete(uid);
        return send(res, 200, { status: 'none' });
      }
      if (req.method === 'POST') {
        if (mine.length) return send(res, 409, { error: 'busy' });
        const interests = (Array.isArray(body.interests) ? body.interests : []).map(String).slice(0, 200);
        const candidates = (Array.isArray(body.candidates) ? body.candidates : []).map(String).slice(0, 300);
        if (!candidates.length) return send(res, 400, { error: 'bad_request' });
        const entry = { id: randomUUID(), uid, interests, candidates, joinedAt: now() };
        let topicId = null;
        const other = [...queue.values()].sort((x, y) => x.joinedAt - y.joinedAt).find((e) => e.uid !== uid && (topicId = pickTopic(e, entry)));
        if (!other) {
          queue.set(uid, entry);
          return send(res, 200, { status: 'waiting', id: entry.id, joinedAt: iso(entry.joinedAt) });
        }
        queue.delete(other.uid);
        queue.delete(uid);
        // 문제는 공부하는 동안 먼저 기다린 사람(from)의 앱이 AI로 만들어 올림 (POST /battles/:id/questions)
        const b = {
          id: randomUUID(), kind: 'random', status: 'accepted',
          from: { uid: other.uid, nickname: users.get(other.uid)?.nickname ?? '상대' }, to: { uid, nickname: me.nickname },
          domain: catOf(topicId), studySec: STUDY_SEC, quizSec: QUIZ_SEC, quizCount: QUIZ_COUNT, createdAt: iso(now()), startAt: iso(now() + START_DELAY_MS),
          topicId, batches: [], questionsAt: null, ot: null, results: {}, outcome: null, xpAtSubmit: {},
        };
        battles.set(b.id, b);
        return send(res, 200, { status: 'matched', battle: view(b, uid) });
      }
    }

    // ── 친구 배틀 (지금 앱은 랜덤 매칭만 씀)
    if (req.method === 'POST' && path === '/battles') {
      const to = String(body.opponentUid || '').toUpperCase();
      if (!isFriend(uid, to)) return send(res, 403, { error: 'not_friends' });
      const mine = [...battles.values()].filter((b) => { settle(b); return active(b); });
      if (mine.some((b) => isIn(b, uid))) return send(res, 409, { error: 'busy' });
      if (mine.some((b) => isIn(b, to))) return send(res, 409, { error: 'opponent_busy' });
      const studySec = FAST ? 20 : [300, 600, 900].includes(body.studySec) ? body.studySec : 600;
      if (!Array.isArray(body.questions) || body.questions.length < 1 || typeof body.topicId !== 'string') return send(res, 400, { error: 'bad_request' });
      const b = {
        id: randomUUID(), status: 'pending',
        from: { uid, nickname: me.nickname }, to: { uid: to, nickname: users.get(to)?.nickname ?? '친구' },
        domain: String(body.domain || ''), studySec, quizSec: QUIZ_SEC, createdAt: iso(now()), startAt: null,
        topicId: body.topicId, batches: [body.questions.slice(0, 10)], questionsAt: now(), ot: null, results: {}, outcome: null, xpAtSubmit: {},
      };
      battles.set(b.id, b);
      return send(res, 201, view(b, uid));
    }
    if (req.method === 'GET' && path === '/battles/inbox') {
      const all = [...battles.values()].filter((b) => isIn(b, uid));
      all.forEach(settle);
      const incoming = all.filter((b) => b.status === 'pending' && b.to.uid === uid).map((b) => view(b, uid));
      const cur = all.filter(active).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
      return send(res, 200, { incoming, current: cur ? view(cur, uid) : null });
    }
    if ((m = /^\/battles\/([0-9a-f-]{36})(?:\/(accept|decline|cancel|result|questions|overtime))?$/.exec(path))) {
      const b = battles.get(m[1]);
      if (!b || !isIn(b, uid)) return send(res, 404, { error: 'not_found' });
      settle(b);
      const action = m[2];
      if (req.method === 'GET' && !action) return send(res, 200, view(b, uid));
      if (req.method !== 'POST') return send(res, 404, { error: 'not_found' });
      if (action === 'accept' || action === 'decline') {
        if (b.to.uid !== uid || b.status !== 'pending') return send(res, 409, { error: 'not_pending' });
        if (action === 'accept') {
          const other = [...battles.values()].some((x) => x !== b && active(x) && (isIn(x, uid) || isIn(x, b.from.uid)));
          if (other) return send(res, 409, { error: 'busy' });
          b.status = 'accepted';
          b.startAt = iso(now() + START_DELAY_MS);
        } else b.status = 'declined';
        return send(res, 200, view(b, uid));
      }
      if (action === 'cancel') {
        if (b.from.uid !== uid || b.status !== 'pending') return send(res, 409, { error: 'not_pending' });
        b.status = 'canceled';
        return send(res, 200, view(b, uid));
      }
      if (action === 'questions') {
        // 먼저 올린 것만 인정: batch 0 = 본 문제, 1부터 = 연장전 2문제씩
        const batch = Number(body.batch);
        const qs = Array.isArray(body.questions) ? body.questions.slice(0, batch === 0 ? 10 : 4) : [];
        if (b.status === 'accepted' && qs.length && batch === b.batches.length && (batch === 0 || b.ot)) {
          b.batches.push(qs);
          if (batch === 0) b.questionsAt = now();
          settle(b);
        }
        return send(res, 200, view(b, uid));
      }
      if (action === 'overtime') {
        const ot = b.ot;
        if (b.status === 'accepted' && ot && ot.roundStartAt && Number(body.round) === ot.round && ot.answers[uid][ot.round] == null) {
          ot.answers[uid][ot.round] = body.correct === true;
          settle(b);
        }
        return send(res, 200, view(b, uid));
      }
      if (action === 'result') {
        if (b.status !== 'accepted') return send(res, 409, { error: 'not_pending' });
        if (!b.questionsAt || now() < quizStart(b)) return send(res, 409, { error: 'too_early' }); // 퀴즈 시작 전에는 낼 수 없음
        if (!b.results[uid]) {
          const total = Math.max(1, Math.min(10, Number(body.total) || b.batches[0].length));
          b.results[uid] = { score: Math.max(0, Math.min(total, Number(body.score) || 0)), total, submittedAt: iso(now()) };
          b.xpAtSubmit[uid] = Math.max(0, Number(body.xp) || me.xp);
        }
        settle(b);
        return send(res, 200, view(b, uid));
      }
    }
    return send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'server_error' });
  }
});

server.listen(PORT, process.env.HOST || '0.0.0.0', () => console.log(`mock-social listening on :${PORT}`));
