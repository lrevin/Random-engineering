import { connect } from './db.mjs';

/**
 * 푸시 알림 (Expo 푸시 서비스 → 안드로이드는 FCM, iOS는 APNs).
 * 앱이 로그인하면 기기의 Expo 푸시 토큰을 POST /me/push-token 으로 등록하고, 서버는 그 토큰으로 보낸다.
 * 서버 비밀값은 필요 없다 (Expo 계정에서 '푸시 보안'을 켰다면 EXPO_ACCESS_TOKEN 을 서버 환경변수에만 둠).
 * 보내기 실패는 알림만 안 갈 뿐 요청을 실패시키지 않는다. 앱에서 지워진 토큰(DeviceNotRegistered)은 지운다.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const PUSH_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,180}\]$/;

export function createPush({ fetcher = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN, connectionFactory = connect, log = console.error } = {}) {
  async function withDb(fn) { const db = await connectionFactory(); try { return await fn(db); } finally { await db.end(); } }
  return {
    async register(db, userId, token, platform) {
      if (typeof token !== 'string' || !PUSH_TOKEN.test(token) || !['android', 'ios'].includes(platform)) return false;
      // 같은 기기로 다른 계정에 로그인하면 토큰이 새 계정으로 옮겨감
      await db.execute('INSERT INTO push_tokens(token,user_id,platform) VALUES (?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),platform=VALUES(platform),updated_at=CURRENT_TIMESTAMP(3)', [token, userId, platform]);
      return true;
    },
    async unregister(db, userId, token) {
      await db.execute('DELETE FROM push_tokens WHERE token=? AND user_id=?', [String(token ?? ''), userId]);
    },
    /** 회원 한 명의 모든 기기로 보냄 (트랜잭션 밖에서 부름) */
    async send(userId, { title, body, data = {}, channelId = 'battle' }) {
      try {
        const tokens = await withDb(async (db) => (await db.execute('SELECT token FROM push_tokens WHERE user_id=? ORDER BY updated_at DESC LIMIT 5', [userId]))[0].map((r) => r.token));
        if (!tokens.length) return 0;
        const res = await fetcher(EXPO_PUSH_URL, {
          method: 'POST', signal: AbortSignal.timeout(8000),
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high', channelId }))),
        });
        if (!res.ok) { log(`Push: expo ${res.status}`); return 0; }
        const tickets = (await res.json())?.data ?? [];
        const gone = tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
        if (gone.length) await withDb((db) => db.execute(`DELETE FROM push_tokens WHERE token IN (${gone.map(() => '?').join(',')})`, gone));
        return tickets.filter((t) => t?.status === 'ok').length;
      } catch (e) {
        log('Push: ' + (e?.message ?? e));
        return 0;
      }
    },
  };
}
