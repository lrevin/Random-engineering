import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connect, transaction } from './db.mjs';
import { AuthError, normalizeEmail } from './auth.mjs';
import { readJsonBody } from './auth-http.mjs';
import { clientIp, overLimit } from './client-key.mjs';

/**
 * 비밀번호 찾기 (이메일로 가입한 계정만, 카카오 계정은 비밀번호가 없음)
 *  POST /auth/password/forgot {email}            → 항상 {ok:true} (가입 여부를 알려 주지 않음). 가입한 이메일이면 6자리 코드를 메일로
 *  POST /auth/password/reset  {email, code, password} → 코드가 맞으면 새 비밀번호로 바꾸고 모든 기기에서 로그아웃
 * 코드는 해시로만 저장하고 15분 · 5번 틀리면 끝. 같은 이메일로는 1시간에 5번까지만 보냄.
 */
export const RESET_MINUTES = 15, RESET_MAX_ATTEMPTS = 5, RESET_PER_HOUR = 5;
const codeHash = (id, code) => createHash('sha256').update(`${id}:${code}`).digest();

export function createPasswordReset({ mailer, connectionFactory = connect, now = () => new Date(), log = console.error, makeCode = () => String(randomInt(0, 1000000)).padStart(6, '0') } = {}) {
  async function withDb(fn) { const db = await connectionFactory(); try { return await fn(db); } finally { await db.end(); } }
  return {
    enabled: !!mailer,
    async forgot(body) {
      if (!mailer) throw new AuthError('mail_unavailable', 503);
      const email = normalizeEmail(body?.email);
      const job = await withDb((db) => transaction(db, async () => {
        const [[identity]] = await db.execute("SELECT i.user_id FROM auth_identities i JOIN users u ON u.id=i.user_id AND u.status IN ('active','deleting') WHERE i.provider='email' AND i.provider_subject=? FOR UPDATE", [email]);
        if (!identity) return null;
        const [[sent]] = await db.execute('SELECT COUNT(*) AS n FROM password_resets WHERE email=? AND created_at>?', [email, new Date(now().getTime() - 3600e3)]);
        if (Number(sent.n) >= RESET_PER_HOUR) return null;
        await db.execute('UPDATE password_resets SET used_at=? WHERE email=? AND used_at IS NULL', [now(), email]);
        const id = randomUUID(), code = makeCode();
        await db.execute('INSERT INTO password_resets(id,user_id,email,code_hash,expires_at) VALUES (?,?,?,?,?)', [id, identity.user_id, email, codeHash(id, code), new Date(now().getTime() + RESET_MINUTES * 60e3)]);
        return { code };
      }));
      if (job) {
        await mailer.send({
          to: email,
          subject: '[뽑공] 비밀번호 재설정 확인 코드',
          text: `뽑공 비밀번호 재설정 확인 코드는 ${job.code} 입니다.\n${RESET_MINUTES}분 안에 앱에 입력해 주세요.\n직접 요청하지 않았다면 이 메일은 무시해도 돼요.`,
        }).catch((e) => log('Password reset mail: ' + (e?.code ?? e?.message ?? e)));
      }
      return { ok: true };
    },
    async reset(body) {
      const email = normalizeEmail(body?.email), code = String(body?.code ?? ''), pw = body?.password;
      if (!/^\d{6}$/.test(code)) throw new AuthError('invalid_reset_code', 400);
      if (typeof pw !== 'string' || [...pw].length < 8 || Buffer.byteLength(pw, 'utf8') > 72) throw new AuthError('weak_password', 400);
      const hash = await bcrypt.hash(pw, 12);
      return withDb((db) => transaction(db, async () => {
        const [[r]] = await db.execute('SELECT * FROM password_resets WHERE email=? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [email]);
        if (!r || new Date(String(r.expires_at).replace(' ', 'T') + 'Z') <= now() || r.attempts >= RESET_MAX_ATTEMPTS) throw new AuthError('reset_code_expired', 400);
        const ok = timingSafeEqual(Buffer.from(r.code_hash), codeHash(r.id, code));
        if (!ok) {
          await db.execute('UPDATE password_resets SET attempts=attempts+1 WHERE id=?', [r.id]);
          return { error: r.attempts + 1 >= RESET_MAX_ATTEMPTS ? 'reset_code_expired' : 'invalid_reset_code' };
        }
        await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [r.user_id]);
        await db.execute("UPDATE auth_identities SET password_hash=? WHERE user_id=? AND provider='email'", [hash, r.user_id]);
        // 다른 기기의 로그인을 모두 끊음 (예전 비밀번호로 들어온 사람이 계속 쓰지 못하게)
        await db.execute('UPDATE users SET auth_version=auth_version+1 WHERE id=?', [r.user_id]);
        await db.execute('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)) WHERE user_id=?', [r.user_id]);
        await db.execute('UPDATE refresh_tokens t JOIN auth_sessions s ON s.id=t.session_id SET t.revoked_at=COALESCE(t.revoked_at,UTC_TIMESTAMP(3)) WHERE s.user_id=?', [r.user_id]);
        await db.execute('UPDATE password_resets SET used_at=? WHERE id=?', [now(), r.id]);
        return { ok: true };
      })).then((r) => { if (r.error) throw new AuthError(r.error, 400); return r; });
    },
  };
}

export function passwordResetRoutes(service) {
  const hits = new Map();
  return async (req, pathname, send) => {
    const m = /^\/auth\/password\/(forgot|reset)$/.exec(pathname);
    if (!m) return false;
    const reply = (s, b) => send(s, b, { 'Cache-Control': 'no-store' });
    if (req.method !== 'POST') { reply(405, { error: 'method_not_allowed' }); return true; }
    if (overLimit(hits, `${clientIp(req)}:${m[1]}`, m[1] === 'forgot' ? 5 : 10)) { reply(429, { error: 'rate_limited' }); return true; }
    try { reply(200, await service[m[1]](await readJsonBody(req, { maxBytes: 2048 }))); }
    catch (e) { if (!(e instanceof AuthError)) throw e; reply(e.status, { error: e.code }); }
    return true;
  };
}
