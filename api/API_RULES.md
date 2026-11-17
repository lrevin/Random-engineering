# API 규칙

> 브랜치·담당·DB 마이그레이션·검사 약속은 [docs/TEAM_RULES.md](../docs/TEAM_RULES.md)가 기준입니다. 이 문서의 담당 표와 Supabase·mock 관련 설명은 예전 내용일 수 있습니다.

뽑공의 서버는 **AWS** 위에 있습니다 (2026-11 Supabase → AWS로 변경).

| 구성 | 무엇 | 담당 | 어디 |
|---|---|---|---|
| API 서버 | Node.js + TypeScript, EC2에서 상시 구동 — 회원가입·로그인(JWT), 프로필·기록 저장, 문제 은행 | 서버(강건우) | `api/server/` · 동작 견본은 [`mock-server/`](mock-server) |
| 퀴즈 AI 서버 | Node, 같은 EC2에서 상시 구동 — AI 문제 출제 + 2번 검수, 주제별 문제 창고 | 서버(강건우) · 출제 지침(김주안) | [`quiz-server/`](quiz-server) |
| 데이터베이스 | AWS RDS MySQL 8.0 — API 서버만 접속 | DB(김창원) | [`mysql/schema.sql`](mysql/schema.sql) |
| 앞단 | Nginx + Let's Encrypt HTTPS — `/api/*` → API 서버, `/quiz` → 퀴즈 AI 서버 | 서버(강건우) | EC2 설정 |

앱은 두 서버를 모두 `fetch`로 부르며, 호출 코드는 [`app/src/lib/auth-client.ts`](../app/src/lib/auth-client.ts)(인증·프로필·기록)와 [`app/src/lib/api.ts`](../app/src/lib/api.ts)(문제 은행)와 [`app/src/lib/quiz.ts`](../app/src/lib/quiz.ts)(퀴즈)에만 둡니다. **화면 파일에서 직접 서버를 부르지 않습니다.**

---

## 1. 공통 규칙

### 주소와 헤더
- 기본 주소: `https://<도메인>/api` (앱 환경 변수 `EXPO_PUBLIC_API_URL`). 개발 중에는 `http://127.0.0.1:8788` (mock 서버)
- 로그인이 필요한 요청: `Authorization: Bearer <access token>`
- 본문은 JSON (`Content-Type: application/json`), 문자는 UTF-8
- 웹 미리보기용으로 CORS를 열고 `OPTIONS`에 응답합니다.

### 이름
| 대상 | 규칙 | 예 |
|---|---|---|
| 주소 | 소문자 + 하이픈, 명사, 복수형 | `/me/records`, `/quiz-bank/:topicId` |
| JSON 키 (요청·응답) | camelCase | `topicId`, `studiedAt` |
| DB 표·열 | snake_case, 표는 복수형 | `study_records.topic_id` |

- camelCase ↔ snake_case 변환은 **API 서버에서만** 합니다. 앱은 camelCase만 씁니다.

### 값의 형식
- 시각: ISO 8601 UTC 문자열 (`2026-11-02T12:34:56.000Z`), DB 열은 `DATETIME(3)` (UTC로 저장)
- 날짜·주간·연속일·특수 보상은 **Asia/Seoul**로 계산합니다. 특수 활동은 서버 최초 완료 확인 시점을 기간 기준으로 사용합니다.
- id: 공부 기록처럼 오프라인에서 먼저 만드는 데이터는 **앱이 UUID를 만들어** 보내고, 같은 id·같은 내용의 재전송은 기존 결과를 반환하며, 다른 내용은 충돌로 거절합니다.
- 글자 수·값 범위는 DB `CHECK`로도 막고, API 서버도 먼저 검사해 400으로 돌려보냅니다.

### 오류 응답
항상 `{ "error": "<짧은 영어 코드>" }` + HTTP 상태 코드. 사용자에게 보여 줄 한국어 문장은 앱이 코드를 보고 만듭니다 (`api.ts`의 `errorMessage`).

| 상태 | 코드 | 언제 |
|---|---|---|
| 400 | `bad_request` | 형식이 틀림, 범위를 벗어난 값 |
| 400 | `weak_password` | 비밀번호 8자 미만 |
| 401 | `invalid_credentials` | 이메일·비밀번호가 틀림 |
| 401 | `unauthorized` | 토큰이 없거나 만료됨 → 앱이 refresh 후 한 번 다시 시도 |
| 404 | `not_found` | 없는 기록·주제 |
| 409 | `email_taken` | 이미 가입된 이메일 |
| 429 | `rate_limited` | 요청이 너무 많음 (로그인은 IP당 분당 10번 등) |
| 500 | `server_error` | 그 밖의 서버 오류 (자세한 내용은 서버 로그에만) |

---

## 2. 인증과 권한

- **비밀번호는 bcrypt(비용 12 이상)로 해시**해서 저장합니다. 원문은 저장도, 로그 출력도 하지 않습니다.
- 로그인하면 두 토큰을 줍니다.
  - **access token**: JWT(HS256), 15분, 내용은 `{ sub: <user id> }`만. 서명 키 `JWT_SECRET`은 EC2 환경 변수에만 둡니다.
  - **refresh token**: 긴 무작위 문자열, 30일. DB에는 SHA-256 해시만 저장하고, 쓸 때마다 새것으로 바꿉니다(회전).
- 앱은 두 토큰을 **기기 보안 저장소(expo-secure-store)**에 둡니다.
- **DB에 RLS가 없으므로 API 서버가 권한을 지킵니다.** `/me/...` 요청은 모두 토큰의 `sub`로만 조회·수정·삭제하고(`WHERE user_id = ?`), 요청 본문의 user id는 무시합니다.
- 쿼리는 **항상 매개변수 바인딩**(`?`)으로 씁니다. 문자열을 이어 붙여 SQL을 만들지 않습니다 (SQL 인젝션 방지).
- RDS는 **EC2 보안 그룹에서만** 접속할 수 있게 하고(퍼블릭 접근 끔), API 서버 DB 계정은 `SELECT·INSERT·UPDATE·DELETE`만 줍니다.
- 비밀 값(`JWT_SECRET`, DB 비밀번호, `ANTHROPIC_API_KEY`)은 EC2 환경 변수(`.env`, git 제외)에만 둡니다. 앱·저장소·채팅에 넣지 않습니다.
- 둘러보기(게스트) 사용자는 로그인하지 않으므로 `/me/...`를 쓰지 않습니다. 문제 은행과 퀴즈만 쓸 수 있습니다.
- 회원 탈퇴(`DELETE /me`)는 계정·프로필·기록·refresh token을 모두 지웁니다 (`ON DELETE CASCADE`). 앱스토어 규정상 앱 안에서 탈퇴할 수 있어야 합니다.

---

## 3. API 목록

### 인증
| 메서드 | 주소 | 요청 | 응답 |
|---|---|---|---|
| POST | `/auth/signup` | `{ email, password }` | `201 { accessToken, refreshToken, user: { id, email } }` |
| POST | `/auth/login` | `{ email, password }` | `200` 위와 같음 |
| POST | `/auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken }` (옛 refresh token은 폐기) |
| POST | `/auth/logout` | `{ refreshToken }` | `204` |
| POST | `/auth/kakao`, `/auth/apple` | `{ token }` (각 SDK가 준 토큰) | `200` 로그인과 같음 — 나중에 추가 |

### 내 정보 (로그인 필요)
| 메서드 | 주소 | 요청 | 응답 |
|---|---|---|---|
| GET | `/me/profile` | | `200 { profile }` · 아직 없으면 `404 not_found` |
| PUT | `/me/profile` | `{ nickname, interests, level, studyMinutes, reminderEnabled, reminderTime }` | `200 { profile }` (있으면 바꾸고 없으면 만듦) |
| GET | `/me/records` | | `200 { records, nextCursor }` · 숨김 제외, limit 1~100 |
| PUT | `/me/records` | `{ records: [...] }` (최대 100개) | `200 { saved, results }` · 재전송 중복 방지, 신규 서버 발급 풀이는 서버 채점 |
| DELETE | `/me/records/:id` | | `204` · 삭제 대신 숨김, 내 기록이 아니면 `404` |
| PUT | `/me/records/:id/visibility` | `{ hidden: boolean }` | `200 { record }` · 숨김/복원 |
| GET | `/me/records/snapshot` | | 숨김 포함 전체 기록·동기화 cursor |
| DELETE | `/me` | | `204` 회원 탈퇴 |

기록 한 개의 모양 (앱 `StudyRecord`에서 `synced`만 뺀 것)
```json
{ "id": "UUID", "topicId": "os-07", "topicKo": "교착 상태", "domain": "it", "category": "os", "level": "중급",
  "memo": "…", "score": 7, "total": 7, "rp": 53, "wrong": [], "studySec": 900, "quizSource": "ai",
  "studiedAt": "2026-11-02T12:34:56.000Z" }
```

### 특수 보상·서버 풀이 (로그인 필요, V8 이후)

| 메서드 | 주소 | 요청·역할 |
|---|---|---|
| GET | `/me/rewards` | 오늘의 배정·달성, 복습 대상, 최고 연속일, 프리미엄 주간 실적, 현재 지갑 |
| POST | `/me/activities` | `{ requestId, purpose, topicId?, certId?, studySec? }` · `study/recall/exam/review` 발급. 시작 UUID 재사용 |
| GET | `/me/activities/:id` | 소유한 발급 문제·현재 상태·저장 답안. 자동 다른 기기 이어하기 목록은 제공하지 않음 |
| POST | `/me/activities/:id/events` | `{ requestId, event }` · `pause/resume/quiz/extend`. 시간 추가 120초·10개, 같은 이벤트 UUID 중복 차감 없음 |
| POST | `/me/activities/:id/answers` | `{ position, answer }` · 오답 풀이 문항별 승인·최초 해결 저장 |
| POST | `/me/activities/:id/complete` | `{ answers }` · 복습·시험·오답 전체 채점. 일반 학습은 기존 `/me/records`로 제출 |
| POST | `/me/activities/:id/abandon` | `{}` · 명시적 포기, 시험 소비 환급 없음 |

- 공통 응답은 발급 ID·문항·상태·서버 점수·지갑이다. 발급 문제와 답안을 서버에서 대조하며 미응답·없는 보기·종료 후 다른 답안은 거절한다. 점수만 다른 경우 서버 점수로 정정한다.
- 오늘의 주제는 최초 배정을 당일 유지하고 일반 학습 4개 이상 정답이면 10개. 설정 변경으로 재추첨하지 않는다. 비활성화 전에 시작한 배정은 보존한다.
- 복습은 마지막 유효 학습/완료 복습에서 한국 달력 이틀, 오래된 최대 5주제×3문항이다. 완료와 당일 최초 5개 자동 지급은 한 트랜잭션이다.
- 마일스톤은 최고 연속 7/30/100일에 30/100/300개와 지정 스킨·칭호를 최초 1회 함께 지급한다. 자동 장착하지 않는다.
- 수동 특수 보상은 기존 `POST /me/wallet/operations`의 `quest`로 처리한다. 키는 `daily-topic:YYYY-MM-DD`, `streak-milestone:7/30/100`, 기존 프리미엄 `quest:p<주 시작 날짜>:<id>`다. 완료 증거 없는 `recall:*` 수동 요청은 거절한다.
- 프리미엄 주간 실적은 검증된 시험 채점·오답 해결·서버 학습 30분·정상 배틀 완료만 사용한다. 수령 시 프리미엄을 확인하고 같은 주 가입 전 실적도 인정한다. V6 진행 JSON은 증거가 아니다.
- 기본 은행 부족분은 서버 기준 재료·시드·생성 버전으로 재현하고 발급 스냅샷만 남긴다. AI 원본 연계·LLM 검수는 보류이며 새 회원 서버 출제는 기본/대체 문제를 사용한다.
- 학습 인정 시간은 정지 구간 제외·승인 시간 상한의 서버 값과 앱 보고의 작은 값이며, 퀴즈 시간은 앱 종료/백그라운드를 포함한 전체 경과다. 퀴즈 시간으로 보상을 판정하지 않는다.
- 구버전 APK는 숨김 필터가 없어 숨김 기록을 다시 표시할 수 있으므로 새 앱과 함께 배포한다. 기록 숨김은 답안·XP·통계·랭크·연속일·보상 증거를 유지한다. 스냅샷/변경 피드는 숨김을 포함하며 기본 목록과 최근 화면에서만 제외한다. 탈퇴 후 실제 삭제와 구분한다.
- 일일/주간 미수령은 기간 종료 시 닫히며 마일스톤은 기한이 없다. 서버 성공 후 응답만 유실된 완료 요청은 원래 완료 시각·결과를 재전송으로 반환한다. 장기 오프라인 특수 보상은 별도 보류한다.

### 문제 은행 (로그인 불필요)
| 메서드 | 주소 | 응답 |
|---|---|---|
| GET | `/quiz-bank/:topicId` | `200 { questions: [...] }` · 없는 주제 `404` |

- 레벨(경험치 합계)·주제 숙련 랭크는 **따로 저장하지 않고 기록에서 계산**합니다 ([`app/src/lib/rank.ts`](../app/src/lib/rank.ts)).
- 오프라인에서 만든 기록은 `synced: false`로 휴대폰에 두었다가, 앱이 다시 켜질 때 `PUT /me/records`로 한 번에 올립니다.

---

## 4. 퀴즈 AI 서버 `POST /quiz`

앱은 퀴즈 AI 서버를 직접 부르지 않는다. 로그인한 회원이 API 서버 `POST /me/quiz {topicId, count, avoid, fresh}`를 부르면 API 서버가 `QUIZ_SERVER_URL`에 `QUIZ_SERVER_TOKEN`을 붙여 대신 부른다 ([`api/server/quiz-proxy.mjs`](server/quiz-proxy.mjs)). 회원마다 하루 30번(`quiz_daily_limit`), 그중 새로 만들기(fresh)는 10번까지이고 넘으면 창고 문제만 준다. 비회원은 AI 문제 없이 푼다. 퀴즈 서버 토큰은 앱에 넣지 않는다.

### 퀴즈 한 번의 구성
한 번 푸는 퀴즈는 **7문제 = AI가 새로 만든 4문제 + 미리 만든 문제 3개**입니다 ([`app/src/lib/quiz.ts`](../app/src/lib/quiz.ts) `buildQuiz`).
AI 문제는 ① 퀴즈 AI 서버 → ② 휴대폰에 저장해 둔 AI 문제 순서로 받고, 모자라면 미리 만든 문제 → 오프라인 연습 문제로 채웁니다.

**공부 시작을 누른 즉시 출제 + 2번 검수**: 앱은 "이걸로 시작"을 누르는 순간 `fresh: true`로 AI 문제를 요청합니다. 서버는 새 문제를 만든 직후 모든 문제를 2번 검수합니다 — 1차는 정답표 없이 직접 풀어 정답이 같은지·답이 하나뿐인지·주제에 맞는지 보고, 2차는 정답·해설까지 대조합니다. 둘 다 통과한 문제만 저장·출제합니다 (검수 지침 [`quiz-server/review1.md`](quiz-server/review1.md), [`review2.md`](quiz-server/review2.md)).

**비슷한 문제 막기**: AI에게 그 주제의 문제 은행 + 이미 만든 AI 문제를 먼저 보여 주고 겹치지 않는 새 유형으로 내게 합니다(출제 지침 [`quiz-server/gem.md`](quiz-server/gem.md)). 그래도 비슷한 문제는 글자 2개 묶음 유사도 0.5 이상이면 버립니다 — 퀴즈 AI 서버와 앱 두 곳에서 같은 방법으로 검사합니다.

요청
```json
{ "topicId": "sec-01", "count": 4, "avoid": ["앱이 이미 고른 문제 문장", "…"], "fresh": true }
```
응답 `200`
```json
{ "questions": [
    { "type": "mc", "q": "…", "choices": ["…", "…", "…", "…"], "answer": 2, "explain": "…" },
    { "type": "ox", "q": "…", "answer": false, "explain": "…" } ] }
```
| 상태 | 언제 | 응답 |
|---|---|---|
| 400 | `topicId`가 없거나 주제 목록에 없음 | `{ "error": "unknown topic" }` |
| 429 | AI 사용량 제한 | `{ "error": "rate limited" }` |
| 502 | AI 오류이고 줄 수 있는 문제도 없음 | `{ "error": "…" }` |

- **주제 목록에 있는 주제만** 받습니다. 임의의 글을 보내 AI 비용을 쓰게 할 수 없도록 하기 위해서입니다.
- 주제마다 최대 40문제까지만 만들어서 **AI 비용에 상한**이 있습니다 (그 뒤로는 쌓인 검수 통과 문제로만 냄).
- 앱은 응답을 그대로 믿지 않고 `validQuestions()`로 한 번 더 검사합니다.

### AI 호출 규칙 (Claude API)
- 공식 SDK(`@anthropic-ai/sdk`)만 씁니다. 모델은 `claude-opus-5-5`.
- 결과는 **구조화 출력(JSON 스키마)**으로 받고, 받은 뒤에도 형식을 다시 검사합니다.
- 안전 거절에 대비해 `fallbacks: "default"`(베타 헤더 `server-side-fallback-2026-07-01`)를 켜 둡니다.
- `stop_reason`이 `refusal` 또는 `max_tokens`이면 저장하지 않습니다.
- **개인정보를 AI에 보내지 않습니다.** 주제 이름·분야·난이도·힌트만 보냅니다.

---

## 5. DB를 바꿀 때

1. [`mysql/schema.sql`](mysql/schema.sql)을 고칩니다. **여러 번 실행해도 안전하게** 씁니다 (`CREATE TABLE IF NOT EXISTS`, 열 추가는 따로 `ALTER TABLE` 파일로).
2. **열 이름을 바꾸거나 지우지 않습니다.** 새 열을 추가하고, 앱이 옛 형식도 읽을 수 있게 둡니다 (예: `normalizeRecord`).
3. API 서버의 변환 코드와 앱 타입([`app/src/lib/types.ts`](../app/src/lib/types.ts))을 함께 고칩니다.
4. 이 문서의 API 표를 고칩니다.

## 6. 새 API를 추가할 때 체크리스트
- [ ] 로그인이 필요한 API는 토큰의 사용자 것만 읽고 쓴다 (`WHERE user_id = ?`)
- [ ] 입력 검사 · `{ error }` 응답 · CORS를 넣었다
- [ ] SQL은 매개변수 바인딩으로만 만들었다
- [ ] 비밀 키는 EC2 환경 변수에만 있다 (앱에 키를 넣지 않았다)
- [ ] 앱 호출 코드는 `app/src/lib/`에만 두었다
- [ ] 서버가 꺼져 있어도 앱이 멈추지 않는다 (둘러보기 모드 확인)
- [ ] mock 서버([`mock-server/`](mock-server))도 같은 모양으로 고쳤다
- [ ] 이 문서의 API 표를 고쳤다

---

## 7. 직접 호출해 보기 (curl)

```bash
# 회원가입 → access token 받기
curl -X POST "$API/auth/signup" -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"12345678"}'

# 내 기록
curl "$API/me/records" -H "Authorization: Bearer <access token>"

# 문제 은행
curl "$API/quiz-bank/os-07"

# AI 퀴즈
curl -X POST "https://<도메인>/quiz" -H "Content-Type: application/json" -d '{"topicId":"os-07","count":4}'
```

## 8. 개발 중 mock 서버
실제 API 서버가 만들어지기 전에도 앱을 시험할 수 있도록, 같은 API를 메모리로 흉내 내는 [`mock-server/`](mock-server)가 있습니다 (DB 없음, 껐다 켜면 데이터가 사라짐).
```bash
node api/mock-server/server.mjs                 # http://127.0.0.1:8788
adb reverse tcp:8788 tcp:8788                    # 안드로이드 에뮬레이터에서 접속할 때
# app/.env.local 에 EXPO_PUBLIC_API_URL=http://127.0.0.1:8788
```


## 회원 상품 구매·사용 (V7)

기존 인증 API를 확장한다. 상품 가격·잔액·소유·기간과 지급은 서버가 결정한다.

| 경로 | 메서드 | 내용 |
|---|---|---|
| /me/wallet | GET | 기존 지갑 응답에 assets 추가. 모의고사권·한국 날짜 무료 사용·부스터 만료·소유/장착 목록 |
| /me/wallet/operations | POST | 기존 requestId/action/payload 구조로 구매·장착·시험 시작. 같은 UUID·같은 내용은 재실행 없이 최신 지갑 반환 |

- `action: spend`, `payload: {product}`: `exam_ticket`, `xp_boost`, `skin:<테마 id>`(sunset · aurora · honey · midnight · matcha · obsidian, 프리미엄 전용 prism은 팔지 않음). 칭호는 팔지 않음(보상 전용). 기존 `study_extend`도 유지.
- 테마는 예전 슬롯머신 스킨 칸(`member_cosmetics.item_type='skin'`)에 저장한다. 기본 테마는 `classic`.
- `action: equip_cosmetic`, `payload: {type: skin 또는 title, itemId}`. title의 itemId만 NULL 허용.
- `action: exam_start`, `payload: {startId, certId}`. 앱은 startId를 requestId로 재사용. 서버가 무료 횟수·프리미엄·구매권을 판정한다.
- 추가 오류: inventory_full / already_owned / not_owned / not_in_season / premium_unlimited / exam_ticket_required / exam_already_started / unknown_certificate. 인증·잔액·요청 충돌은 기존 오류 유지.
- 부스터는 일반 학습·스피드 2배, 스피드 하루 상한 150 XP 유지. 일반 풀이의 장기 지연·오프라인 배율 승인은 별도 정책이다.
- /me/progress의 모의고사 보관 값은 학습 이력 캐시이며 이용권·무료 횟수·보상 권한의 기준이 아니다. 회원 이용권과 부스터는 V7 서버 자산으로만 판정한다.

### 일반 보상 자격 (2026-11-15 운영 V8 적용, general-v1)

- 기존 기록 API의 record 응답에 `rewardStatus`, `rewardReason`, `rewardPolicyVersion`, `timeValidationStatus`, `eligibility`를 추가한다. 새 공개 경로는 없다.
- `rewardStatus`: `eligible`(정산), `held`(확인 대기), `ineligible`(개인 기록만), `legacy_granted`(기존 정산 보존). `rp=0`만으로 보류와 적격 0점 풀이를 구분하지 않는다.
- `rewardReason`: `question_unverified`, `time_needs_review`, `outside_study_window`, `client_daily_limit`, 미분류 기존 기록은 `unclassified`. 문제·답안 위조는 보류로 저장하지 않고 기존 오류로 거절한다.
- `eligibility`는 recordAccepted / xpEligible / questEligible / timeQuestEligible / rankEligible / leaderboardEligible / studyDayEligible / repeatEligible / boostEligible / policyVersion을 포함한다. boostEligible은 문제·기록의 기본 후보 자격이며 실제 배율은 기존 구매·만료·수신 시각 검사 후 XP 계산에 반영한다.
- 서버가 보관한 기본/대체 문제와 기존 전체 원본 대조를 통과한 기본 문제는 일반 XP 대상이다. 기기에서만 확인한 AI·대체 문제가 섞인 신규 제출은 기록만 보관하고 XP·일반 퀘스트·신규 랭크 기여를 인정하지 않는다. 시간 퀘스트에는 special-v1 서버 학습 단계로 확인한 시간만 사용하며 quiz_sec는 제외한다.
- 서버가 문제를 내지 않은 기록(앱이 문제·답을 보낸 기록, special-v1이 아님)은 문제 은행 원본과 맞아도 한국 날짜 하루 3개(`CLIENT_RECORD_DAILY_LIMIT`)까지만 `eligible`, 그 뒤는 `ineligible`/`client_daily_limit`(기록만 보관). 문제 은행 정답이 앱 안에 있어서 만점 기록을 꾸며 계속 올리는 것을 막는다. 서버가 낸 공부(special-v1)는 제한하지 않는다.
- 보류·미인정 기록도 `saved/results.ok`는 기록 저장 성공으로 응답할 수 있다. 원장이 없어도 조회·메모·숨김·동기화가 된다. 저장 성공은 보상 지급 성공과 다르다.
- needs_review는 시간 경과·동일 ID 재전송만으로 해제되지 않는다. 서버 내부 `reassessHeld`는 저장된 증거가 승인된 뒤 같은 ID로 한 번만 정산한다. 이를 호출하는 공개 사용자 해제/관리자 HTTP API는 만들지 않았다.
- 과거 지급은 legacy_granted로 원장·잔액·랭크 기여를 보존한다. 과거 미검증 기록은 새 퀘스트·반복/연속 보너스 입력으로 인정하지 않는다. 숨김/복원은 자격을 바꾸지 않는다. 배틀·스피드는 기존 전용 정산을 유지한다.
- 배포 시 확장 V8과 새 API를 함께 적용한다. API를 정지하고 DB 이력 확인→마이그레이션→새 API 재시작→검사 순서로 진행해 구 API가 새 판정 상태 없이 지급하는 구간을 만들지 않는다. 2026-11-15 운영 배포·HTTPS 검사 완료. V8은 적용 파일이므로 이후 수정하지 않는다.

## 전체 랭킹 (분야 상관없음)
- `GET /rankings/weekly|level|tier?limit=50` (로그인 필요, DB 변경 없음). 응답 `{ kind, since, entries: [{ rank, nickname, value, me, uid, level?, tier?, domain? }], me }`.
- weekly: 이번 주 월요일 0시(한국 시간, `since`)부터 쌓인 `xp_ledger.amount` + 끝난 스피드 퀴즈 `awarded_xp`. level: 같은 값을 누적으로 더하고 앱과 같은 공식으로 `level` 계산.
- tier: 랭크 인정 기록(`rewardSql('rank')`)을 사람·분야별로 모아 앱과 같은 분야 랭크 기준(브론즈 0 · 실버 30 · 골드 100 · 플래티넘 250 · 다이아 500 · 엔지니어 1000점 + 주제 30개)으로 판정하고, 사람마다 가장 높은 분야(같으면 점수)로 줄 세운다. `tier`는 0(브론즈)~5(엔지니어).
- 점수 0인 사람은 빠지고, 같은 점수는 같은 순위다. 랭킹 숨기기 · 신고 3명 닉네임 가림은 분야별 랭킹(`/leaderboard/:domain`)과 같다.

## 유료 프로필 캐릭터 · 배경
- 상품 id `skin:av-*`(캐릭터) · `skin:bg-*`(배경). 가격은 `api/mysql/purchase-policy.mjs` COSMETICS와 앱 `app/src/lib/profile-look.ts` LOOK_PRICES가 같아야 한다(앱 테스트가 비교).
- DB 변경 없이 기존 `member_cosmetics`의 'skin' 칸에 보관만 한다. 사도 쓰던 테마는 그대로이고, `equip('skin', av-/bg-)`는 거절한다. 어떤 그림을 고를지는 앱이 휴대폰에 기억한다(다른 사람 화면에는 아직 안 보임).

## 닉네임 변경 (PUT /me/profile)
- 새로 정하거나 바꾸는 닉네임은 2~5자(`nickname_length`). 예전에 정한 긴 닉네임 그대로 다른 설정만 저장하는 건 허용한다.
- 처음 프로필을 만들 때는 무료이고 횟수에 넣지 않는다. 이후 닉네임을 바꿀 때 첫 번째는 무료, 두 번째부터 톱니바퀴 50개(`insufficient_balance` 409). 응답에 `nicknameCharged`(이번에 쓴 톱니바퀴)를 함께 준다.
- DB 변경 없음: 변경마다 `wallet_operations`(action='nickname_change')에 영수증을 남기고, 유료면 `wallets` 차감 + `wallet_transactions`(reason='nickname_change') 기록.

## 스터디 팀 · 오답 보스전 (V9__study_teams.sql, 규칙 숫자는 team-policy.mjs · boss-policy.mjs)
스터디 팀 (2~4명, 주제 상관없음, 한 사람은 한 팀에만):
- `GET /me/team` 내 팀 · 이번 주 목표 진행 · 받은/보낸 초대.
- `POST /me/team/invites {friendUids}` 친구(UID) 초대. 팀이 없으면 최대 3명, 팀이 있으면 빈자리만큼(`team_party_full`). 친구 아님 `not_friends`, 이미 다른 팀 `team_friend_joined`.
- `POST /me/team/invites/{id}/(accept|decline|cancel)` 수락하면 초대한 사람에게 팀이 있으면 바로 그 팀에, 없으면 '같이 가기'로 대기.
- `POST /me/team/create {mode}` 'open' = 나 + 수락한 친구가 다 들어가는 빈자리 팀에 무작위로(없으면 새 팀) · 'friends' = 친구끼리만(수락한 친구 1명 이상, `team_need_friend`).
- `POST /me/team/leave` 나가기 (리더가 나가면 가장 먼저 들어온 사람이 리더, 아무도 없으면 팀 삭제).
- `POST /me/team/claim` 주간 목표(팀원 이번 주 XP 합 ≥ 150 × 인원, 2명 이상) 달성 시 팀에 들어온 뒤 이번 주 XP를 50(`TEAM_MIN_CONTRIBUTION`) 이상 얻은 팀원마다 한 번 톱니바퀴 40 · XP 60 (`study_team_rewards`, wallet reason='team_reward'). XP는 공부 · 스피드 퀴즈 · 보스전 XP를 합산하되 이번 주 월요일 0시와 팀에 들어온 때 중 늦은 때부터만 세고(늦게 들어와 보상만 받아 가는 것 방지), 팀 보상 XP는 목표 계산에서 뺀다.
오답 보스전 (한 사람이 한 주에 한 판, `boss_runs` UNIQUE(user_id, week_start)):
- `GET /me/boss` 이번 주 판 상태 · 관심 분야 · 전용 테마 보유 여부.
- `POST /me/boss/runs {requestId}` 시작(이번 주 판이 진행 중이면 그 판). 문제 50개 = 내 관심 분야를 고른 사람들(profiles.interests 겹침)이 최근 60일 동안 그 분야 주제에서 많이 틀린 문제 순(서버가 확인한 시도의 문제 은행 문제만, 문제 글은 DB 원본에서) + 모자라면 그 분야 문제 은행. 이미 끝냈으면 `boss_week_used`, 관심 분야 없음 `boss_no_interest`, 문제 30개 미만 `boss_not_ready`.
- `POST /me/boss/runs/{id}/answers {position, answer}` 맞히면 보스 -10(300, 30번이면 클리어), 틀리면 내 체력 -5(20번이면 실패). 정답은 답한 뒤에만 보냄. 같은 자리 같은 답은 같은 결과.
- 클리어 보상: 남은 체력 비율 k로 톱니바퀴 round(40+60k) · XP round(80+120k) (wallet reason='boss_reward'), 1/10000 확률로 테마 'eclipse'(member_cosmetics acquired_via='boss').
- 보스전 · 팀 보상 XP는 랭킹(주간/레벨)과 `/me/speed/stats`의 `bonusXp`에 더해진다.

## 요청 제한 · 신고 · 광고 (2026-11-17 보안 검토)
- 모든 요청은 실제 주소(IP, Nginx가 붙인 X-Forwarded-For 마지막 값)마다 분당 `IP_RATE_LIMIT`(기본 1200)번까지 → `429 rate_limited`.
- 경로별 제한 표(`overLimit`)는 가득 차면 가장 오래된 칸을 버린다. 가득 찼다고 새 사용자를 막지 않는다.
- 닉네임 가리기(신고 3명 이상)는 가입 7일이 지나고 서버가 인정한 공부 기록이 있는 활성 회원의 신고만 센다.
- AdMob SSV는 `ADMOB_REWARDED_UNITS`가 필수다. 비어 있으면 `ad_units_not_configured`로 지급하지 않는다.
