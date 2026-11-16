import { connect, transaction } from '../server/db.mjs';
import { AuthError } from '../server/auth.mjs';

/** 계정에 보관하는 학습 진행 항목 (앱 lib/progress-sync.ts의 목록과 같아야 함) */
export const PROGRESS_NAMES = ['exam', 'reviewDone', 'recall', 'certDates'];
const MAX_BYTES = 256 * 1024;
const ISO = "DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.%fZ')";

/**
 * 모의고사 결과 · 오답 해결 · 복습 시각 · 자격증 시험일을 계정별로 보관.
 * 재화가 아닌 학습 기록이라 앱이 보낸 값을 그대로 저장하고, 기기 간에는 나중에 쓴 값이 이김.
 */
export function createProgressService({ auth, connectionFactory = connect }) {
  async function withUser(header, action) {
    const claims = await auth.verifyAccess(header);
    const db = await connectionFactory();
    try {
      return await transaction(db, async () => {
        const [[u]] = await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE', [claims.sub]);
        if (!u || u.status !== 'active' || u.auth_version !== claims.av) throw new AuthError('unauthorized', 401);
        return action(db, u.id);
      });
    } finally { await db.end(); }
  }
  return {
    list: (header) => withUser(header, async (db, id) => {
      const [rows] = await db.execute(`SELECT name,value,${ISO} AS updated FROM user_progress WHERE user_id=?`, [id]);
      const items = {};
      for (const r of rows) items[r.name] = { value: typeof r.value === 'string' ? JSON.parse(r.value) : r.value, updatedAt: r.updated };
      return { items };
    }),
    save: (header, name, body) => {
      if (!PROGRESS_NAMES.includes(name)) throw new AuthError('not_found', 404);
      if (!body || typeof body !== 'object' || !('value' in body) || body.value === null || typeof body.value !== 'object') throw new AuthError('invalid_progress');
      const json = JSON.stringify(body.value);
      if (Buffer.byteLength(json, 'utf8') > MAX_BYTES) throw new AuthError('payload_too_large', 413);
      return withUser(header, async (db, id) => {
        await db.execute('INSERT INTO user_progress(user_id,name,value,updated_at) VALUES (?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=VALUES(updated_at)', [id, name, json]);
        const [[r]] = await db.execute(`SELECT ${ISO} AS updated FROM user_progress WHERE user_id=? AND name=?`, [id, name]);
        return { updatedAt: r.updated };
      });
    },
  };
}
