-- 뽑공 프리미엄 월 구독 (토스페이먼츠 카드 자동결제)
-- subscriptions: 회원마다 한 줄. pending(카드 등록 전) · active(매달 자동결제) · canceled(해지, 지금 기간 끝까지 이용) · past_due(결제 실패 재시도 중) · ended(끝)
--   프리미엄 여부는 current_period_end > 지금 으로 판단 (wallet-state.mjs)
--   billing_key 는 토스가 발급한 자동결제 키 (앱에 절대 보내지 않음). 카드 번호는 저장하지 않고 토스가 가린 번호 일부만 card_label 에
-- subscription_payments: 결제 시도마다 한 줄 (order_id 는 토스 주문번호, 같은 주문번호로 두 번 결제되지 않음)

CREATE TABLE subscriptions (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 plan VARCHAR(30) NOT NULL DEFAULT 'premium_monthly',
 status VARCHAR(12) NOT NULL DEFAULT 'pending',
 customer_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 billing_key VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NULL,
 card_label VARCHAR(60) NULL,
 amount INT NOT NULL,
 current_period_start DATETIME(3) NULL,
 current_period_end DATETIME(3) NULL,
 next_charge_at DATETIME(3) NULL,
 failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 canceled_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY subscription_customer(customer_key),
 KEY subscription_due(status,next_charge_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT subscription_status_ck CHECK(status IN ('pending','active','canceled','past_due','ended')),
 CONSTRAINT subscription_amount_ck CHECK(amount>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE subscription_payments (
 order_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 amount INT NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'pending',
 payment_key VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NULL,
 failure_code VARCHAR(64) NULL,
 failure_message VARCHAR(255) NULL,
 period_start DATETIME(3) NOT NULL,
 period_end DATETIME(3) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 approved_at DATETIME(3) NULL,
 KEY payments_user(user_id,created_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT payment_status_ck CHECK(status IN ('pending','done','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
