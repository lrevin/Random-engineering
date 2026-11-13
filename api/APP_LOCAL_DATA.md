# 앱이 휴대폰에만 저장하는 데이터 → 서버로 옮길 목록

작성: 이재빈 (앱) · 2026-11-13
대상: 강건우 (API) · 김창원 (DB, Flyway)

앱의 저장 항목 전체는 `app/src/lib/local-data.ts` 의 `LOCAL_KEYS` 한곳에 모여 있습니다.
지금은 아래 값이 전부 **휴대폰(AsyncStorage)에만** 있어서,

- 앱 데이터를 고치면 톱니바퀴 · 프리미엄 · 배틀권을 마음대로 바꿀 수 있고
- 기기를 바꾸거나 앱을 지우면 사라집니다.

서버에 이미 있는 것은 **계정 · 프로필 · 공부 기록(study_records) · 경험치(xp_ledger)** 뿐입니다.
`PPOBGONG_DB_STRUCTURE_V2.md` 14장에 적힌 대로 톱니바퀴 표는 아직 없으므로, 아래는 **새 Flyway 마이그레이션으로 추가할 표 제안**입니다.
(기존 `schema-v2.sql`을 직접 고치지 않고 `V{다음 번호}__wallet.sql` 같은 새 파일로 추가하는 것을 전제로 썼습니다.)

---

## 1. 옮길 값 (우선순위 순)

### 1순위 · 재화 / 구매 (조작 방지가 필요)

| 앱 키 | 내용 | 지금 규칙 (앱) |
|---|---|---|
| `pg.gears` | 톱니바퀴 잔액 | 시작 30개 |
| `pg.freezes` | 연속 기록 보호권 | 최대 2개, 1개 30 |
| `pg.premium` | 프리미엄 여부 | 시험용 버튼으로 켬 |
| `pg.premiumBonus` | 결제 보너스를 받은 달 | 결제 시 300개, 달마다 1번 |
| `pg.battleTickets` | `{ n: 이번 달 무료, bought: 산 것, month }` | 무료 매월 2개(1일 리셋), 산 것 최대 5개 · 1개 50 |
| `pg.exam` 안의 `tickets` | 모의고사 1회권 | 최대 5개 · 1개 40 |
| `pg.boost` | 경험치 2배 부스터 끝나는 시각(ms) | 30분 · 40, 최대 120분 쌓기 |
| `pg.skins` | `{ owned, active, titles, title, milestones }` | 스킨 150~400, 시즌 칭호 120 |
| `pg.adViews` | 오늘 광고 본 횟수 | 1번 +10, 하루 3번 |

### 2순위 · 학습 진행 (기기 이동 시 이어지게)

| 앱 키 | 내용 |
|---|---|
| `pg.questClaims` | 받은 퀘스트 보상 키 (`quest:2026-11-13:finish1` 등, 최근 200개) |
| `pg.battlesApplied` | 반영한 배틀 · 보상 키 (중복 지급 방지, 최근 300개) |
| `pg.battleXp` | 배틀 · 스피드 퀴즈로 얻은 경험치 합 (기록 없는 경험치) |
| `pg.keptDays` | 보호권 · 복구로 지킨 날 (`YYYY-MM-DD` 목록) |
| `pg.exam` | 모의고사 결과(최근 30회) · 오늘 본 횟수 · 모의고사 오답(최근 300개) |
| `pg.review.done2` | 오답 다시 풀기로 해결한 오답 `{ "주제id|문제": 시각 }` |
| `pg.recall` | 주제별 마지막 복습 시각 |
| `pg.certDates` | 자격증별 시험일 |
| `pg.speed` | 스피드 퀴즈 최고 기록 · 오늘 받은 경험치(하루 150 XP 상한) |

### 옮기지 않음 (이 휴대폰에만)

`pg.mode` · `pg.onboarded` · `pg.active` · `pg.exam.active` · `pg.rescueAsked` · `pg.battleIntroSeen`

---

## 2. 표 제안 (새 Flyway 마이그레이션)

### 2-1. 지갑: 잔액 + 내역(원장)

xp_ledger와 같은 방식으로, **잔액은 내역의 합**이고 같은 요청이 두 번 와도 한 번만 반영되게(idempotency_key) 합니다.

```sql
-- V{n}__wallet.sql (제안)
CREATE TABLE wallet_ledger (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  currency VARCHAR(16) NOT NULL,        -- 'gear' | 'freeze' | 'battle_ticket' | 'exam_ticket'
  amount INT NOT NULL,                  -- 받으면 +, 쓰면 -
  reason VARCHAR(32) NOT NULL,          -- 'quest' | 'ad' | 'premium_bonus' | 'buy_freeze' | 'buy_skin' …
  ref VARCHAR(128) NULL,                -- 퀘스트 키 · 스킨 id 등
  idempotency_key VARCHAR(128) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY wallet_idem (idempotency_key),
  KEY wallet_user (user_id, currency, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

- 앱의 `claimQuest(key)` · `claimOnce(key)` 키를 그대로 `idempotency_key`로 쓰면, 같은 퀘스트 보상을 두 번 받을 수 없습니다.
- 배틀권의 "매월 1일 무료 2개"는 내역 대신 서버가 그 달 사용량을 세서 계산해도 됩니다.

### 2-2. 권한 · 소유물

```sql
CREATE TABLE user_entitlements (
  user_id CHAR(36) PRIMARY KEY,
  premium_until DATETIME(3) NULL,       -- 결제 연동 전에는 시험용
  boost_until DATETIME(3) NULL,
  active_skin VARCHAR(32) NOT NULL DEFAULT 'classic',
  active_title VARCHAR(32) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE user_cosmetics (
  user_id CHAR(36) NOT NULL,
  item_id VARCHAR(32) NOT NULL,         -- 스킨 id 또는 칭호 id
  source VARCHAR(16) NOT NULL,          -- 'shop' | 'streak' | 'season' | 'achievement'
  acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2-3. 학습 진행

```sql
CREATE TABLE exam_results (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, cert_id VARCHAR(32) NOT NULL,
  score INT NOT NULL, total INT NOT NULL, pass BOOLEAN NOT NULL,
  subjects JSON NOT NULL,               -- [{ name, score, total }]
  taken_at DATETIME(3) NOT NULL,
  KEY exam_user (user_id, taken_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE user_progress (           -- 작은 값들은 키-값으로
  user_id CHAR(36) NOT NULL,
  k VARCHAR(32) NOT NULL,               -- 'recall' | 'review_done' | 'cert_dates' | 'speed' | 'kept_days'
  v JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, k),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 3. 앱이 부를 API (제안)

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| GET | `/me/wallet` | 잔액(톱니바퀴 · 보호권 · 배틀권 · 1회권) + 권한(프리미엄 · 부스터 · 스킨 · 칭호) |
| POST | `/me/wallet/claim` | `{ key, reason }` 보상 받기. 금액은 **서버가 key로 정함** (퀘스트 · 출석 · 오늘의 주제 · 복습 · 연속 기록 보상) |
| POST | `/me/wallet/spend` | `{ item, idempotencyKey }` 아이템 사기 (보호권 · 배틀권 · 1회권 · 부스터 · 스킨 · 칭호). 가격도 서버가 정함 |
| POST | `/me/ads/reward` | AdMob 서버 측 검증(SSV) 콜백으로만 지급 |
| GET/PUT | `/me/progress/:k` | 복습 · 오답 해결 · 시험일 · 스피드 기록 |
| POST | `/me/exams` | 모의고사 결과 저장 |
| POST | `/me/import` | 둘러보기 → 회원가입 때 휴대폰 값 한 번에 올리기 (`snapshotLocalData()` 결과) |

**중요:** 보상 금액과 가격은 앱이 보내지 말고 서버에 두어야 합니다. 앱이 금액을 보내면 지금처럼 조작이 가능합니다.
앱의 현재 가격 · 보상표는 `app/src/lib/economy.ts` · `lib/quests.ts` · `lib/skins.ts` · `lib/booster.ts` · `lib/milestones.ts` 에 있습니다.

---

## 4. 앱 쪽 준비 상태

- 저장 키 전체 목록: `lib/local-data.ts` (`LOCAL_KEYS`, 묶음 · 서버 대상 여부 포함)
- 서버로 올릴 값 한 번에 읽기: `snapshotLocalData()`
- 로그아웃 · 데이터 지우기: `clearAllLocalData()` (목록 전체를 지움)
- 서버가 붙으면 각 모듈의 읽기/쓰기 함수(`readExamStore`, `addSkin`, `claimQuest` …)만 서버 호출로 바꾸면 됩니다.
