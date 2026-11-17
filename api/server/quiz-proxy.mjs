import { AuthError } from './auth.mjs';
import { readJsonBody } from './auth-http.mjs';

/**
 * POST /me/quiz : 퀴즈 AI 서버(api/quiz-server)를 API 서버가 대신 부름.
 * - 로그인한 회원만 (예전에는 앱이 퀴즈 서버를 직접 불렀고, 앱 안에 든 토큰은 누구나 꺼낼 수 있어서 Claude 요금을 마음대로 쓸 수 있었음)
 * - 회원마다 하루(한국 날짜) QUIZ_DAILY_LIMIT번, 그중 그 자리에서 새로 만드는 fresh는 QUIZ_FRESH_DAILY_LIMIT번까지 (넘으면 창고 문제만)
 * - 퀴즈 서버 주소·토큰은 이 서버 환경변수(QUIZ_SERVER_URL, QUIZ_SERVER_TOKEN)에만 둠. 둘 중 하나라도 없으면 꺼짐
 * 횟수는 서버 메모리에 셈 (서버 한 대 기준, 재시작하면 그날 횟수가 0부터)
 */
export const QUIZ_DAILY_LIMIT = 30;
export const QUIZ_FRESH_DAILY_LIMIT = 10;
const kstDay = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

export function quizProxyRoutes(auth, {
  url = process.env.QUIZ_SERVER_URL, token = process.env.QUIZ_SERVER_TOKEN,
  fetcher = fetch, now = () => new Date(), timeoutMs = 150000,
} = {}) {
  if (!url || !token) return null;
  const base = url.replace(/\/+$/, '');
  const used = new Map(); // 회원 id → { day, n, fresh }
  return async (req, pathname, send) => {
    if (pathname !== '/me/quiz') return false;
    const reply = (status, body) => send(status, body, { 'Cache-Control': 'no-store' });
    if (req.method !== 'POST') { reply(405, { error: 'method_not_allowed' }); return true; }
    try {
      const { user } = await auth.me(req.headers.authorization); // 서명 + 계정 상태 + 로그인 버전 확인
      const body = await readJsonBody(req, { maxBytes: 32768 });
      const topicId = body.topicId, count = body.count ?? 4;
      const avoid = Array.isArray(body.avoid) ? body.avoid : [];
      if (typeof topicId !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(topicId) || !Number.isInteger(count) || count < 1 || count > 7
        || avoid.length > 40 || avoid.some((s) => typeof s !== 'string' || s.length > 400) || (body.fresh !== undefined && typeof body.fresh !== 'boolean')) {
        throw new AuthError('invalid_request', 400);
      }
      const day = kstDay(now());
      for (const [k, v] of used) if (v.day !== day) used.delete(k);
      const mine = used.get(user.id) ?? { day, n: 0, fresh: 0 };
      if (mine.n >= QUIZ_DAILY_LIMIT) throw new AuthError('quiz_daily_limit', 429);
      const fresh = body.fresh === true && mine.fresh < QUIZ_FRESH_DAILY_LIMIT;
      mine.n++; if (fresh) mine.fresh++;
      used.set(user.id, mine);
      let data;
      try {
        const res = await fetcher(`${base}/quiz`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-quiz-token': token },
          body: JSON.stringify({ topicId, count, avoid, fresh }), signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error('quiz server ' + res.status);
        data = await res.json();
      } catch (e) {
        console.error('Quiz proxy: ' + (e?.message ?? e));
        throw new AuthError('quiz_unavailable', 502);
      }
      reply(200, { questions: Array.isArray(data?.questions) ? data.questions.slice(0, count) : [], fresh: Number(data?.fresh) || 0 });
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      reply(error.status, { error: error.code });
    }
    return true;
  };
}
