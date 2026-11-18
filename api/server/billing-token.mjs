import { SignJWT, jwtVerify } from 'jose';

/** 결제 페이지용 짧은 서명 토큰 (회원 id + 토스 customerKey, 20분). JWT_SECRET 에서 따로 만든 키로 서명 */
export function billingTokens(secret = process.env.JWT_SECRET) {
  const key = new TextEncoder().encode(`billing:${secret}`);
  return {
    sign: (userId, customerKey) => new SignJWT({ ck: customerKey }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setAudience('billing').setIssuedAt().setExpirationTime('20m').sign(key),
    verify: async (t) => (await jwtVerify(String(t ?? ''), key, { algorithms: ['HS256'], audience: 'billing' })).payload,
  };
}
