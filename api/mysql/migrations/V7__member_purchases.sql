-- 회원 구매 자산과 영구 소유 꾸미기. 기존 지갑 원장·요청 이력을 재사용한다.
CREATE TABLE member_assets (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 exam_tickets TINYINT UNSIGNED NOT NULL DEFAULT 0,
 exam_usage_date DATE NULL,
 exam_free_used TINYINT UNSIGNED NOT NULL DEFAULT 0,
 boost_until DATETIME(3) NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT assets_ticket_ck CHECK(exam_tickets<=5),
 CONSTRAINT assets_exam_free_ck CHECK(exam_free_used<=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE member_cosmetics (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 item_type VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 item_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
 acquired_via VARCHAR(20) NOT NULL,
 acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 equipped_type VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (IF(is_equipped,item_type,NULL)) STORED,
 PRIMARY KEY(user_id,item_type,item_id),
 UNIQUE KEY cosmetic_equipped(user_id,equipped_type),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT cosmetic_type_ck CHECK(item_type IN ('skin','title')),
 CONSTRAINT cosmetic_equipped_ck CHECK(is_equipped IN (0,1)),
 CONSTRAINT cosmetic_source_ck CHECK(acquired_via IN ('default','purchase','streak','achievement','admin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO member_assets(user_id) SELECT id FROM users;
INSERT INTO member_cosmetics(user_id,item_type,item_id,is_equipped,acquired_via)
 SELECT id,'skin','classic',TRUE,'default' FROM users;
