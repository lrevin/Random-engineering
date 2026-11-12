-- Existing schema-v2 (22 tables) is baseline version 1.
CREATE TABLE certificates (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  organization VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT certificates_active_ck CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE certificate_subjects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  certificate_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name_ko VARCHAR(100) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY cert_subject_order (certificate_id, display_order),
  CONSTRAINT cert_subject_cert_fk FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE certificate_subject_items (
  subject_id BIGINT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  category_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  topic_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (subject_id, position),
  UNIQUE KEY cert_item_category (subject_id, category_id),
  UNIQUE KEY cert_item_topic (subject_id, topic_id),
  CONSTRAINT cert_item_subject_fk FOREIGN KEY (subject_id) REFERENCES certificate_subjects(id) ON DELETE RESTRICT,
  CONSTRAINT cert_item_category_fk FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT cert_item_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT cert_item_target_ck CHECK ((category_id IS NOT NULL AND topic_id IS NULL) OR (category_id IS NULL AND topic_id IS NOT NULL)),
  CONSTRAINT cert_item_position_ck CHECK (position >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
