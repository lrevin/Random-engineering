-- 특수 보상 증거는 기존 풀이·지갑 구조를 확장해 보관한다. V1~V7은 유지한다.
CREATE TABLE daily_topic_assignments (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 assignment_date DATE NOT NULL,
 topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,assignment_date),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE quiz_attempts
 MODIFY topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD purpose VARCHAR(16) NOT NULL DEFAULT 'study',
 ADD certificate_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD request_hash BINARY(32) NULL,
 ADD rule_version VARCHAR(20) NOT NULL DEFAULT 'legacy',
 ADD study_ended_at DATETIME(3) NULL,
 ADD allowed_sec INT UNSIGNED NOT NULL DEFAULT 0,
 ADD paused_sec INT UNSIGNED NOT NULL DEFAULT 0,
 ADD paused_at DATETIME(3) NULL,
 ADD study_sec INT UNSIGNED NOT NULL DEFAULT 0,
 ADD quiz_sec INT UNSIGNED NULL,
 ADD UNIQUE KEY attempts_request(user_id,purpose,request_id),
 ADD KEY attempts_evidence(user_id,purpose,status,completed_at),
 ADD FOREIGN KEY(certificate_id) REFERENCES certificates(id) ON DELETE RESTRICT,
 ADD CONSTRAINT attempts_purpose_ck CHECK(purpose IN ('study','battle','recall','exam','review'));
UPDATE quiz_attempts a JOIN study_records r ON r.attempt_id=a.id SET a.purpose='battle' WHERE r.study_type='battle';
ALTER TABLE quiz_attempt_items DROP CHECK attempt_items_position_ck,
 MODIFY position SMALLINT UNSIGNED NOT NULL,
 ADD topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD subject_position SMALLINT UNSIGNED NULL,
 ADD source_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD source_position SMALLINT UNSIGNED NULL,
 ADD resolved_at DATETIME(3) NULL,
 ADD KEY items_wrong(is_correct,resolved_at,attempt_id),
 ADD FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
 ADD CONSTRAINT items_source_pair_ck CHECK((source_attempt_id IS NULL AND source_position IS NULL) OR (source_attempt_id IS NOT NULL AND source_position IS NOT NULL)),
 ADD CONSTRAINT attempt_items_position_ck CHECK(position BETWEEN 1 AND 500);
ALTER TABLE quiz_attempt_items ADD CONSTRAINT items_source_fk FOREIGN KEY(source_attempt_id,source_position) REFERENCES quiz_attempt_items(attempt_id,position) ON DELETE RESTRICT;
UPDATE quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id SET i.topic_id=a.topic_id;
ALTER TABLE study_records ADD hidden_at DATETIME(3) NULL,
 ADD KEY records_visibility(user_id,hidden_at,studied_at,id);

-- 미공유 V8 확장: 일반 보상 판정. 기존 지급은 보존하고 미정산 기록은 보류한다.
ALTER TABLE study_records
 ADD reward_status VARCHAR(20) NOT NULL DEFAULT 'held',
 ADD reward_policy_version VARCHAR(32) NOT NULL DEFAULT 'general-v1',
 ADD reward_reason VARCHAR(64) NULL DEFAULT 'unclassified',
 ADD reward_processed_at DATETIME(3) NULL,
 ADD KEY records_rewards(user_id,reward_status,study_date),
 ADD CONSTRAINT records_reward_status_ck CHECK(reward_status IN ('eligible','held','ineligible','legacy_granted'));
UPDATE study_records r JOIN xp_ledger l ON l.user_id=r.user_id AND l.source_record_id=r.id AND l.event_type='award'
 SET r.reward_status='legacy_granted',r.reward_policy_version='legacy',r.reward_reason=NULL,r.reward_processed_at=l.created_at;
