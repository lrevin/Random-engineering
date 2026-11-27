import test from 'node:test';
import assert from 'node:assert/strict';
import { adminGrant, parseAdminArgs } from '../mysql/admin-grant.mjs';

test('admin-grant 인자 읽기', () => {
  assert.deepEqual(parseAdminArgs(['jry9ffxg', '--gears', '999999', '--premium']), { code: 'JRY9FFXG', gears: 999999, premium: true, premiumTickets: null });
  assert.deepEqual(parseAdminArgs(['JRY9FFXG', '--premium', 'off', '--gears', '1500', '--premium-tickets', '1']), { code: 'JRY9FFXG', gears: 1500, premium: false, premiumTickets: 1 });
  assert.throws(() => parseAdminArgs(['JRY9FFXG', '--premium-tickets', '-1']));
  assert.deepEqual(parseAdminArgs(['JRY9FFXG', '--premium', 'off']), { code: 'JRY9FFXG', gears: null, premium: false, premiumTickets: null });
  assert.throws(() => parseAdminArgs(['JRY9FFXG']));
  assert.throws(() => parseAdminArgs(['nope', '--premium']));
  assert.throws(() => parseAdminArgs(['JRY9FFXG', '--gears', '-1']));
});

test('admin-grant: 잔액 맞추기 + 원장 기록 + 프리미엄 상태 저장 (가짜 DB)', async () => {
  const calls = [];
  const db = {
    async execute(sql, args) {
      calls.push([sql.replace(/\s+/g, ' ').slice(0, 40), args]);
      if (sql.includes('FROM social_members')) return [[{ user_id: 'u1' }]];
      if (sql.includes('SELECT balance FROM wallets')) return [[{ balance: 30 }]];
      if (sql.includes('FROM wallet_operations')) return [[]];
      if (sql.includes('SELECT * FROM member_assets')) return [[{exam_tickets:0,exam_usage_date:null,exam_free_used:0,boost_until:null}]];
      if (sql.includes('FROM member_cosmetics')) return [[{item_type:'skin',item_id:'classic',is_equipped:1}]];
      if (sql.includes("reason='quest'") || sql.includes("reason='ad_reward'")) return [sql.includes('COUNT') ? [{ n: 0 }] : []];
      return [[]];
    },
    async beginTransaction() {}, async commit() {}, async rollback() {}, async query() { return [[]]; }, async end() {},
  };
  const r = await adminGrant({ code: 'JRY9FFXG', gears: 999999, premium: true }, { connectionFactory: async () => db });
  assert.deepEqual(r, { userId: 'u1', balance: 999999, premium: true, premiumTickets: 0, subscribed: false });
  const tx = calls.find(([s]) => s.startsWith('INSERT INTO wallet_transactions'));
  assert.equal(tx[1][1], 999999 - 30);
  const op = calls.find(([s]) => s.startsWith('INSERT INTO wallet_operations'));
  assert.equal(JSON.parse(op[1][5]).state.premium, true);
});
