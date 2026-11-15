CREATE TABLE speed_runs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 reward_day DATE NOT NULL,
 started_at DATETIME(3) NOT NULL,
 deadline_at DATETIME(3) NOT NULL,
 questions JSON NOT NULL,
 next_position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 correct_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 status VARCHAR(10) NOT NULL DEFAULT 'issued',
 awarded_xp SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 result_json JSON NULL,
 completed_at DATETIME(3) NULL,
 UNIQUE KEY speed_request(user_id,request_id),
 KEY speed_user_day(user_id,reward_day,status),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT speed_status_ck CHECK(status IN ('issued','completed')),
 CONSTRAINT speed_limits_ck CHECK(correct_count<=next_position AND next_position<=100 AND awarded_xp<=150),
 CONSTRAINT speed_questions_ck CHECK(JSON_TYPE(questions)='ARRAY'),
 CONSTRAINT speed_deadline_ck CHECK(deadline_at>started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE speed_answers (
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 position SMALLINT UNSIGNED NOT NULL,
 submitted_answer TINYINT UNSIGNED NOT NULL,
 is_correct BOOLEAN NOT NULL,
 response_json JSON NOT NULL,
 received_at DATETIME(3) NOT NULL,
 PRIMARY KEY(run_id,position),
 FOREIGN KEY(run_id) REFERENCES speed_runs(id) ON DELETE CASCADE,
 CONSTRAINT speed_answer_ck CHECK(submitted_answer BETWEEN 0 AND 3 AND position<100 AND is_correct IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
