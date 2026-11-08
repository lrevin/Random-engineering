# 친구 · 1:1 배틀 API 약속

앱의 친구 탭과 1:1 분야 배틀이 쓰는 API입니다. 앱 쪽 호출 코드는 [`app/src/lib/social.ts`](../app/src/lib/social.ts) 한 곳에 있습니다.
지금은 같은 약속으로 동작하는 **시험용 서버** [`mock-social/server.mjs`](mock-social/server.mjs)(메모리 저장)로 개발하고, 실제 서비스에서는 [`server/`](server)(MySQL · 로그인 토큰)에 같은 주소로 붙입니다.

## 규칙 요약

| 항목 | 내용 |
|---|---|
| 친구 | 사용자마다 8자리 **UID**(영어 대문자 + 숫자, 0/O·1/I 제외). UID로 친구 신청 → 상대가 수락하면 친구. 서로 신청하면 바로 친구 |
| 배틀 신청 | 친구에게만. 분야(DOMAINS id)와 공부 시간(5 · 10 · 15분)을 고르면 신청하는 앱이 그 분야에서 주제 하나와 퀴즈 7문제를 정해 올림 |
| 배틀권 | **신청하는 쪽만** 1개 씀. 무료 버전은 매월 1일 00시에 2개로 다시 채움(쌓이지 않음), 유료 버전은 무제한. 거절 · 무응답(2분) · 취소되면 돌려줌 |
| 수락 | 상대가 수락하면 서버가 시작 시각(`startAt` = 수락 + 8초)을 정함. 두 사람 모두 그 시각에 같은 주제가 공개되고 같은 공부 시간이 흐름 |
| 공정성 | **배틀 중 시간 추가 불가.** 수락 전에는 받는 사람에게 주제 · 문제를 보내지 않음. 공부 시간이 끝나기 전에는 결과를 받지 않음 |
| 퀴즈 | 공부가 끝나면 같은 7문제를 5분 안에 풂. 시간이 끝나면 그때까지 푼 문제로 채점, 안 낸 사람은 0점 |
| 승패 | 정답 수가 많은 사람이 승리, 같으면 무승부 |
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

## 배틀

| 메서드 | 주소 | 요청 | 응답 |
|---|---|---|---|
| POST | `/battles` | `{ opponentUid, domain, topicId, studySec, questions }` | `201 battle`. `403 not_friends` · `409 busy / opponent_busy` |
| GET | `/battles/inbox` | | `200 { incoming: [battle], current: battle \| null }` (앱이 5초마다 부름) |
| GET | `/battles/:id` | | `200 battle` (배틀 화면이 2초마다 부름) |
| POST | `/battles/:id/accept` · `/decline` | | `200 battle` (받은 사람만, pending일 때) |
| POST | `/battles/:id/cancel` | | `200 battle` (신청한 사람만, pending일 때) |
| POST | `/battles/:id/result` | `{ score, total, xp }` | `200 battle`. 공부 시간 전이면 `409 too_early`. 같은 사람이 두 번 내면 처음 것만 인정 |

battle 모양
```json
{ "id": "UUID", "status": "pending | accepted | finished | declined | canceled | expired",
  "from": { "uid": "PYJJLHNS", "nickname": "gongdae" }, "to": { "uid": "TESTBOT2", "nickname": "봇친구" },
  "domain": "it", "studySec": 600, "quizSec": 300, "createdAt": "…", "startAt": "… | null",
  "topicId": "pl-04 | null", "questions": [ … ] | null,
  "results": { "PYJJLHNS": { "score": 5, "total": 7, "submittedAt": "…" } },
  "outcome": { "winner": "PYJJLHNS | null", "xp": 45 } | null, "serverNow": "…" }
```

- 서버는 요청을 받을 때마다 시간을 확인해: 2분 지난 신청은 `expired`, 두 사람 결과가 다 오거나 `startAt + 공부 + 퀴즈 + 15초`가 지나면 `finished`로 채점합니다.
- 한 사람은 동시에 배틀 하나만 (pending · accepted).

## 실제 서버로 옮길 때 (서버 · DB 담당)

1. 표: `friendships(user_a, user_b)`, `friend_requests(from, to)`, `battles(...)`, `battle_results(battle_id, user_id, score, total)`, 사용자 표에 `friend_uid`(UNIQUE)
2. **경험치 이동은 서버의 XP 원장에 기록**(이긴 사람 +, 진 사람 −, 배틀 id로 한 번만). 지금 앱은 기기에만 반영하므로, 서버 연결 뒤에는 원장 합계를 그대로 씀
3. **배틀권 · 유료 버전도 서버가 관리**(지금은 기기 저장이라 조작 가능). 결제는 앱스토어 · 구글 플레이 인앱 결제 + 서버 영수증 검증
4. 앱이 꺼져 있어도 신청을 알리려면 푸시 알림(Expo 푸시 토큰 저장 + 신청 시 발송)이 필요. 지금은 앱이 켜져 있을 때 5초마다 확인
5. 점수는 지금 앱이 보낸 값을 믿음(`client_reported`). 정답을 서버가 갖고 채점하면 더 공정함

## 시험해 보기

```bash
FAST=1 node api/mock-social/server.mjs        # FAST=1: 공부 20초 · 퀴즈 60초 (빠른 시험용)
# app/.env.local 에 EXPO_PUBLIC_SOCIAL_URL=http://10.0.2.2:8790 (안드로이드 에뮬레이터)

# 다른 사용자(봇)로 친구 신청 보내기
curl -X POST localhost:8790/social/friends/requests -H "x-pg-uid: TESTBOT2" -H "content-type: application/json" -d '{"uid":"<내 UID>"}'
```
