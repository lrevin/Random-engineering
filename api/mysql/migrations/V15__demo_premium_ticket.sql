-- 최종 발표 시연 준비 (데이터만 바꿈, 표 구조 변경 없음)
-- 팀장 시연 계정(UID JRY9FFXG)을 일반 회원으로 되돌리고, 톱니바퀴 1,500개 + 뽑공 프리미엄 티켓 1장을 줌.
-- 시연 중 설정 > 뽑공 프리미엄 티켓 > 티켓 사용하기 → 30일 프리미엄으로 바로 전환.
-- 그 계정이 없는 DB(로컬 · 시험)에서는 아무것도 바꾸지 않음.

SET @uid := (SELECT m.user_id FROM social_members m JOIN users u ON u.id = m.user_id AND u.status = 'active' WHERE m.friend_code = 'JRY9FFXG');

-- 시험 구독이 있으면 지금 끝냄 (구독 때문에 프리미엄으로 남지 않게)
UPDATE subscriptions
   SET status = 'ended',
       current_period_end = LEAST(COALESCE(current_period_end, UTC_TIMESTAMP(3)), UTC_TIMESTAMP(3)),
       next_charge_at = NULL,
       canceled_at = COALESCE(canceled_at, UTC_TIMESTAMP(3))
 WHERE user_id = @uid AND status <> 'ended';

-- 톱니바퀴 1,500개로 맞추고 원장에 남김
INSERT IGNORE INTO wallets (user_id, balance) SELECT @uid, 30 FROM DUAL WHERE @uid IS NOT NULL;
SET @old := (SELECT balance FROM wallets WHERE user_id = @uid);
UPDATE wallets SET balance = 1500 WHERE user_id = @uid;
INSERT INTO wallet_transactions (user_id, amount, reason, request_id)
SELECT @uid, 1500 - CAST(@old AS SIGNED), 'admin_grant', 'migration:V15-demo' FROM DUAL WHERE @uid IS NOT NULL AND @old <> 1500;

-- 지갑 상태: 마지막 상태를 이어받아 프리미엄 끔 + 티켓 1장
SET @state := (SELECT JSON_EXTRACT(result_json, '$.state') FROM wallet_operations
                WHERE user_id = @uid AND JSON_TYPE(JSON_EXTRACT(result_json, '$.state')) = 'OBJECT' ORDER BY id DESC LIMIT 1);
SET @state := COALESCE(@state, '{"freezes":0,"boughtTickets":0,"freeTickets":2,"month":"","premium":false,"keptDays":[]}');
SET @state := JSON_SET(CAST(@state AS JSON),
  '$.premium', CAST('false' AS JSON), '$.grantedPremium', CAST('false' AS JSON), '$.subscribed', CAST('false' AS JSON),
  '$.ticketPremium', CAST('false' AS JSON), '$.premiumUntil', CAST('null' AS JSON), '$.premiumTickets', 1);
INSERT INTO wallet_operations (user_id, request_id, request_hash, action, payload, result_json)
SELECT @uid, 'migration:V15-demo', UNHEX(SHA2('migration:V15-demo', 256)), 'admin_grant',
       JSON_OBJECT('gears', 1500, 'premium', CAST('false' AS JSON), 'premiumTickets', 1),
       JSON_OBJECT('balance', 1500, 'state', CAST(@state AS JSON))
  FROM DUAL WHERE @uid IS NOT NULL;
