# API 규칙

> 브랜치·담당·DB 마이그레이션·검사 약속은 [docs/TEAM_RULES.md](../docs/TEAM_RULES.md)가 기준입니다. 이 문서의 담당 표와 Supabase·mock 관련 설명은 예전 내용일 수 있습니다.

뽑공의 서버는 **AWS** 위에 있습니다 (2026-11 Supabase → AWS로 변경).

| 구성 | 무엇 | 담당 | 어디 |
|---|---|---|---|
| API 서버 | Node.js + TypeScript, EC2에서 상시 구동 — 회원가입·로그인(JWT), 프로필·기록 저장, 문제 은행 | 서버(강건우) | `api/server/` · 동작 견본은 [`mock-server/`](mock-server) |
| 퀴즈 AI 서버 | 강의실 PC LLM을 SSH 역방향 터널로 연결 — EC2가 생성 작업·문제 은행 관리 | 서버(강건우) · 출제 지침(김주안) | [`quiz-server/`](quiz-server) |
| 데이터베이스 | AWS RDS MySQL 8.4 — API 서버만 접속 | DB(김창원) | [`mysql/migrations/`](mysql/migrations/) |
| 앞단 | Nginx + Let's Encrypt HTTPS → API 서버. 강의실 `/quiz`는 EC2 내부 터널로만 호출 | 서버(강건우) | EC2 설정 |

앱은 EC2 API 서버만 호출하며, 호출 코드는 [`app/src/lib/auth-client.ts`](../app/src/lib/auth-client.ts)(인증·프로필·기록)와 [`app/src/lib/api.ts`](../app/src/lib/api.ts)(문제 은행)와 [`app/src/lib/quiz.ts`](../app/src/lib/quiz.ts)(퀴즈)에만 둡니다. **화면 파일에서 직접 서버를 부르지 않습니다.**

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
- 기본 은행 부족분은 서버 기준 재료·시드·생성 버전으로 재현하고 발급 스냅샷만 남긴다. 일반 학습 AI 원본은 V11 생성 작업·문제 은행을 통해 연결하며, 실제 LLM 서버 연결·운영 적재는 별도 적용한다.
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

## 4. 강의실 LLM 연결·일반 학습 출제 (V11, 로컬 구현)

- 앱은 기존 `POST /me/activities`로 일반 학습을 시작한다. 서버가 `quiz_jobs`를 만들거나 같은 주제의 활성 작업을 공유하고 즉시 응답한다. 재진입·같은 요청 UUID는 새 작업을 만들지 않는다.
- 실제 연결 확인은 운영 적용 단계에서 `npm run ai:health`로 명시적으로 실행한다. 구현 검사는 가짜 HTTP 서버만 사용한다.
- API 실행 프로세스의 백그라운드 처리기가 대기 작업을 가져와 `QUIZ_SERVER_URL`의 `/quiz`에 `{topicId,count:4}`를 보낸다. 기본 주소는 `http://127.0.0.1:18788`, 헤더는 `X-Quiz-Token: QUIZ_SERVER_TOKEN`이다. 토큰이 없으면 외부 호출 없이 실패 상태를 기록하고 저장 문제로 보충한다. 실제 비밀값은 EC2 .env에만 둔다.
- EC2 처리기는 동시 실행 1개, 생성 작업의 대기·실행 합계 최대 10분이다. DB 연결은 점유·상태 갱신·결과 저장 때만 빌린다. 연결 전 실패만 최대 2회, 5초 뒤 재시도한다. 인증·HTTP 오류·잘못된 응답·응답 시간 초과는 자동 재요청하지 않는다.
- 90초 점유를 20초마다 갱신한다. 프로세스 종료 후 queued 작업은 재개하고 만료된 running은 전달 여부 불명확 실패로 회수한다. 이전 점유의 늦은 응답은 저장하지 않는다. LLM에 요청 ID·취소 프로토콜이 없어 원격 생성 자체의 정확히 한 번 실행은 보장할 수 없다.
- 응답은 `{topicId,questions,model,generated,seconds}`다. 주제·모델을 확인하고 최대 128KiB만 읽는다. mc 보기 4개·유효한 정수 답, ox boolean 답, 본문/해설 1~400자 등 공용 문제 규격을 검사한다. 잘못된 일부 문항은 제외하되 정상 문항은 저장한다. 주제 불일치·잘못된 JSON은 응답 전체를 거절한다.
- `questions.source='ai'`, `question_details`에 전체 원본을 저장한다. `live/pool`은 생성 작업 결과 메타데이터이며 DB 출처 값이 아니다. 내용 해시로 중복을 재사용하고 본문을 덮어쓰지 않는다. 공개 AI는 주제당 최대 40개, 초과 시 오래된 순으로 비활성화한다. 참조 원본은 보존하고 비활성 문제를 가져오기 재실행으로 되살리지 않는다.
- `quiz_jobs.accepted_count`는 신규 삽입 수가 아니라 확보한 서로 다른 문제 수다. 결과에 신규/재사용/거절 수와 문제 ID를 따로 저장한다. 문제·상세 저장·작업 종료는 한 트랜잭션이다.
- 생성 작업은 주제 공용이므로 회원이 학습을 포기해도 다른 학습과 문제 은행을 위해 유지한다. 개인 답안·회원 식별자는 LLM에 보내지 않는다.
- 학습 종료의 `quiz` 이벤트에서 이번 작업 AI → 저장 AI 순으로 최대 4개, 나머지는 기본 문제 → 서버 재현 연습으로 총 7개를 확정한다. 같은 본문은 중복 출제하지 않는다. `quiz_fixed_at`과 스냅샷을 함께 저장한다. 사용자는 생성 완료를 추가 대기하지 않는다. 출제 확정 뒤 정상 작업 결과가 도착하면 은행에만 저장하고 이미 발급한 문항은 바꾸지 않는다.
- 서버가 발급한 AI는 기존 special-v1 답안 채점·기록·일반/특수 퀘스트·분야 랭크·부스터 정책을 그대로 사용한다. 클라이언트가 임의로 올린 AI 기록을 검증 완료로 바꾸지 않는다. 형식·서버 채점은 사실성 검수와 다르며 문제 품질은 LLM 생성·검수 담당 범위다.
- 배틀·스피드·모의고사·복습의 기존 발급 방식은 유지한다. 게스트는 내장 문제·기존 기기 캐시·연습 문제만 사용한다.
- **이전 `POST /me/quiz`는 인증 후 409 `{error:"quiz_activity_required"}`를 반환하는 호환 안내 경로다.** 추가 생성 호출을 하지 않는다. 앱의 기존 AI 선행 호출·직접 AI 요청은 제거했다.

### 사전 생성 문제 가져오기

```powershell
# api/server에서 실행. 입력 파일은 별도 전달하며 .sql은 실행하지 않는다.
npm run ai:import -- --file <ai_quizzes.json> --summary <summary.txt> --report <결과.json>
```

- 주제별 JSON을 검증해 같은 문제 은행에 저장하며 모델은 제공된 `qwen3:14b`, 생성 작업 ID는 NULL이다. 빈 배열은 건너뛰고 알 수 없는 주제/잘못된 문항은 이유·위치를 보고한다.
- 반복 실행 시 기존 내용을 변경하거나 중복 삽입하지 않는다. 주제별 트랜잭션이므로 중단 후 같은 파일로 재실행할 수 있다.
- summary의 처리 주제/문제 수와 AI 미보유 목록을 실제 JSON에 대조한다. DB 적재 이후 검증 탈락까지 포함한 최종 미보유 주제도 따로 집계한다. summary는 사실성 검수나 DB 원본이 아니다.
- 전달 파일은 1,052개 주제·2,145문제, 빈 배열 293개, 미포함 주제 `en-water-02`·`theory-01` 2개다. 두 종류를 합친 295개가 summary의 AI 없는 주제 목록이다.
- 원본 JSON은 개인 전달 파일이며 저장소 기본 문제 폴더에 섞지 않는다. 운영 적재·실제 터널/토큰 확인은 사용자 연결 완료 후 별도로 진행한다.

## 5. DB를 바꿀 때

1. [`mysql/migrations/`](mysql/migrations/)을 고칩니다. **여러 번 실행해도 안전하게** 씁니다 (`CREATE TABLE IF NOT EXISTS`, 열 추가는 따로 `ALTER TABLE` 파일로).
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
curl -X POST "$API/me/activities" -H "Authorization: Bearer <access token>" -H "Content-Type: application/json" -d '{"requestId":"<UUID>","purpose":"study","topicId":"os-07","studySec":900}'
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
- 서버가 발급·보관한 AI/기본/대체 문제와 기존 전체 원본 대조를 통과한 기본 문제는 일반 XP 대상이다. 기기에서만 확인한 AI·대체 문제가 섞인 신규 제출은 기록만 보관하고 XP·일반 퀘스트·신규 랭크 기여를 인정하지 않는다. 시간 퀘스트에는 special-v1 서버 학습 단계로 확인한 시간만 사용하며 quiz_sec는 제외한다.
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
- 로그인: 같은 이메일로 15분 동안 비밀번호를 10번 틀리면 IP와 상관없이 그 이메일 로그인이 `429 too_many_attempts`. 맞히면 초기화.
- 카카오 계정 탈퇴 취소: `GET /auth/kakao/start?challenge=…&restore=1`로 다시 로그인하면(서명된 state에 담김) 탈퇴 신청 7일 이내 계정을 되살리고 로그인. 7일이 지났으면 `deletion_period_expired`.
- 팀 '빈자리 채우기'는 열린 팀 후보 20개를 잠그지 않고 읽은 뒤 고른 팀 하나만 잠그고 자리를 다시 확인한다.
- 꾸미기 구매는 이미 가진 것이면 잔액보다 먼저 `already_owned`. 같은 requestId 동시 요청은 영수증을 잠금 읽기로 확인해 재전송으로 처리한다.
- V10__lavender_to_honey.sql: 판매 종료한 라벤더 드림(lavender)을 허니 레몬(honey)으로 바꿔 준다. 둘 다 가진 사람은 1200 톱니바퀴를 돌려준다(reason='theme_refund', request_id='refund:lavender').
