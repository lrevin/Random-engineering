-- 비밀번호 찾기 · 예약 알림 기록
-- password_resets: 이메일로 보낸 6자리 확인 코드 (코드는 해시로만 저장, 15분 · 5번 틀리면 끝)
-- notification_log: 같은 알림을 두 번 보내지 않게 (콕 찌르기 하루 1번, 주간 리포트 · 팀 응원 주 1번)

CREATE TABLE password_resets (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 email VARCHAR(254) NOT NULL,
 code_hash BINARY(32) NOT NULL,
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 expires_at DATETIME(3) NOT NULL,
 used_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY reset_email(email,created_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_log (
 kind VARCHAR(20) NOT NULL,
 ref VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 period VARCHAR(16) NOT NULL,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(kind,ref,period),
 KEY notification_user(user_id,created_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
