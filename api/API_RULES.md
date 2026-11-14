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
- 날짜만 필요할 때(연속 일수 계산 등)는 **앱에서 사용자 기기 시간대로** 계산합니다.
- id: 공부 기록처럼 오프라인에서 먼저 만드는 데이터는 **앱이 UUID를 만들어** 보내고, 같은 id로 다시 보내면 덮어씁니다(중복 없음).
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
| GET | `/me/records` | | `200 { records: [...] }` (공부한 시각 오름차순, 최대 5,000개) |
| PUT | `/me/records` | `{ records: [...] }` (최대 100개) | `200 { saved: n }` (id가 같으면 덮어씀) |
| DELETE | `/me/records/:id` | | `204` · 내 기록이 아니면 `404` |
| DELETE | `/me` | | `204` 회원 탈퇴 |

기록 한 개의 모양 (앱 `StudyRecord`에서 `synced`만 뺀 것)
```json
{ "id": "UUID", "topicId": "os-07", "topicKo": "교착 상태", "domain": "it", "category": "os", "level": "중급",
  "memo": "…", "score": 7, "total": 7, "rp": 53, "wrong": [], "studySec": 900, "quizSource": "ai",
  "studiedAt": "2026-11-02T12:34:56.000Z" }
```

### 문제 은행 (로그인 불필요)
| 메서드 | 주소 | 응답 |
|---|---|---|
| GET | `/quiz-bank/:topicId` | `200 { questions: [...] }` · 없는 주제 `404` |

- 레벨(경험치 합계)·주제 숙련 랭크는 **따로 저장하지 않고 기록에서 계산**합니다 ([`app/src/lib/rank.ts`](../app/src/lib/rank.ts)).
- 오프라인에서 만든 기록은 `synced: false`로 휴대폰에 두었다가, 앱이 다시 켜질 때 `PUT /me/records`로 한 번에 올립니다.

---

## 4. 퀴즈 AI 서버 `POST /quiz`

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
