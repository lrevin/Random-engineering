import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, rateKey, tokenSubject } from './client-key.mjs';

const req = (addr, headers = {}) => ({ socket: { remoteAddress: addr }, headers });
const token = (sub) => `Bearer h.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.s`;

test('Nginx 뒤 요청은 X-Forwarded-For 마지막 값(실제 주소)으로 셈', () => {
  assert.equal(clientIp(req('127.0.0.1', { 'x-forwarded-for': '1.1.1.1, 203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(req('::1', { 'x-forwarded-for': '198.51.100.7' })), '198.51.100.7');
});

test('Nginx를 거치지 않은 요청은 사용자가 보낸 X-Forwarded-For를 믿지 않음', () => {
  assert.equal(clientIp(req('203.0.113.5', { 'x-forwarded-for': '9.9.9.9' })), '203.0.113.5');
});

test('로그인한 요청은 회원별, 아니면 주소별 키', () => {
  assert.equal(tokenSubject(req('127.0.0.1', { authorization: token('u-1') })), 'u-1');
  assert.equal(rateKey(req('127.0.0.1', { authorization: token('u-1') })), 'm:u-1');
  assert.equal(rateKey(req('127.0.0.1', { authorization: 'Bearer not-a-jwt', 'x-forwarded-for': '203.0.113.9' })), 'ip:203.0.113.9');
  assert.equal(rateKey(req('127.0.0.1')), 'ip:127.0.0.1');
});
