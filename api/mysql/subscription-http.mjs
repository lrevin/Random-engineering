import { AuthError } from '../server/auth.mjs';
import { rateKey, clientIp, overLimit } from '../server/client-key.mjs';

/** 결제가 끝나면 돌아갈 앱 주소 (앱의 WebBrowser.openAuthSessionAsync 가 이 주소를 기다림) */
export const BILLING_APP_RETURN = 'ppobgong://billing';
const esc = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** 토스페이먼츠 결제창으로 카드를 등록하는 작은 페이지 (서버가 만든 값만 넣음, 이모지 없음) */
export function billingPage({ clientKey, customerKey, amount, t }) {
  const cfg = esc({ clientKey, customerKey, t });
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>뽑공 프리미엄 구독</title>
<script src="https://js.tosspayments.com/v2/standard"></script>
<style>
body{margin:0;padding:32px 20px;font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;background:#f3e7d3;color:#1d2742;text-align:center}
.card{max-width:420px;margin:0 auto;background:#fffaf0;border-radius:20px;padding:28px 22px;box-shadow:0 4px 0 #e2cfae}
h1{font-size:24px;margin:0 0 6px}.price{font-size:30px;font-weight:800;margin:14px 0 4px}.sub{color:#5b6280;font-size:14px;line-height:1.6}
button{margin-top:22px;width:100%;border:0;border-radius:16px;padding:16px;font-size:17px;font-weight:700;background:#1d2742;color:#fffaf0;box-shadow:0 4px 0 #0e1428}
#msg{margin-top:14px;color:#e0453a;font-size:14px;min-height:20px}
</style></head><body><div class="card">
<h1>뽑공 프리미엄</h1>
<div class="price">월 ${Number(amount).toLocaleString('ko-KR')}원</div>
<div class="sub">카드를 등록하면 바로 첫 달이 결제되고<br>한 달마다 자동으로 결제돼요. 언제든 앱에서 해지할 수 있어요.</div>
<button id="go">카드 등록하고 구독하기</button><div id="msg"></div>
</div>
<script>
const cfg=${cfg};
const here=(name)=>new URL(name+"?t="+encodeURIComponent(cfg.t),location.href).href;
async function go(){
  document.getElementById("msg").textContent="";
  try{
    const payment=TossPayments(cfg.clientKey).payment({customerKey:cfg.customerKey});
    await payment.requestBillingAuth({method:"CARD",successUrl:here("success"),failUrl:here("fail")});
  }catch(e){document.getElementById("msg").textContent=(e&&e.message)||"결제창을 열지 못했어요. 다시 눌러 주세요.";}
}
document.getElementById("go").addEventListener("click",go);
go();
</script></body></html>`;
}

export function subscriptionRoutes(service) {
  const hits = new Map();
  return async (req, path, send, raw) => {
    const isMe = path === '/me/subscription' || path.startsWith('/me/subscription/'), isPage = path.startsWith('/billing/');
    if (!isMe && !isPage) return false;
    const reply = (n, b) => send(n, b, { 'Cache-Control': 'no-store' });
    const back = (params) => send(302, undefined, { Location: `${BILLING_APP_RETURN}?${new URLSearchParams(params)}`, 'Cache-Control': 'no-store' });
    if (overLimit(hits, isMe ? rateKey(req) : `ip:${clientIp(req)}`, isMe ? 60 : 30)) { if (isPage) back({ result: 'fail', code: 'rate_limited' }); else reply(429, { error: 'rate_limited' }); return true; }
    const q = new URL(req.url, 'http://local').searchParams, h = req.headers.authorization, m = req.method;
    try {
      if (path === '/me/subscription' && m === 'GET') reply(200, await service.status(h));
      else if (path === '/me/subscription/checkout' && m === 'POST') reply(200, await service.checkout(h));
      else if (path === '/me/subscription/cancel' && m === 'POST') reply(200, await service.cancel(h));
      else if (path === '/me/subscription/resume' && m === 'POST') reply(200, await service.resume(h));
      else if (path === '/billing/start' && m === 'GET') {
        if (!service.enabled) { back({ result: 'fail', code: 'billing_unavailable' }); return true; }
        const html = billingPage(await service.page(q.get('t')));
        raw(200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
      } else if (path === '/billing/success' && m === 'GET') {
        const r = await service.complete(q.get('t'), q.get('customerKey'), q.get('authKey'));
        back(r.ok ? { result: 'success' } : { result: 'fail', code: r.code });
      } else if (path === '/billing/fail' && m === 'GET') {
        // 사용자가 창을 닫으면 PAY_PROCESS_CANCELED
        back({ result: q.get('code') === 'PAY_PROCESS_CANCELED' ? 'cancel' : 'fail', code: String(q.get('code') ?? 'UNKNOWN').slice(0, 64) });
      } else reply(405, { error: 'method_not_allowed' });
    } catch (e) {
      if (!(e instanceof AuthError)) throw e;
      if (isPage) back({ result: 'fail', code: e.code }); else reply(e.status, { error: e.code });
    }
    return true;
  };
}
