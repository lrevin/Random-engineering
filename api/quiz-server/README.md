# 퀴즈 AI 서버 (quiz-server)

개인 PC든 클라우드든 **계속 켜 두고 퀴즈를 찍어내는 출제 AI**입니다.
Gemini의 Gems처럼 출제 지침(`gem.md`)을 한 번 정해 두면, 앱이 요청할 때마다 그 지침대로 문제를 만들어 줍니다.

## 한 퀴즈의 구성 (7문제)

| 문제 | 개수 | 어디서 |
|---|---|---|
| 🤖 AI 출제 | 4 | 이 서버 (없으면 Supabase 함수) |
| 📚 기본 문제 | 3 | 앱에 내장된 문제 은행 `app/src/data/quizbank` |

- AI 문제가 모자라면 기본 문제로, 기본 문제도 없으면 앱이 만든 연습 문제로 채웁니다.

## 비슷한 문제가 나오지 않게 하는 방법

1. AI에게 새 문제를 시킬 때 **우리 문제 은행의 그 주제 문제 + 이미 만든 AI 문제**를 먼저 보여 줍니다.
2. 지침(`gem.md`)에 "이 목록과 겹치지 말고, 상황 판단·비교·계산·오개념 찾기 같은 새로운 유형으로"라고 적어 둡니다.
3. 그래도 비슷하게 나온 문제는 **글자 2개씩 묶음 유사도(자카드 0.5 이상)** 로 한 번 더 걸러 버립니다.
   - 같은 검사를 서버, Supabase 함수, 앱(`app/src/lib/quiz.ts`)에서 모두 합니다.

## 동작

- 주제마다 AI 문제 **창고**를 `data/pools/<주제id>.json`에 쌓아 둡니다.
- 요청이 오면 창고에서 덜 낸 문제부터 골라 줍니다. 창고가 모자라면 그때 새로 만듭니다.
- `QUIZ_WARM=1`이면 요청이 없는 동안에도 창고가 빈 주제부터 계속 문제를 만들어 둡니다.
  - 그래서 학생은 기다리지 않고 바로 퀴즈를 받습니다.

## 켜는 법

```bash
cd api/quiz-server
npm install
cp .env.example .env        # ANTHROPIC_API_KEY 값을 넣기 (.env 는 git에 올라가지 않음)
npm start                   # http://<이 PC IP>:8787
```

- **키 없이 흐름만 시험:** `.env`에 `QUIZ_MOCK=1`을 넣으면 연습용 가짜 문제를 만듭니다.
- **자체 점검:** `npm test`는 연습 모드로 서버를 켜서 요청과 중복 거르기를 확인합니다.

## 앱 연결

`app/.env.local`에 서버 주소를 넣고 앱을 다시 시작합니다.

```
EXPO_PUBLIC_QUIZ_SERVER_URL=http://192.168.0.10:8787
EXPO_PUBLIC_QUIZ_SERVER_TOKEN=(서버 .env 의 QUIZ_TOKEN 과 같은 값, 안 쓰면 비워 둠)
```

- **안드로이드 에뮬레이터:** `adb reverse tcp:8787 tcp:8787`을 하고 `http://127.0.0.1:8787`을 넣습니다.
- **밖에서 접속:** 집 PC를 밖에서 쓰려면 공유기 포트포워딩이나 터널(cloudflared 등)이 필요합니다.
- **토큰 주의:** `QUIZ_TOKEN`은 앱 안에 들어가므로 완전한 비밀은 아닙니다. 아무나 서버를 쓰지 못하게 막는 정도의 문이에요. 주제 목록에 없는 요청은 거절하고, IP마다 1분 30회로 제한합니다.

## API

| 요청 | 본문 | 응답 |
|---|---|---|
| `POST /quiz` | `{ topicId, count?: 1~7 (기본 4), avoid?: 문제 문장[] }` | `{ questions: [...] }` |
| `GET /health` | – | `{ ok, model, topics, pools, stocked, warm }` |

문제 형식은 앱과 같습니다: `{ type: "mc", q, choices[4], answer, explain }` / `{ type: "ox", q, answer: boolean, explain }`

## 설정 (.env)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Claude API 키 (필수, 연습 모드면 없어도 됨) |
| `QUIZ_MODEL` | `claude-opus-5-5` | 출제 모델 |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | 서버 주소 |
| `QUIZ_TOKEN` | (없음) | 정하면 앱이 같은 값을 `x-quiz-token` 헤더로 보내야 함 |
| `QUIZ_WARM` | `0` | `1`이면 쉬는 동안 계속 출제 |
| `QUIZ_POOL_TARGET` | `12` | 주제마다 미리 쌓아 둘 문제 수 |
| `QUIZ_WARM_INTERVAL` | `30` | 계속 출제할 때 주제 사이 간격(초) |
| `QUIZ_BATCH` | `6` | 한 번에 새로 만드는 문제 수 |
| `QUIZ_MOCK` | `0` | `1`이면 API 키 없이 연습용 가짜 문제 |

주제 목록은 `api/supabase/functions/generate-quiz/topics.json`을, 문제 은행은 `app/src/data/quizbank/*.json`을 그대로 읽습니다.
주제나 문제 은행을 바꾸면 `python scripts/export_topics.py`를 실행한 뒤 서버를 다시 켜세요.
