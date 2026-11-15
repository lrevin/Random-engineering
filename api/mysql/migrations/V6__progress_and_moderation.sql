-- 기기에만 있던 학습 진행(모의고사 · 오답 해결 · 복습 · 자격증 시험일)을 계정에 보관
CREATE TABLE user_progress (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 value JSON NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 PRIMARY KEY(user_id,name),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT progress_name_ck CHECK(name IN ('exam','reviewDone','recall','certDates'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 분야별 랭킹: 내 닉네임 숨기기
ALTER TABLE profiles ADD leaderboard_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- 닉네임 신고 (서로 다른 3명이 신고하면 랭킹에서 닉네임을 가림, 닉네임을 바꾸면 초기화)
CREATE TABLE nickname_reports (
 reporter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 target_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 reason VARCHAR(12) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(reporter_id,target_id),
 KEY nickname_reports_target(target_id),
 FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT nickname_reports_pair_ck CHECK(reporter_id<>target_id),
 CONSTRAINT nickname_reports_reason_ck CHECK(reason IN ('offensive','spam','other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
