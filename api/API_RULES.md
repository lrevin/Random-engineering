# API 규칙

뽑공의 서버는 **Supabase**와, 계속 켜 두는 **퀴즈 AI 서버**([`quiz-server/`](quiz-server))로 이루어져 있습니다. 다음 다섯 가지를 API로 씁니다.

| 종류 | 무엇 | 어디에 정의 |
|---|---|---|
| 인증 | Supabase Auth (이메일 가입·로그인, 나중에 카카오·Apple) | Supabase 대시보드 설정 |
| 데이터 | 표(table)를 REST로 읽고 쓰기 (PostgREST) | [`supabase/schema.sql`](supabase/schema.sql) |
| 함수(RPC) | DB 안의 함수 호출 | [`supabase/schema.sql`](supabase/schema.sql) |
| 서버 함수 | Edge Function (Deno) — AI 퀴즈 생성처럼 비밀 키가 필요한 일 (퀴즈 AI 서버가 없을 때의 예비 경로) | [`supabase/functions/`](supabase/functions) |
| 퀴즈 AI 서버 | Node 서버 — 개인 PC 등에서 계속 켜 두고 퀴즈를 만들어 쌓아 두는 출제 AI | [`quiz-server/`](quiz-server) |

앱은 Supabase는 `@supabase/supabase-js`로, 퀴즈 AI 서버는 `fetch`로 호출합니다. 호출 코드는 [`app/src/lib/app-state.tsx`](../app/src/lib/app-state.tsx)(인증·기록·프로필)와 [`app/src/lib/quiz.ts`](../app/src/lib/quiz.ts)(퀴즈)에 모여 있고, **화면 파일에서 직접 Supabase를 부르지 않습니다.**

---

## 1. 공통 규칙

### 주소와 헤더
- 기본 주소: `https://<프로젝트 ID>.supabase.co`
- 모든 요청에 `apikey: <Publishable key>`
- 로그인한 사용자는 `Authorization: Bearer <사용자 access token>` (supabase-js가 자동으로 붙임)
- 본문은 JSON (`Content-Type: application/json`), 문자는 UTF-8

### 이름
| 대상 | 규칙 | 예 |
|---|---|---|
| 표·열 | 영어 소문자 + 밑줄(snake_case), 표는 복수형 | `study_records.topic_id` |
| 앱 객체 | camelCase | `StudyRecord.topicId` |
| 서버 함수 | 영어 소문자 + 하이픈(kebab-case), 동사로 시작 | `generate-quiz` |
| DB 함수(RPC) | snake_case, 동사로 시작 | `delete_my_account` |
| 보안 정책 | `"<표>: 본인만 <동작>"` | `"records: 본인만 조회"` |

- snake_case ↔ camelCase 변환은 **`app-state.tsx`의 `toRow` / `fromRow` / `prefsToProfile` / `profileToPrefs` 한 곳에서만** 합니다.

### 값의 형식
- 시각: ISO 8601 UTC 문자열 (`2026-10-27T12:34:56.000Z`), DB 열은 `timestamptz`
- 날짜만 필요할 때(연속 일수 계산 등)는 **앱에서 사용자 기기 시간대로** 계산합니다.
- id: 공부 기록처럼 오프라인에서 먼저 만드는 데이터는 **앱이 UUID를 만들어** 보냅니다 (`expo-crypto`의 `randomUUID`). 같은 id로 다시 보내도 중복되지 않게 `upsert`를 씁니다.
- 정해진 값만 들어가는 열은 DB에 `check` 제약을 둡니다 (예: `quiz_source in ('bank','ai','offline')`, `level between 0 and 3`).
- 글자 수 제한도 DB `check`로 둡니다 (메모 5,000자, 닉네임 1~20자 등). 앱도 같은 길이로 자릅니다.

---

## 2. 인증과 권한

- **모든 표에 RLS(Row Level Security)를 켭니다.** 정책이 없는 표는 일반 사용자가 아예 접근할 수 없습니다.
- 사용자 데이터 표는 `auth.uid() = user_id`(또는 `id`)인 행만 조회·생성·수정·삭제할 수 있게 정책을 둡니다.
- **Service role 키는 서버 함수 안에서만** 씁니다. 앱 코드, `.env.example`, 깃허브에 절대 넣지 않습니다.
- 앱에는 **Publishable key만** 들어갑니다 (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). 이 키는 공개돼도 되는 키이고, 실제 보호는 RLS가 합니다.
- 회원 탈퇴는 `delete_my_account()` RPC로만 합니다. `security definer`로 만들되 `auth.uid()` 본인만 지우고, `anon`에게는 실행 권한을 주지 않습니다.
- 둘러보기(게스트) 사용자는 로그인하지 않으므로 표에 접근하지 않습니다. 퀴즈 함수만 쓸 수 있습니다 (아래 4장).

---

## 3. 데이터 API (표)

| 표 | 내용 | 앱이 하는 일 |
|---|---|---|
| `profiles` | 닉네임, 관심 분야, 난이도, 공부 시간, 알림 설정 | 로그인 후 조회 · 온보딩·설정에서 `upsert` |
| `study_records` | 퀴즈 결과 (점수, RP, 틀린 문제, 메모, 공부 시간) | 저장 시 `upsert`(오프라인분 포함) · 로그인 시 전체 조회 · 기록 삭제 |
| `quizzes` | AI 퀴즈 문제 은행 (주제당 1행) | **앱은 직접 접근하지 않음** — 서버 함수만 읽고 씀 |

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/rest/v1/profiles?id=eq.<내 id>` | 내 프로필 |
| POST | `/rest/v1/profiles` (`Prefer: resolution=merge-duplicates`) | 프로필 만들기·바꾸기 (upsert) |
| GET | `/rest/v1/study_records?order=studied_at.asc&limit=5000` | 내 기록 전체 (RLS로 내 것만 옴) |
| POST | `/rest/v1/study_records` (upsert) | 기록 올리기 (여러 개 한 번에 가능) |
| DELETE | `/rest/v1/study_records?id=eq.<기록 id>` | 기록 삭제 |
| POST | `/rest/v1/rpc/delete_my_account` | 회원 탈퇴 (계정·프로필·기록 모두 삭제) |

- 랭크(RP 합계, 주제별 숙련도)는 **따로 저장하지 않고 기록에서 계산**합니다 ([`app/src/lib/rank.ts`](../app/src/lib/rank.ts)). 계산 규칙을 바꿔도 DB를 고칠 필요가 없게 하기 위해서입니다.
- 오프라인에서 만든 기록은 `synced: false`로 휴대폰에 두었다가, 앱이 다시 켜질 때 한 번에 올립니다.

---

## 4. 서버 함수 (Edge Functions)

### 퀴즈 한 번의 구성
한 번 푸는 퀴즈는 **7문제 = AI가 새로 만든 4문제 + 우리가 미리 만든 문제 3개**입니다 ([`app/src/lib/quiz.ts`](../app/src/lib/quiz.ts) `buildQuiz`).
AI 문제는 ① 퀴즈 AI 서버 → ② `generate-quiz` 함수 → ③ 휴대폰에 저장해 둔 AI 문제 순서로 받고, 모자라면 미리 만든 문제 → 오프라인 연습 문제로 채웁니다.

**주제를 뽑은 즉시 출제 + 2번 검수**: 앱은 주제가 뽑히는 순간 `fresh: true`로 AI 문제를 요청합니다. 서버(퀴즈 AI 서버·`generate-quiz` 둘 다)는 새 문제를 만든 직후 모든 문제를 2번 검수합니다 — 1차는 정답표 없이 직접 풀어 정답이 같은지·답이 하나뿐인지·주제에 맞는지·사실에 맞는지 보고, 2차는 정답·해설까지 대조합니다. 둘 다 통과한 문제만 저장·출제합니다 (검수 지침 [`quiz-server/review1.md`](quiz-server/review1.md), [`review2.md`](quiz-server/review2.md)).

**비슷한 문제 막기**: AI에게 새 문제를 시킬 때 그 주제의 문제 은행 + 이미 만든 AI 문제를 먼저 보여 주고 겹치지 않는 새 유형으로 내게 합니다(출제 지침 [`quiz-server/gem.md`](quiz-server/gem.md)). 그래도 비슷한 문제는 글자 2개 묶음 유사도 0.5 이상이면 버립니다 — 퀴즈 AI 서버, 서버 함수, 앱 세 곳에서 같은 방법으로 검사합니다.

### 퀴즈 AI 서버 `POST /quiz`
[`quiz-server/README.md`](quiz-server/README.md) 참고. 요청·응답 형식은 아래 `generate-quiz`와 같습니다. 앱은 `EXPO_PUBLIC_QUIZ_SERVER_URL`이 있을 때만 부릅니다.

### `POST /functions/v1/generate-quiz`
주제 하나의 AI 퀴즈 문제를 `count`개(기본 4) 돌려줍니다.

요청
```json
{ "topicId": "sec-01", "count": 4, "avoid": ["앱이 이미 고른 문제 문장", "…"], "fresh": true }
```
응답 `200`
```json
{
  "questions": [
    { "type": "mc", "q": "…", "choices": ["…", "…", "…", "…"], "answer": 2, "explain": "…" },
    { "type": "ox", "q": "…", "answer": false, "explain": "…" }
  ]
}
```
| 상태 | 언제 | 응답 |
|---|---|---|
| 400 | `topicId`가 없거나 주제 목록에 없음, JSON이 아님 | `{ "error": "unknown topic" }` |
| 405 | POST가 아님 | `{ "error": "method not allowed" }` |
| 429 | AI 사용량 제한 | `{ "error": "rate limited" }` |
| 502 | AI 오류이고 줄 수 있는 문제도 없음 | `{ "error": "…" }` |

- **주제 목록([`topics.json`](supabase/functions/generate-quiz/topics.json))에 있는 주제만** 받습니다. 임의의 글을 보내 AI 비용을 쓰게 할 수 없도록 하기 위해서입니다. 주제를 바꾸면 `python scripts/export_topics.py` 후 다시 배포합니다 (CI가 어긋나면 실패시킴).
- `quizzes` 표에 쌓인 그 주제의 AI 문제 중 문제 은행([`bank.json`](supabase/functions/generate-quiz/bank.json))·`avoid`와 비슷하지 않은 것을 골라 줍니다. 모자라거나 `fresh`일 때 8문제를 새로 만들고 2번 검수해서 통과한 것만 쌓습니다. 주제마다 최대 40문제까지만 만들어서 **AI 비용에 상한**이 있습니다 (그 뒤로는 쌓인 검수 통과 문제로만 냄).
- 출제 지침은 [`gem.json`](supabase/functions/generate-quiz/gem.json) (= `quiz-server/gem.md`를 `export_topics.py`가 복사한 것)입니다.
- 둘러보기 사용자도 쓸 수 있게 `--no-verify-jwt`로 배포합니다. 대신 위의 주제 목록 제한과 캐시로 남용을 막습니다.
- 앱은 응답을 그대로 믿지 않고 `validQuestions()`로 한 번 더 검사합니다. 실패하면 오프라인 연습 문제로 넘어갑니다.

### 서버 함수를 만들 때 지킬 것
1. **입력 검사 먼저**: 정해진 값만 받고, 나머지는 400으로 돌려보냅니다.
2. **오류 응답은 항상 `{ "error": "<짧은 영어 코드>" }`** + 알맞은 HTTP 상태 코드. 사용자에게 보여 줄 한국어 문장은 앱이 만듭니다.
3. **CORS**: `OPTIONS` 요청에 응답하고, 모든 응답에 같은 CORS 헤더를 붙입니다 (웹 버전용).
4. **비밀 키는 `supabase secrets set`으로만** 넣고 코드에 적지 않습니다 (`ANTHROPIC_API_KEY` 등).
5. **비용이 드는 외부 호출은 결과를 저장해서 다시 쓰고**, 같은 요청이 여러 번 와도 결과가 같게(멱등) 만듭니다.
6. **개인정보를 외부 서비스(AI 포함)에 보내지 않습니다.** 퀴즈 생성에는 주제 이름·분야·난이도·힌트만 보냅니다.

### AI 호출 규칙 (Claude API)
- 공식 SDK(`npm:@anthropic-ai/sdk`)만 씁니다. 모델은 `claude-opus-5-5`.
- 결과는 **구조화 출력(JSON 스키마)**으로 받고, 받은 뒤에도 형식을 다시 검사합니다.
- 안전 거절에 대비해 `fallbacks: "default"`(베타 헤더 `server-side-fallback-2026-07-01`)를 켜 둡니다.
- `stop_reason`이 `refusal` 또는 `max_tokens`이면 저장하지 않고 502로 돌려줍니다.
- 프롬프트(출제 기준)는 [`quiz-server/gem.md`](quiz-server/gem.md) 하나로 관리하고, [`docs/quiz-authoring.md`](../docs/quiz-authoring.md)와 같은 기준을 따릅니다.

---

## 5. DB를 바꿀 때

1. [`supabase/schema.sql`](supabase/schema.sql)을 고칩니다. **여러 번 실행해도 안전하게** 씁니다.
   - `create table if not exists`, `alter table … add column if not exists`
   - 정책은 `drop policy if exists` 후 `create policy`
2. **열 이름을 바꾸거나 지우지 않습니다.** 새 열을 추가하고, 앱이 옛 형식도 읽을 수 있게 둡니다 (예: `normalizeRecord`가 옛 별점 기록을 점수로 바꿈).
3. 앱의 변환 함수(`toRow` / `fromRow` 등)와 타입([`app/src/lib/types.ts`](../app/src/lib/types.ts))을 함께 고칩니다.
4. 이 문서의 표 목록을 고칩니다.
5. Supabase 대시보드 SQL Editor에서 `schema.sql` 전체를 실행합니다.

## 6. 새 API를 추가할 때 체크리스트
- [ ] 표라면 RLS를 켜고 본인만 접근하는 정책을 만들었다
- [ ] 비밀 키가 필요한 일은 서버 함수로 만들었다 (앱에 키를 넣지 않았다)
- [ ] 입력 검사 · `{ error }` 응답 · CORS를 넣었다
- [ ] 앱 호출 코드는 `app/src/lib/`에만 두었다
- [ ] 오프라인·서버 없음 상태에서도 앱이 멈추지 않는다 (둘러보기 모드 확인)
- [ ] 이 문서의 API 표를 고쳤다

---

## 7. 직접 호출해 보기 (curl)

```bash
# AI 퀴즈 (주제 id는 topics.json 참고)
curl -X POST "https://<프로젝트 ID>.supabase.co/functions/v1/generate-quiz" \
  -H "apikey: <Publishable key>" -H "Content-Type: application/json" \
  -d '{"topicId":"sec-01","count":4}'

# 퀴즈 AI 서버 (켜 둔 PC 주소)
curl -X POST "http://<PC IP>:8787/quiz" -H "Content-Type: application/json" -d '{"topicId":"ma-linalg-07","count":4}'

# 내 프로필 (로그인해서 받은 access token 필요)
curl "https://<프로젝트 ID>.supabase.co/rest/v1/profiles?select=*" \
  -H "apikey: <Publishable key>" -H "Authorization: Bearer <access token>"
```

## 8. 배포
```bash
cd api
npx supabase login
npx supabase link --project-ref <프로젝트 ID>
npx supabase secrets set ANTHROPIC_API_KEY=<Claude API 키>
npx supabase functions deploy generate-quiz --no-verify-jwt
```
DB 표는 대시보드 **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행해 만듭니다.
