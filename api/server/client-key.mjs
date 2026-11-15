// 요청 제한(rate limit)을 셀 때 쓰는 키.
// Nginx 뒤에서는 모든 요청의 소켓 주소가 127.0.0.1로 같아서, 주소로만 세면 전체 사용자가 한 칸을 같이 씀.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** 실제 접속한 사용자 주소. 같은 서버의 Nginx를 거친 요청이면 Nginx가 붙인 X-Forwarded-For의 마지막 값을 씀 */
export function clientIp(req) {
  const addr = req.socket?.remoteAddress ?? '';
  if (LOOPBACK.has(addr)) {
    const fwd = req.headers['x-forwarded-for'];
    // Nginx의 $proxy_add_x_forwarded_for는 실제 주소를 맨 뒤에 붙임 (앞쪽 값은 사용자가 꾸밀 수 있음)
    if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',').at(-1).trim();
  }
  return addr;
}

/** 로그인 토큰의 사용자 id (서명은 확인하지 않음 — 키를 나누는 용도로만 씀. 가짜 토큰은 서비스에서 DB 전에 서명 확인으로 막힘) */
export function tokenSubject(req) {
  const m = /^Bearer\s+[\w-]+\.([\w-]+)\.[\w-]+$/.exec(req.headers.authorization ?? '');
  if (!m) return null;
  try {
    const sub = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).sub;
    return typeof sub === 'string' && sub.length <= 64 ? sub : null;
  } catch {
    return null;
  }
}

/** 로그인한 요청은 회원별로, 아니면 실제 주소별로 셈 */
export function rateKey(req) {
  const sub = tokenSubject(req);
  return sub ? `m:${sub}` : `ip:${clientIp(req)}`;
}
