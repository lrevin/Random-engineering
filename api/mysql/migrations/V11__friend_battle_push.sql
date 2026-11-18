-- 친구에게 1:1 배틀 신청 · 푸시 알림 토큰
-- battle_challenges: 친구에게 보낸 배틀 신청. 신청한 사람의 배틀권은 신청할 때 예약하고, 거절 · 취소 · 만료되면 돌려줌.
--   수락하면 두 사람의 match_entries(status='matched')와 battles 를 만들어 기존 배틀 진행 · 정산을 그대로 씀.
-- push_tokens: 기기의 Expo 푸시 토큰 (한 기기 토큰은 한 회원에게만)

CREATE TABLE battle_challenges (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 from_user CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 to_user CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'pending',
 from_entry_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 ticket_kind VARCHAR(8) NOT NULL,
 ticket_month CHAR(7) NOT NULL,
 battle_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 expires_at DATETIME(3) NOT NULL,
 responded_at DATETIME(3) NULL,
 pending_slot TINYINT GENERATED ALWAYS AS (IF(status='pending',1,NULL)) STORED,
 UNIQUE KEY challenge_request(from_user,request_id),
 UNIQUE KEY challenge_one_pending(from_user,pending_slot),
 KEY challenge_to(to_user,status),
 KEY challenge_pending(status,expires_at),
 FOREIGN KEY(from_user) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(to_user) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(battle_id) REFERENCES battles(id) ON DELETE SET NULL,
 CONSTRAINT challenge_status_ck CHECK(status IN ('pending','accepted','declined','canceled','expired')),
 CONSTRAINT challenge_pair_ck CHECK(from_user<>to_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE push_tokens (
 token VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 platform VARCHAR(10) NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 KEY push_user(user_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT push_platform_ck CHECK(platform IN ('android','ios'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
