CREATE TABLE social_members (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 friend_code CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE social_friendships (
 user_low CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_high CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(10) NOT NULL DEFAULT 'pending',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_low,user_high),
 FOREIGN KEY(user_low) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(user_high) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT social_pair_ck CHECK(user_low < user_high AND requested_by IN (user_low,user_high)),
 CONSTRAINT social_status_ck CHECK(status IN ('pending','accepted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
