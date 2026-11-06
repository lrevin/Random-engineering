-- 뽑공 데이터베이스 스키마 (AWS RDS MySQL 8.0) — 초안, DB 담당(김창원) 검토 후 확정
-- 실행: mysql -h <RDS 엔드포인트> -u <관리자> -p < api/mysql/schema.sql
-- 여러 번 실행해도 안전하도록 IF NOT EXISTS 로 작성합니다.
--
-- Supabase 때와 달리 DB에 행 단위 보안(RLS)이 없습니다.
-- → 앱은 DB에 직접 붙지 않고 API 서버만 DB에 접속하며, API 서버가 모든 쿼리에 "WHERE user_id = <토큰의 사용자>"를 붙여
--   본인 데이터만 읽고 쓰게 합니다 (api/API_RULES.md 2장).
-- → API 서버용 DB 계정은 이 데이터베이스의 SELECT·INSERT·UPDATE·DELETE 권한만 갖게 만듭니다 (맨 아래).

CREATE DATABASE IF NOT EXISTS ppobgong CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE ppobgong;

-- ───────────────────────── 계정 ─────────────────────────
-- id는 서버가 만드는 UUID 문자열. 비밀번호는 bcrypt 해시만 저장 (원문 저장 금지)
-- 카카오·Apple 로그인은 provider + provider_id 로 구분하고 password_hash 는 NULL
CREATE TABLE IF NOT EXISTS users (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  email          VARCHAR(254) NULL,
  password_hash  VARCHAR(100) NULL,
  provider       VARCHAR(10)  NOT NULL DEFAULT 'email',
  provider_id    VARCHAR(128) NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY users_email (email),
  UNIQUE KEY users_provider (provider, provider_id),
  CONSTRAINT users_provider_chk CHECK (provider IN ('email', 'kakao', 'apple'))
);

-- 로그인 유지용 refresh token. 원문은 앱에만 있고 DB에는 SHA-256 해시만 둠 (DB가 새어도 토큰을 쓸 수 없게)
-- 새로 받을 때마다 옛 토큰은 지움(회전). 로그아웃·탈퇴 시 그 사용자 토큰을 지움
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash  CHAR(64)    NOT NULL PRIMARY KEY,
  user_id     CHAR(36)    NOT NULL,
  expires_at  DATETIME(3) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY refresh_tokens_user (user_id),
  CONSTRAINT refresh_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ───────────────────────── 프로필 (설정) ─────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  user_id           CHAR(36)    NOT NULL PRIMARY KEY,
  nickname          VARCHAR(20) NOT NULL,
  interests         JSON        NOT NULL,                     -- 관심 세부 분야 id 목록 ["it-ds", ...]
  level             TINYINT     NOT NULL DEFAULT 0,           -- 0=골고루, 1~3=Lv.1~3
  study_minutes     SMALLINT    NOT NULL DEFAULT 15,
  reminder_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  reminder_time     CHAR(5)     NOT NULL DEFAULT '21:00',
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT profiles_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT profiles_nickname_chk CHECK (CHAR_LENGTH(nickname) BETWEEN 1 AND 20),
  CONSTRAINT profiles_level_chk CHECK (level BETWEEN 0 AND 3),
  CONSTRAINT profiles_minutes_chk CHECK (study_minutes BETWEEN 1 AND 120),
  CONSTRAINT profiles_time_chk CHECK (reminder_time REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

-- ───────────────────────── 공부 기록 (퀴즈 결과) ─────────────────────────
-- id는 앱이 만든 UUID (오프라인에서 먼저 만들고 나중에 올림). 같은 id로 다시 올리면 덮어씀 (중복 없음)
CREATE TABLE IF NOT EXISTS study_records (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  user_id      CHAR(36)     NOT NULL,
  topic_id     VARCHAR(32)  NOT NULL,
  topic_ko     VARCHAR(100) NOT NULL,
  domain       VARCHAR(32)  NOT NULL DEFAULT 'it',
  category     VARCHAR(32)  NOT NULL,
  level        VARCHAR(10)  NOT NULL,
  memo         TEXT         NOT NULL,                         -- 최대 5,000자 (API에서 자름)
  score        TINYINT      NOT NULL,                         -- 퀴즈 정답 수
  quiz_total   TINYINT      NOT NULL DEFAULT 7,
  rp           SMALLINT     NOT NULL DEFAULT 0,               -- 이번에 얻은 경험치(XP). 레벨은 저장하지 않고 앱이 합계로 계산
  wrong        JSON         NOT NULL,                         -- 틀린 문제 [{q, answer, explain}] 최대 10개
  study_sec    INT          NOT NULL DEFAULT 0,
  quiz_source  VARCHAR(10)  NOT NULL DEFAULT 'ai',
  studied_at   DATETIME(3)  NOT NULL,                         -- UTC
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY study_records_user_time (user_id, studied_at),
  CONSTRAINT study_records_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT study_records_score_chk CHECK (score >= 0 AND score <= quiz_total),
  CONSTRAINT study_records_total_chk CHECK (quiz_total BETWEEN 1 AND 20),
  CONSTRAINT study_records_rp_chk CHECK (rp BETWEEN 0 AND 1000),
  CONSTRAINT study_records_sec_chk CHECK (study_sec >= 0),
  CONSTRAINT study_records_source_chk CHECK (quiz_source IN ('bank', 'ai', 'offline'))
);

-- ───────────────────────── 미리 만든 문제 은행 ─────────────────────────
-- 주제당 30문제 × 1,054주제(약 12.6MB)를 앱에 다 넣지 않고, 앱이 공부할 주제만 받아 감 (GET /quiz-bank/:topicId)
-- 올리기: python scripts/quizbank.py export-sql > bank.sql 후 mysql 로 실행 (또는 API 서버의 관리 스크립트)
CREATE TABLE IF NOT EXISTS quiz_bank (
  topic_id    VARCHAR(32) NOT NULL PRIMARY KEY,
  questions   JSON        NOT NULL,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

-- ───────────────────────── AI가 만든 문제 창고 ─────────────────────────
-- 퀴즈 AI 서버가 2번 검수를 통과한 문제만 주제별로 쌓아 두고 모든 사용자가 같이 씀 (주제당 최대 40문제 → AI 비용 상한)
-- 지금은 퀴즈 AI 서버가 파일(api/quiz-server/data/pools)에 쌓음. EC2로 옮기면서 이 표로 바꿀지는 서버 담당(강건우)과 정함
CREATE TABLE IF NOT EXISTS ai_quizzes (
  topic_id    VARCHAR(32) NOT NULL PRIMARY KEY,
  questions   JSON        NOT NULL,
  model       VARCHAR(40) NOT NULL,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

-- ───────────────────────── API 서버용 DB 계정 ─────────────────────────
-- 관리자 계정은 API 서버에 넣지 않습니다. 비밀번호는 여기 적지 말고 실행할 때 직접 바꿔 넣으세요.
-- CREATE USER IF NOT EXISTS 'ppobgong_api'@'%' IDENTIFIED BY '<비밀번호>';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ppobgong.* TO 'ppobgong_api'@'%';
