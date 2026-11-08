# 친구 · 1:1 배틀 API 약속

앱의 친구 탭과 1:1 배틀(랜덤 매칭)이 쓰는 API입니다. 앱 쪽 호출 코드는 [`app/src/lib/social.ts`](../app/src/lib/social.ts) 한 곳에 있습니다.
지금은 같은 약속으로 동작하는 **시험용 서버** [`mock-social/server.mjs`](mock-social/server.mjs)(메모리 저장)로 개발하고, 실제 서비스에서는 [`server/`](server)(MySQL · 로그인 토큰)에 같은 주소로 붙입니다.

## 규칙 요약

| 항목 | 내용 |
|---|---|
| 친구 | 사용자마다 8자리 **UID**(영어 대문자 + 숫자, 0/O·1/I 제외). UID로 친구 신청 → 상대가 수락하면 친구. 서로 신청하면 바로 친구 |
| 랜덤 매칭 | 앱은 **랜덤 매칭만** 씀. 분야·공부 시간은 고르지 않음. 앱이 내 관심 분야(세부 분야 id)와 그 안의 주제 후보 id들을 올리고, 서버는 **서로의 관심 분야에 들어가는 주제**가 있는 상대와 맺음 (먼저 기다린 사람 후보부터) |
| 공부 시간 | **모두 10분 고정** |
| 문제 | **AI가 새로 만들고 2번 검수한 5문제** (퀴즈 AI 서버 `fresh`). 매칭 뒤 공부하는 동안 먼저 기다린 사람(`from`)의 앱이 만들어 `POST /battles/:id/questions`로 올림. 늦으면 상대 앱이 대신 만듦 (먼저 올린 것만 인정). 문제가 늦게 올라오면 퀴즈 시작(`quizStartAt`)도 그만큼 늦춤 |
| 연장전 | **점수가 같으면(만점끼리든 아니든) 비기지 않고 연장전.** 둘 다 제출 안 했으면 무승부. AI가 2문제씩 만들어 두고 한 문제씩 같이 풂(45초). 한 사람만 맞히면 승리, 아니면 다음 문제. 한 문제를 푸는 동안 다음 2문제를 미리 만듦(파이프라인). 10문제까지 가거나 문제가 2분 동안 안 올라오면 무승부 |
| 배틀권 | 매칭을 돌리는 **두 사람 모두 1개씩** 씀. 무료 버전은 매월 1일 00시에 2개로 다시 채움(쌓이지 않음), 유료 버전은 무제한. 톱니바퀴 50개로 살 수 있음(산 배틀권은 안 사라짐, 최대 5개). 취소 · 3분 동안 못 찾으면 돌려줌 |
| 시작 | 매칭되면 서버가 시작 시각(`startAt` = 매칭 + 8초)을 정함. 두 사람 모두 그 시각에 같은 주제가 공개되고 같은 공부 시간이 흐름 |
| 공정성 | **배틀 중 시간 추가 불가.** 공부 시간이 끝나기 전에는 결과를 받지 않음 |
| 퀴즈 | 공부가 끝나면 같은 5문제를 5분 안에 풂. 시간이 끝나면 그때까지 푼 문제로 채점, 안 낸 사람은 0점 |
| 승패 | 정답 수가 많은 사람이 승리. 같으면 연장전 |
| 경험치 이동 | 진 사람 **누적 경험치의 5% (최대 100 XP)** 를 이긴 사람이 가져감. 무승부면 이동 없음 |

## 사용자 구분

- 시험용 서버: 요청 헤더 `x-pg-uid`(UID), `x-pg-name`(닉네임, URL 인코딩), `x-pg-level`, `x-pg-xp`(내 누적 경험치)
- 실제 서버: `Authorization: Bearer <access token>`으로 사용자를 구분하고, UID · 닉네임 · 경험치는 DB에서 읽음 (헤더 값은 믿지 않음)
- 모든 응답에 `serverNow`(서버 시각, ISO)를 넣어 줌 → 앱이 휴대폰 시계 차이를 보정해서 두 사람이 같은 순간에 시작

## 친구

| 메서드 | 주소 | 요청 | 응답 |
|---|---|---|---|
| POST | `/social/me` | `{}` | `200 { ok }` 접속 표시 |
| GET | `/social/friends` | | `200 { friends, incoming, outgoing }` (각 `[{ uid, nickname, level, online }]`) |
| POST | `/social/friends/requests` | `{ uid }` | `200` 친구 목록. `404 not_found` · `400 self` · `409 already_friends / already_requested` |
| POST | `/social/friends/requests/:uid/accept` · `/decline` | | `200` 친구 목록 |
| DELETE | `/social/friends/:uid` | | `200` 친구 목록 |

`online`: 최근 30초 안에 요청이 있었는지.

## 랜덤 매칭

| 메서드 | 주소 | 요청 | 응답 |
|---|---|---|---|
| POST | `/match` | `{ interests: string[], candidates: string[] }` (candidates = 관심 분야 주제 id, 분야마다 3개쯤) | `200 { status: "waiting", id, joinedAt }` 또는 바로 `{ status: "matched", battle }`. 이미 배틀 중이면 `409 busy` |
| GET | `/match` | | `{ status: "none" \| "waiting" \| "matched", … }` (앱이 3초마다 부름. 3분 지나면 `none`) |
| DELETE | `/match` | | `{ status: "none" }` 매칭 취소 |

매칭으로 만든 배틀은 `kind: "random"`, 처음부터 `accepted`이며 아래 배틀 API(`GET /battles/:id`, `POST /battles/:id/result`)를 그대로 씁니다.

## 배틀 (친구 신청 방식 — 지금 앱은 안 쓰지만 API는 남겨 둠)

| 메서드 | 주소 | 요청 | 응답 |
|---|---|---|---|
| POST | `/battles` | `{ opponentUid, domain, topicId, studySec, questions }` | `201 battle`. `403 not_friends` · `409 busy / opponent_busy` |
| GET | `/battles/inbox` | | `200 { incoming: [battle], current: battle \| null }` (앱이 5초마다 부름) |
| GET | `/battles/:id` | | `200 battle` (배틀 화면이 2초마다 부름) |
| POST | `/battles/:id/accept` · `/decline` | | `200 battle` (받은 사람만, pending일 때) |
| POST | `/battles/:id/cancel` | | `200 battle` (신청한 사람만, pending일 때) |
| POST | `/battles/:id/result` | `{ score, total, xp }` | `200 battle`. 퀴즈 시작 전이면 `409 too_early`. 같은 사람이 두 번 내면 처음 것만 인정 |
| POST | `/battles/:id/questions` | `{ batch, questions }` | `200 battle`. batch 0 = 본 문제 5개, 1부터 = 연장전 2문제씩. `batch`가 지금 묶음 수와 같을 때만 저장(먼저 올린 것만 인정) |
| POST | `/battles/:id/overtime` | `{ round, correct }` | `200 battle`. 지금 연장전 문제 번호일 때 한 번만 |

battle 모양
```json
{ "id": "UUID", "status": "pending | accepted | finished | declined | canceled | expired",
  "from": { "uid": "PYJJLHNS", "nickname": "gongdae" }, "to": { "uid": "TESTBOT2", "nickname": "봇친구" },
  "domain": "it", "studySec": 600, "quizSec": 300, "createdAt": "…", "startAt": "… | null",
  "topicId": "pl-04 | null", "questions": [ … ] | null,
  "results": { "PYJJLHNS": { "score": 5, "total": 7, "submittedAt": "…" } },
  "outcome": { "winner": "PYJJLHNS | null", "xp": 45 } | null, "serverNow": "…",
  "kind": "random", "quizCount": 5, "questionsReady": true, "quizStartAt": "… | null",
  "overtime": null | { "round": 0, "question": { … } | null, "roundStartAt": "… | null", "roundSec": 45,
                       "available": 2, "batches": 1, "answers": { "PYJJLHNS": [true], "TESTBOT2": [true] }, "past": [ … ] } }
```

- `questions`(본 문제)는 `quizStartAt`이 지나야 내려줌. 연장전 `question`은 그 문제가 시작됐을 때만.

- 서버는 요청을 받을 때마다 시간을 확인해: 2분 지난 신청은 `expired`, 두 사람 결과가 다 오거나 `startAt + 공부 + 퀴즈 + 15초`가 지나면 `finished`로 채점합니다.
- 한 사람은 동시에 배틀 하나만 (pending · accepted).

## 실제 서버로 옮길 때 (서버 · DB 담당)

1. 표: `friendships(user_a, user_b)`, `friend_requests(from, to)`, `match_queue(user_id, domain, study_sec, joined_at)`, `battles(...)`, `battle_results(battle_id, user_id, score, total)`, 사용자 표에 `friend_uid`(UNIQUE). 매칭은 대기열 잠금(SELECT … FOR UPDATE)으로 한 사람이 두 번 잡히지 않게
2. **경험치 이동은 서버의 XP 원장에 기록**(이긴 사람 +, 진 사람 −, 배틀 id로 한 번만). 지금 앱은 기기에만 반영하므로, 서버 연결 뒤에는 원장 합계를 그대로 씀
3. **배틀권 · 유료 버전도 서버가 관리**(지금은 기기 저장이라 조작 가능). 결제는 앱스토어 · 구글 플레이 인앱 결제 + 서버 영수증 검증
4. 앱이 꺼져 있어도 매칭을 알리려면 푸시 알림(Expo 푸시 토큰 저장 + 매칭 시 발송)이 필요. 지금은 앱이 켜져 있을 때만 확인
5. 점수는 지금 앱이 보낸 값을 믿음(`client_reported`). 정답을 서버가 갖고 채점하면 더 공정함

## 시험해 보기

```bash
FAST=1 node api/mock-social/server.mjs        # FAST=1: 공부 20초 · 퀴즈 60초 (빠른 시험용)
# app/.env.local 에 EXPO_PUBLIC_SOCIAL_URL=http://10.0.2.2:8790 (안드로이드 에뮬레이터)

# 다른 사용자(봇)로 친구 신청 보내기
curl -X POST localhost:8790/social/friends/requests -H "x-pg-uid: TESTBOT2" -H "content-type: application/json" -d '{"uid":"<내 UID>"}'
```
