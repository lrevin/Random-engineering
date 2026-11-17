-- 스터디 팀(2~4명, 주제 상관없음, 주간 목표 보상)과 오답 보스전(관심 분야 사람들이 자주 틀린 50문제, 주 1회). V1~V8은 그대로 둔다.
-- 팀: mode 'open' = 친구와 들어가고 빈자리는 다른 사람이 채움 · 'friends' = 친구끼리만 (모르는 사람은 안 들어옴)
CREATE TABLE study_teams (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 mode VARCHAR(8) NOT NULL,
 leader_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 member_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY teams_open(mode,member_count),
 FOREIGN KEY(leader_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT teams_mode_ck CHECK(mode IN ('open','friends')),
 CONSTRAINT teams_size_ck CHECK(member_count<=4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- 한 사람은 한 팀에만
CREATE TABLE study_team_members (
 team_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY team_members(team_id,joined_at),
 FOREIGN KEY(team_id) REFERENCES study_teams(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- 친구 초대: 팀을 꾸리기 전(수락한 친구와 같이 들어감) 또는 내 팀에 빈자리가 있을 때(수락하면 바로 들어옴)
CREATE TABLE study_team_invites (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 leader_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 invitee_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(10) NOT NULL DEFAULT 'pending',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 responded_at DATETIME(3) NULL,
 UNIQUE KEY invite_pair(leader_id,invitee_id),
 KEY invite_invitee(invitee_id,status),
 FOREIGN KEY(leader_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(invitee_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT invite_pair_ck CHECK(leader_id<>invitee_id),
 CONSTRAINT invite_status_ck CHECK(status IN ('pending','accepted','declined','canceled','used'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- 주간 목표 보상 (한 사람이 한 주에 한 번)
CREATE TABLE study_team_rewards (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 week_start DATE NOT NULL,
 team_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 reward_gears SMALLINT UNSIGNED NOT NULL,
 reward_xp SMALLINT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,week_start),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT team_reward_ck CHECK(reward_gears<=100 AND reward_xp<=200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- 오답 보스전: 한 사람이 한 주에 한 판 (week_start 유일)
CREATE TABLE boss_runs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 week_start DATE NOT NULL,
 questions JSON NOT NULL,
 next_position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 boss_hp SMALLINT UNSIGNED NOT NULL,
 boss_max_hp SMALLINT UNSIGNED NOT NULL,
 player_hp TINYINT UNSIGNED NOT NULL DEFAULT 100,
 status VARCHAR(8) NOT NULL DEFAULT 'issued',
 reward_gears SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 reward_xp SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 rare_drop BOOLEAN NOT NULL DEFAULT FALSE,
 started_at DATETIME(3) NOT NULL,
 finished_at DATETIME(3) NULL,
 UNIQUE KEY boss_week(user_id,week_start),
 UNIQUE KEY boss_request(user_id,request_id),
 KEY boss_user_status(user_id,status),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT boss_status_ck CHECK(status IN ('issued','cleared','failed')),
 CONSTRAINT boss_hp_ck CHECK(boss_hp<=boss_max_hp AND player_hp<=100 AND reward_gears<=100 AND reward_xp<=200),
 CONSTRAINT boss_questions_ck CHECK(JSON_TYPE(questions)='ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE boss_answers (
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 position SMALLINT UNSIGNED NOT NULL,
 submitted_answer TINYINT UNSIGNED NOT NULL,
 is_correct BOOLEAN NOT NULL,
 response_json JSON NOT NULL,
 received_at DATETIME(3) NOT NULL,
 PRIMARY KEY(run_id,position),
 FOREIGN KEY(run_id) REFERENCES boss_runs(id) ON DELETE CASCADE,
 CONSTRAINT boss_answer_ck CHECK(submitted_answer BETWEEN 0 AND 3 AND position<50 AND is_correct IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- 보스전 클리어 전용 테마(0.01%)를 꾸미기 보관함에 넣을 수 있게
ALTER TABLE member_cosmetics DROP CHECK cosmetic_source_ck,
 ADD CONSTRAINT cosmetic_source_ck CHECK(acquired_via IN ('default','purchase','streak','achievement','admin','boss'));
