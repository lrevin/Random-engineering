// 뽑공 프리미엄 월 구독 (토스페이먼츠 카드 자동결제) — 규칙 숫자는 subscription-policy.mjs
// 1) 앱: POST /me/subscription/checkout → 결제 페이지 주소(20분짜리 서명 토큰)를 받아 브라우저로 엶
// 2) 결제 페이지(GET /billing/start): 토스 결제창에서 카드 등록 → 토스가 /billing/success?authKey&customerKey 로 보냄
// 3) 서버: 빌링키 발급 → 첫 달 결제 → 구독 시작 (+톱니바퀴 300) → 앱 주소 ppobgong://billing?result=success 로 돌려보냄
// 4) 매달: API 서버가 10분마다 결제일이 된 구독을 자동결제 (실패하면 하루 뒤 다시, 3번 실패하면 종료)
// 5) 해지: 다음 결제를 하지 않고 지금 기간이 끝날 때까지 프리미엄 유지 (기간 안에는 해지 취소 가능)
import { randomUUID, randomBytes } from 'node:crypto';
import { billingTokens } from '../server/billing-token.mjs';
import { connect, transaction } from '../server/db.mjs';
import { AuthError } from '../server/auth.mjs';
import { createToss } from '../server/toss.mjs';
import { walletState } from './wallet-state.mjs';
import { SUB_PRICE, SUB_BONUS_GEARS, SUB_MAX_ATTEMPTS, SUB_RETRY_MS, SUB_ORDER_NAME, addMonth, orderIdFor, effectiveStatus } from './subscription-policy.mjs';

const instant = (v) => (v == null ? null : new Date(v instanceof Date ? v : String(v).includes('T') ? v : String(v).replace(' ', 'T') + 'Z'));
const iso = (v) => instant(v)?.toISOString() ?? null;

export function createSubscriptionService({ auth, toss = createToss(), clientKey = process.env.TOSS_CLIENT_KEY, secret = process.env.JWT_SECRET, connectionFactory = connect, now = () => new Date(), log = console.error } = {}) {
  const tokens = billingTokens(secret);
  const enabled = !!toss && !!clientKey;
  async function withDb(fn) { const db = await connectionFactory(); try { return await fn(db); } finally { await db.end(); } }
  async function member(header, action) {
    const claims = await auth.verifyAccess(header);
    return withDb((db) => transaction(db, async () => {
      const [[u]] = await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE', [claims.sub]);
      if (!u || u.status !== 'active' || u.auth_version !== claims.av) throw new AuthError('unauthorized', 401);
      return action(db, u.id);
    }));
  }
  const row = async (db, id, lock = false) => (await db.execute(`SELECT * FROM subscriptions WHERE user_id=?${lock ? ' FOR UPDATE' : ''}`, [id]))[0][0] ?? null;
  function view(r) {
    const at = now(), status = effectiveStatus(r, at), end = instant(r?.current_period_end);
    return {
      available: enabled, status, plan: 'premium_monthly', amount: r?.amount ?? SUB_PRICE, bonusGears: SUB_BONUS_GEARS,
      premium: !!end && end > at, currentPeriodEnd: end && end > at ? end.toISOString() : null,
      nextChargeAt: r && ['active', 'past_due'].includes(r.status) ? iso(r.next_charge_at) : null,
      canceledAt: status === 'canceled' ? iso(r.canceled_at) : null, card: status === 'none' || status === 'ended' ? null : r?.card_label ?? null,
      failedAttempts: r?.status === 'past_due' ? Number(r.failed_attempts) : 0,
    };
  }
  /** 결제 성공 반영: 기간 시작 · 끝, 다음 결제일, 결제 기록, 톱니바퀴 */
  async function applyPaid(db, userId, payment, paymentKey, approvedAt) {
    await db.execute("UPDATE subscription_payments SET status='done',payment_key=?,approved_at=? WHERE order_id=?", [paymentKey ?? null, approvedAt ?? now(), payment.order_id]);
    await db.execute("UPDATE subscriptions SET status='active',current_period_start=?,current_period_end=?,next_charge_at=?,failed_attempts=0,canceled_at=NULL WHERE user_id=?",
      [instant(payment.period_start), instant(payment.period_end), instant(payment.period_end), userId]);
    const value = await walletState(db, userId, now());
    const [res] = await db.execute("INSERT IGNORE INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,'premium_bonus',?)", [userId, SUB_BONUS_GEARS, 'sub:' + payment.order_id]);
    if (res.affectedRows) await db.execute('UPDATE wallets SET balance=? WHERE user_id=?', [Math.min(999999, value.balance + SUB_BONUS_GEARS), userId]);
  }
  /**
   * 결제 시도 (트랜잭션 밖에서 토스 호출). 결과: ok / 실패(code) / 모름(unknown: 응답을 못 받음 → 실패로 치지 않고 나중에 주문번호로 확인)
   * 응답을 못 받았던 예전 시도(payment.status='pending')는 같은 주문번호로 토스에 먼저 물어봐서 두 번 결제하지 않음
   */
  async function charge(r, payment) {
    const unknown = (e) => !e?.status || e.status >= 500;
    if (payment.status === 'pending') {
      try {
        const old = await toss.byOrder(payment.order_id);
        if (old?.status === 'DONE') return { ok: true, paymentKey: old.paymentKey, approvedAt: instant(old.approvedAt) };
        if (old?.status) return { ok: false, code: `STATUS_${old.status}`, message: '' };
      } catch (e) {
        if (unknown(e) || e.status !== 404) return { ok: false, unknown: true, code: e.code ?? 'NETWORK' };
        // 404: 토스에 없는 주문 → 결제가 안 된 것이니 같은 주문번호로 새로 결제
      }
    }
    try {
      const p = await toss.charge(r.billing_key, { customerKey: r.customer_key, amount: payment.amount, orderId: payment.order_id, orderName: SUB_ORDER_NAME });
      if (p?.status === 'DONE') return { ok: true, paymentKey: p.paymentKey, approvedAt: instant(p.approvedAt) };
      return { ok: false, code: `STATUS_${p?.status ?? 'UNKNOWN'}`, message: '' };
    } catch (e) {
      if (unknown(e)) return { ok: false, unknown: true, code: e.code ?? 'NETWORK' };
      return { ok: false, code: e.code ?? 'FAILED', message: e.tossMessage ?? '' };
    }
  }
  /** 결제 실패 반영: 첫 결제면 카드 등록을 지우고, 정기 결제면 하루 뒤 다시 (3번째 실패면 종료) */
  async function applyFailed(db, userId, payment, result, attempt) {
    await db.execute("UPDATE subscription_payments SET status='failed',failure_code=?,failure_message=? WHERE order_id=? AND status<>'done'", [String(result.code ?? 'FAILED').slice(0, 64), String(result.message ?? '').slice(0, 255), payment.order_id]);
    const [[cur]] = await db.execute('SELECT * FROM subscriptions WHERE user_id=? FOR UPDATE', [userId]);
    if (!cur) return null;
    if (cur.status === 'pending') { await db.execute("UPDATE subscriptions SET billing_key=NULL,card_label=NULL WHERE user_id=?", [userId]); return cur.billing_key; }
    if (attempt >= SUB_MAX_ATTEMPTS || cur.status === 'canceled') { await db.execute("UPDATE subscriptions SET status='ended',failed_attempts=?,next_charge_at=NULL,billing_key=NULL WHERE user_id=?", [attempt, userId]); return cur.billing_key; }
    await db.execute("UPDATE subscriptions SET status='past_due',failed_attempts=?,next_charge_at=? WHERE user_id=?", [attempt, new Date(now().getTime() + SUB_RETRY_MS), userId]);
    return null;
  }
  async function removeKey(billingKey) { if (billingKey && toss) await toss.removeKey(billingKey).catch((e) => log('Toss removeKey: ' + (e.code ?? e.message))); }
  async function verifyToken(t) {
    try { return await tokens.verify(t); }
    catch { throw new AuthError('billing_expired', 400); }
  }

  return {
    enabled,
    status: (header) => member(header, async (db, id) => view(await row(db, id))),
    /** 결제 페이지 주소 (20분 유효). 이미 구독 중이면 거절, 해지했지만 기간이 남았으면 '해지 취소'를 쓰게 함 */
    checkout: (header) => member(header, async (db, id) => {
      if (!enabled) throw new AuthError('billing_unavailable', 503);
      let r = await row(db, id, true);
      const status = effectiveStatus(r, now());
      if (status === 'active' || status === 'past_due') throw new AuthError('already_subscribed', 409);
      if (status === 'canceled') throw new AuthError('subscription_canceled', 409);
      if (!r) {
        r = { customer_key: randomUUID() };
        await db.execute("INSERT INTO subscriptions(user_id,status,customer_key,amount) VALUES (?,'pending',?,?)", [id, r.customer_key, SUB_PRICE]);
      } else {
        await db.execute("UPDATE subscriptions SET status='pending',amount=?,billing_key=NULL,failed_attempts=0,next_charge_at=NULL WHERE user_id=?", [SUB_PRICE, id]);
      }
      const t = await tokens.sign(id, r.customer_key);
      return { path: `/billing/start?t=${encodeURIComponent(t)}`, amount: SUB_PRICE };
    }),
    /** 결제 페이지에 넣을 값 */
    page: async (t) => { const p = await verifyToken(t); return { clientKey, customerKey: p.ck, amount: SUB_PRICE, t: String(t) }; },
    /** 토스 카드 등록 성공 → 빌링키 발급 → 첫 달 결제. 결과: {ok} 또는 {ok:false, code} */
    complete: async (t, customerKey, authKey) => {
      if (!enabled) return { ok: false, code: 'billing_unavailable' };
      const p = await verifyToken(t);
      if (customerKey !== p.ck || typeof authKey !== 'string' || !authKey || authKey.length > 300) return { ok: false, code: 'bad_request' };
      const userId = p.sub;
      const before = await withDb(async (db) => row(db, userId));
      if (!before || before.customer_key !== p.ck) return { ok: false, code: 'bad_request' };
      if (effectiveStatus(before, now()) === 'active') return { ok: true, already: true }; // 새로고침 · 두 번 돌아옴
      let issued;
      try { issued = await toss.issue(authKey, p.ck); } catch (e) { return { ok: false, code: e.code ?? 'ISSUE_FAILED' }; }
      const billingKey = issued?.billingKey;
      if (typeof billingKey !== 'string' || !billingKey) return { ok: false, code: 'ISSUE_FAILED' };
      const cardNo = typeof issued?.card?.number === 'string' ? issued.card.number.slice(0, 20) : '';
      const start = now(), payment = { order_id: `${orderIdFor(p.ck, start, 1)}-${randomBytes(3).toString('hex')}`, amount: SUB_PRICE, // 첫 결제는 카드 등록할 때마다 새 주문번호
        period_start: start, period_end: addMonth(start), status: 'new' };
      const sub = await withDb((db) => transaction(db, async () => {
        const r = await row(db, userId, true);
        if (!r || r.customer_key !== p.ck || r.status !== 'pending') return null;
        await db.execute('UPDATE subscriptions SET billing_key=?,card_label=? WHERE user_id=?', [billingKey, cardNo ? `카드 ${cardNo}` : '등록한 카드', userId]);
        await db.execute("INSERT INTO subscription_payments(order_id,user_id,amount,status,period_start,period_end) VALUES (?,?,?,'pending',?,?)", [payment.order_id, userId, payment.amount, payment.period_start, payment.period_end]);
        return { ...r, billing_key: billingKey };
      }));
      if (!sub) { await removeKey(billingKey); return { ok: false, code: 'bad_request' }; }
      const result = await charge(sub, payment);
      // 응답을 못 받았으면 결제 기록을 '확인 중'으로 두고 자동결제 작업이 토스에 다시 확인함
      if (result.unknown) { log('Subscription first charge: no response, will reconcile'); return { ok: false, code: 'PAYMENT_PENDING' }; }
      const removed = await withDb((db) => transaction(db, async () => {
        if (result.ok) { await applyPaid(db, userId, payment, result.paymentKey, result.approvedAt); return null; }
        return applyFailed(db, userId, payment, result, 1);
      }));
      if (!result.ok) { await removeKey(removed ?? billingKey); log(`Subscription first charge failed: ${result.code}`); }
      return result.ok ? { ok: true } : { ok: false, code: result.code };
    },
    /** 해지: 다음 결제를 안 함, 지금 기간 끝까지 프리미엄 */
    cancel: (header) => member(header, async (db, id) => {
      const r = await row(db, id, true), status = effectiveStatus(r, now());
      if (status === 'active') await db.execute("UPDATE subscriptions SET status='canceled',canceled_at=?,next_charge_at=NULL WHERE user_id=?", [now(), id]);
      else if (status === 'past_due') { await db.execute("UPDATE subscriptions SET status='ended',canceled_at=?,next_charge_at=NULL,billing_key=NULL WHERE user_id=?", [now(), id]); removeKey(r.billing_key); }
      else throw new AuthError('not_subscribed', 409);
      return view(await row(db, id));
    }),
    /** 해지 취소 (기간이 남았고 카드가 그대로일 때) */
    resume: (header) => member(header, async (db, id) => {
      const r = await row(db, id, true);
      if (effectiveStatus(r, now()) !== 'canceled' || !r.billing_key) throw new AuthError('not_canceled', 409);
      await db.execute("UPDATE subscriptions SET status='active',canceled_at=NULL,next_charge_at=current_period_end WHERE user_id=?", [id]);
      return view(await row(db, id));
    }),
    /** 결제일이 된 구독 자동결제 · 기간이 끝난 해지 구독 정리 (API 서버가 10분마다, 서버 여러 대여도 한 번만) */
    async renewDue({ limit = 50 } = {}) {
      const lockDb = await connectionFactory();
      let done = 0;
      try {
        const [[lock]] = await lockDb.query("SELECT GET_LOCK(SHA2(CONCAT(DATABASE(),':subscription_renewal'),256),0) AS ok");
        if (Number(lock.ok) !== 1) return 0;
        const at = now();
        // 첫 결제 응답을 못 받은 구독 (2분 지난 것): 토스에 주문번호로 확인 → 됐으면 시작, 없으면 다시 결제
        const [stuck] = await lockDb.execute("SELECT p.order_id,p.amount,p.period_start,p.period_end,p.status,s.user_id,s.billing_key,s.customer_key FROM subscription_payments p JOIN subscriptions s ON s.user_id=p.user_id WHERE p.status='pending' AND s.status='pending' AND s.billing_key IS NOT NULL AND p.created_at<=?", [new Date(at.getTime() - 120000)]);
        for (const x of stuck) {
          const result = await charge(x, x);
          if (result.unknown) continue;
          const removed = await withDb((db) => transaction(db, async () => {
            if (result.ok) { await applyPaid(db, x.user_id, x, result.paymentKey, result.approvedAt); return null; }
            return applyFailed(db, x.user_id, x, result, 1);
          }));
          await removeKey(removed);
          done++;
        }
        const [due] = await lockDb.execute(`SELECT * FROM subscriptions WHERE (status IN ('active','past_due') AND next_charge_at<=?) OR (status='canceled' AND current_period_end<=?) ORDER BY next_charge_at LIMIT ${Number(limit)}`, [at, at]);
        for (const r of due) {
          if (r.status === 'canceled') {
            await lockDb.execute("UPDATE subscriptions SET status='ended',billing_key=NULL WHERE user_id=? AND status='canceled'", [r.user_id]);
            await removeKey(r.billing_key); done++; continue;
          }
          if (!toss || !r.billing_key) continue;
          const attempt = Number(r.failed_attempts) + 1, start = instant(r.current_period_end);
          const payment = { order_id: orderIdFor(r.customer_key, start, attempt), amount: r.amount, period_start: start, period_end: addMonth(start) };
          const [ins] = await lockDb.execute("INSERT IGNORE INTO subscription_payments(order_id,user_id,amount,status,period_start,period_end) VALUES (?,?,?,'pending',?,?)", [payment.order_id, r.user_id, payment.amount, start, payment.period_end]);
          const [[saved]] = await lockDb.execute('SELECT status FROM subscription_payments WHERE order_id=?', [payment.order_id]);
          if (saved?.status !== 'pending') continue; // 이미 끝난 시도 (다음 정리 때 반영됨)
          // 새로 만든 시도면 바로 결제, 예전에 응답을 못 받은 시도면 토스에 먼저 확인
          payment.status = ins.affectedRows ? 'new' : 'pending';
          const result = await charge(r, payment);
          // 응답을 못 받음: 실패로 치지 않고 10분 뒤 같은 주문번호로 토스에 확인
          if (result.unknown) { await lockDb.execute('UPDATE subscriptions SET next_charge_at=? WHERE user_id=?', [new Date(now().getTime() + 10 * 60000), r.user_id]); continue; }
          const removed = await withDb((db) => transaction(db, async () => {
            if (result.ok) { await applyPaid(db, r.user_id, payment, result.paymentKey, result.approvedAt); return null; }
            return applyFailed(db, r.user_id, payment, result, attempt);
          }));
          await removeKey(removed);
          done++;
        }
        return done;
      } finally {
        await lockDb.query("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(),':subscription_renewal'),256))").catch(() => {});
        await lockDb.end();
      }
    },
  };
}
