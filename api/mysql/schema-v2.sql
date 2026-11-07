-- Ppobgong v2 initial schema, MySQL 8.4 LTS.
-- Select a NEW EMPTY test database before running. No DROP or IF NOT EXISTS:
-- this is an initial installation, not an upgrade of api/mysql/schema.sql.
-- Application rules (ownership, grading, immutable completion, XP calculation,
-- refresh rotation, memo conflict handling) still require API transactions.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

CREATE TABLE users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  auth_version INT UNSIGNED NOT NULL DEFAULT 1,
  email_verified_at DATETIME(3) NULL,
  phone_verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deletion_requested_at DATETIME(3) NULL,
  KEY users_deletion (status, deletion_requested_at),
  CONSTRAINT users_status_ck CHECK ((status='active' AND deletion_requested_at IS NULL) OR (status='deleting' AND deletion_requested_at IS NOT NULL)),
  CONSTRAINT users_version_ck CHECK (auth_version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE auth_identities (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider_subject VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
  email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY identities_provider_subject (provider, provider_subject),
  UNIQUE KEY identities_user_provider (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT identities_provider_ck CHECK ((provider='email' AND email IS NOT NULL AND password_hash IS NOT NULL) OR (provider IN ('kakao','apple') AND password_hash IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE auth_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  KEY sessions_user (user_id, revoked_at), KEY sessions_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT sessions_expiry_ck CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refresh_tokens (
  token_hash BINARY(32) NOT NULL PRIMARY KEY,
  session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  KEY tokens_session (session_id), KEY tokens_expiry (expires_at),
  FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON DELETE CASCADE,
  CONSTRAINT tokens_expiry_ck CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE domains (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT domains_active_ck CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE categories (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  domain_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name_ko VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY categories_domain (domain_id, is_active),
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE RESTRICT,
  CONSTRAINT categories_active_ck CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE topics (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  category_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name_ko VARCHAR(100) NOT NULL,
  difficulty TINYINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY topics_category (category_id, is_active, difficulty),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT topics_difficulty_ck CHECK (difficulty BETWEEN 1 AND 3),
  CONSTRAINT topics_active_ck CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE profiles (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  nickname VARCHAR(20) NOT NULL,
  interests JSON NOT NULL,
  level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  study_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_time CHAR(5) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '21:00',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_nickname_ck CHECK (CHAR_LENGTH(TRIM(nickname)) BETWEEN 1 AND 20),
  CONSTRAINT profiles_interests_ck CHECK (JSON_TYPE(interests)='ARRAY'),
  CONSTRAINT profiles_level_ck CHECK (level BETWEEN 0 AND 3),
  CONSTRAINT profiles_minutes_ck CHECK (study_minutes BETWEEN 1 AND 120),
  CONSTRAINT profiles_reminder_ck CHECK (reminder_enabled IN (0,1)),
  CONSTRAINT profiles_time_ck CHECK (REGEXP_LIKE(reminder_time, '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE question_files (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  storage_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sha256 BINARY(32) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'draft',
  question_count INT UNSIGNED NOT NULL,
  schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY files_version (storage_key, sha256),
  CONSTRAINT files_source_ck CHECK (source IN ('bank','ai')),
  CONSTRAINT files_status_ck CHECK (status IN ('draft','published','disabled')),
  CONSTRAINT files_schema_ck CHECK (schema_version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE question_file_topics (
  file_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  question_count INT UNSIGNED NOT NULL,
  PRIMARY KEY (file_id, topic_id), KEY file_topics_topic (topic_id),
  FOREIGN KEY (file_id) REFERENCES question_files(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE questions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'draft',
  content_hash BINARY(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY questions_content (topic_id, source, content_hash),
  KEY questions_lookup (topic_id, source, status),
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT questions_source_ck CHECK (source IN ('bank','ai')),
  CONSTRAINT questions_status_ck CHECK (status IN ('draft','published','disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE question_details (
  question_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  type VARCHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  body TEXT NOT NULL,
  choices JSON NULL,
  answer JSON NOT NULL,
  explanation TEXT NOT NULL,
  model VARCHAR(100) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT details_body_ck CHECK (CHAR_LENGTH(TRIM(body)) BETWEEN 1 AND 400),
  CONSTRAINT details_explain_ck CHECK (CHAR_LENGTH(TRIM(explanation)) BETWEEN 1 AND 400),
  CONSTRAINT details_shape_ck CHECK (
    (type='mc' AND choices IS NOT NULL AND JSON_TYPE(choices)='ARRAY' AND JSON_LENGTH(choices)=4 AND JSON_TYPE(answer)='INTEGER' AND CAST(JSON_UNQUOTE(answer) AS SIGNED) BETWEEN 0 AND 3)
    OR (type='ox' AND choices IS NULL AND JSON_TYPE(answer)='BOOLEAN')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE question_file_items (
  file_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position INT UNSIGNED NOT NULL,
  question_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (file_id, topic_id, position),
  FOREIGN KEY (file_id, topic_id) REFERENCES question_file_topics(file_id, topic_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT,
  CONSTRAINT file_items_position_ck CHECK (position >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE quiz_attempts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'issued',
  verification_status VARCHAR(20) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY attempts_user (user_id, created_at, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT attempts_status_ck CHECK (status IN ('issued','completed','abandoned')),
  CONSTRAINT attempts_verification_ck CHECK (verification_status IN ('server_verified','client_reported')),
  CONSTRAINT attempts_completed_ck CHECK ((status='completed' AND completed_at IS NOT NULL) OR (status IN ('issued','abandoned') AND completed_at IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE quiz_attempt_items (
  attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  question_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  question_snapshot JSON NOT NULL,
  submitted_answer JSON NULL,
  is_correct BOOLEAN NULL,
  answered_at DATETIME(3) NULL,
  PRIMARY KEY (attempt_id, position),
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT,
  CONSTRAINT attempt_items_position_ck CHECK (position BETWEEN 1 AND 7),
  CONSTRAINT attempt_items_snapshot_ck CHECK (JSON_TYPE(question_snapshot)='OBJECT'),
  CONSTRAINT attempt_items_correct_ck CHECK (is_correct IS NULL OR is_correct IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_sync_states (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  last_change_seq BIGINT UNSIGNED NOT NULL DEFAULT 0,
  min_available_seq BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT sync_range_ck CHECK (min_available_seq <= last_change_seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE study_records (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  topic_ko VARCHAR(100) NOT NULL,
  domain VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  category VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  difficulty TINYINT UNSIGNED NOT NULL,
  memo TEXT NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  quiz_total TINYINT UNSIGNED NOT NULL DEFAULT 7,
  rp SMALLINT UNSIGNED NOT NULL,
  study_sec INT UNSIGNED NOT NULL DEFAULT 0,
  studied_at DATETIME(3) NOT NULL,
  study_date DATE NULL,
  time_validation_status VARCHAR(16) NOT NULL,
  submission_hash BINARY(32) NOT NULL,
  change_seq BIGINT UNSIGNED NOT NULL,
  received_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY records_attempt (attempt_id),
  UNIQUE KEY records_user_seq (user_id, change_seq),
  KEY records_user_time (user_id, studied_at, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE RESTRICT,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT records_score_ck CHECK (quiz_total=7 AND score <= quiz_total),
  CONSTRAINT records_rp_ck CHECK (rp <= 1000),
  CONSTRAINT records_difficulty_ck CHECK (difficulty BETWEEN 1 AND 3),
  CONSTRAINT records_memo_ck CHECK (CHAR_LENGTH(memo) <= 5000),
  CONSTRAINT records_seq_ck CHECK (change_seq >= 1),
  CONSTRAINT records_time_ck CHECK (time_validation_status IN ('accepted','needs_review') AND (time_validation_status <> 'needs_review' OR study_date IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE study_record_tombstones (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  record_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  change_seq BIGINT UNSIGNED NOT NULL,
  deleted_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_id, record_id),
  UNIQUE KEY tombstones_user_seq (user_id, change_seq), KEY tombstones_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT tombstones_seq_ck CHECK (change_seq >= 1),
  CONSTRAINT tombstones_expiry_ck CHECK (expires_at > deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE xp_ledger (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_record_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_type VARCHAR(10) NOT NULL,
  amount INT NOT NULL,
  reverses_entry_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  rule_version VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  verification_status VARCHAR(20) NOT NULL,
  calculation_details JSON NOT NULL,
  idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY ledger_record_event (user_id, source_record_id, event_type),
  UNIQUE KEY ledger_reversal (reverses_entry_id), UNIQUE KEY ledger_idempotency (idempotency_key),
  KEY ledger_user_time (user_id, created_at, id), KEY ledger_user_topic (user_id, topic_id, event_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT ledger_event_ck CHECK ((event_type='award' AND amount>=0 AND reverses_entry_id IS NULL) OR (event_type='reversal' AND amount<=0 AND reverses_entry_id IS NOT NULL)),
  CONSTRAINT ledger_verification_ck CHECK (verification_status IN ('server_verified','client_reported')),
  CONSTRAINT ledger_details_ck CHECK (JSON_TYPE(calculation_details)='OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
