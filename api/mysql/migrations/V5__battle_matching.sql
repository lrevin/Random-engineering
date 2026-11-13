CREATE TABLE battles (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_a CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_b CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'accepted',
 state_json JSON NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 finished_at DATETIME(3) NULL,
 KEY battles_a(user_a,status),KEY battles_b(user_b,status),
 FOREIGN KEY(user_a) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(user_b) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
 CONSTRAINT battles_pair_ck CHECK(user_a<>user_b),
 CONSTRAINT battles_status_ck CHECK(status IN ('accepted','finished','void')),
 CONSTRAINT battles_state_ck CHECK(JSON_TYPE(state_json)='OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE match_entries (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 candidates JSON NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'waiting',
 ticket_kind VARCHAR(8) NOT NULL,
 ticket_month CHAR(7) NOT NULL,
 joined_at DATETIME(3) NOT NULL,
 last_seen_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 battle_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 active_slot TINYINT GENERATED ALWAYS AS (IF(status IN ('waiting','matched'),1,NULL)) STORED,
 UNIQUE KEY match_request(user_id,request_id),UNIQUE KEY match_active(user_id,active_slot),
 KEY match_waiting(status,joined_at,id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(battle_id) REFERENCES battles(id) ON DELETE SET NULL,
 CONSTRAINT match_status_ck CHECK(status IN ('waiting','matched','canceled','expired','completed','invalid')),
 CONSTRAINT match_ticket_ck CHECK(ticket_kind IN ('free','bought','premium')),
 CONSTRAINT match_candidates_ck CHECK(JSON_TYPE(candidates)='ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE study_records DROP CHECK records_score_ck, DROP CHECK records_rp_ck;
ALTER TABLE study_records MODIFY rp INT NOT NULL,
 ADD study_type VARCHAR(8) NOT NULL DEFAULT 'study',
 ADD battle_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD rank_score TINYINT UNSIGNED NULL,
 ADD UNIQUE KEY records_battle_user(battle_id,user_id),
 ADD FOREIGN KEY(battle_id) REFERENCES battles(id) ON DELETE SET NULL,
 ADD CONSTRAINT records_type_ck CHECK(study_type IN ('study','battle')),
 ADD CONSTRAINT records_score_ck CHECK(quiz_total BETWEEN 5 AND 10 AND score<=quiz_total AND (rank_score IS NULL OR rank_score<=5)),
 ADD CONSTRAINT records_rp_ck CHECK((study_type='study' AND rp BETWEEN 0 AND 1000) OR (study_type='battle' AND rp BETWEEN -100 AND 100));
ALTER TABLE quiz_attempt_items DROP CHECK attempt_items_position_ck,
 ADD CONSTRAINT attempt_items_position_ck CHECK(position BETWEEN 1 AND 10);
ALTER TABLE xp_ledger DROP CHECK ledger_event_ck;
ALTER TABLE xp_ledger ADD source_type VARCHAR(8) NOT NULL DEFAULT 'study',
 ADD CONSTRAINT ledger_source_ck CHECK(source_type IN ('study','battle')),
 ADD CONSTRAINT ledger_event_ck CHECK(
 (event_type='award' AND reverses_entry_id IS NULL AND ((source_type='study' AND amount>=0) OR (source_type='battle' AND amount BETWEEN -100 AND 100)))
 OR (event_type='reversal' AND source_type='study' AND amount<=0 AND reverses_entry_id IS NOT NULL));
