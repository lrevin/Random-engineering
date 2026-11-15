import { createPublicKey, verify } from 'node:crypto';
import { connect, transaction } from '../server/db.mjs';
import { walletState } from './wallet-state.mjs';

/**
 * AdMob 보상형 광고 서버 측 확인(SSV, Server-Side Verification)
 *
 * 광고를 끝까지 보면 구글이 우리 서버로 직접 GET /ads/admob/ssv?...&signature=...&key_id=... 를 보낸다.
 * - 구글 공개키(verifier-keys.json)로 서명을 확인한다 → 앱이 "봤다"고 거짓말해도 지급되지 않음
 * - user_id: 앱이 광고 요청 때 넣은 우리 회원 id (serverSideVerificationOptions.userId)
 * - transaction_id 로 중복 지급을 막는다 (wallet_transactions 의 (user_id, request_id) 유일 키)
 * - 보상 수량은 구글이 보낸 값이 아니라 서버 상수(AD_REWARD)만 쓰고, 하루 AD_DAILY_LIMIT번까지
 * 표를 새로 만들지 않고 기존 wallet_transactions(reason='ad_reward')에 기록한다.
 */
export const AD_REWARD = 10;
export const AD_DAILY_LIMIT = 3;
const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 한국 시간 오늘 0시를 UTC 'YYYY-MM-DD HH:MM:SS' 로 (DB의 created_at 은 UTC) */
export function kstDayStartUtc(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600e3);
  const start = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600e3;
  return new Date(start).toISOString().slice(0, 19).replace('T', ' ');
}

/** 구글 공개키 가져오기 (하루 보관, 모르는 key_id가 오면 다시 받음) */
export function googleKeys({ fetcher = fetch, ttlMs = 24 * 3600e3 } = {}) {
  let cache = null, at = 0;
  return async (keyId, force = false) => {
    if (!cache || force || Date.now() - at > ttlMs) {
      const res = await fetcher(KEYS_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('admob keys ' + res.status);
      const body = await res.json();
      cache = new Map((body.keys ?? []).map(k => [String(k.keyId), createPublicKey(k.pem)]));
      at = Date.now();
    }
    return cache.get(String(keyId)) ?? null;
  };
}

/** 원래 주소의 쿼리 문자열(raw)에서 서명 대상 부분과 서명·키 id를 뽑아 확인 */
export async function verifySsv(rawQuery, getKey) {
  const i = rawQuery.indexOf('&signature=');
  if (i < 0) return null;
  const message = rawQuery.slice(0, i);
  const params = new URLSearchParams(rawQuery);
  const signature = params.get('signature'), keyId = params.get('key_id');
  if (!signature || !keyId) return null;
  let key = await getKey(keyId);
  if (!key) key = await getKey(keyId, true);
  if (!key) return null;
  const ok = verify('sha256', Buffer.from(message, 'utf8'), { key, dsaEncoding: 'der' }, Buffer.from(signature, 'base64url'));
  return ok ? new URLSearchParams(message) : null;
}

export function createAdRewardService({ connectionFactory = connect, now = () => new Date() } = {}) {
  return {
    /** 확인된 광고 1회를 지급. 결과: granted / duplicate / limit / no_user */
    async grant(userId, transactionId) {
      const db = await connectionFactory();
      try {
        return await transaction(db, async () => {
          const [[u]] = await db.execute('SELECT id,status FROM users WHERE id=? FOR UPDATE', [userId]);
          if (!u || u.status !== 'active') return 'no_user';
          const value = await walletState(db, userId, now()); // 지갑 행 잠금(없으면 만듦)
          const requestId = 'ad:' + transactionId;
          const [[dup]] = await db.execute('SELECT id FROM wallet_transactions WHERE user_id=? AND request_id=?', [userId, requestId]);
          if (dup) return 'duplicate';
          const [[{ n }]] = await db.execute("SELECT COUNT(*) AS n FROM wallet_transactions WHERE user_id=? AND reason='ad_reward' AND created_at>=?", [userId, kstDayStartUtc(now())]);
          if (Number(n) >= AD_DAILY_LIMIT) return 'limit';
          await db.execute('UPDATE wallets SET balance=? WHERE user_id=?', [value.balance + AD_REWARD, userId]);
          await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,'ad_reward',?)", [userId, AD_REWARD, requestId]);
          return 'granted';
        });
      } finally { await db.end(); }
    },
  };
}

/** GET /ads/admob/ssv : 구글만 부르는 주소. 응답 코드는 구글 쪽 재시도 판단에만 쓰임 */
export function adRewardRoutes(service, { getKey = googleKeys(), adUnits = (process.env.ADMOB_REWARDED_UNITS ?? '').split(',').map(s => s.trim()).filter(Boolean) } = {}) {
  return async (req, pathname, send) => {
    if (pathname !== '/ads/admob/ssv') return false;
    if (req.method !== 'GET') { send(405, { error: 'method_not_allowed' }); return true; }
    const raw = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
    let params;
    try { params = await verifySsv(raw, getKey); }
    catch (e) { console.error('AdMob SSV keys: ' + (e?.message ?? e)); send(503, { error: 'keys_unavailable' }); return true; }
    if (!params) { send(403, { error: 'bad_signature' }); return true; }
    // AdMob 콘솔의 "확인" 버튼은 user_id 없이 보냄 → 서명만 맞으면 200
    const userId = params.get('user_id') ?? '', tx = params.get('transaction_id') ?? '';
    if (!userId) { send(200, { ok: true, test: true }); return true; }
    // ad_unit은 숫자 부분만 옴. 설정돼 있으면 우리 광고 단위만 인정
    if (adUnits.length && !adUnits.some(u => u.endsWith('/' + params.get('ad_unit')))) { send(200, { ok: false, reason: 'unknown_ad_unit' }); return true; }
    if (!UUID.test(userId) || !/^[A-Za-z0-9_-]{1,90}$/.test(tx)) { send(200, { ok: false, reason: 'bad_params' }); return true; }
    const result = await service.grant(userId, tx);
    send(200, { ok: result === 'granted', result });
    return true;
  };
}
