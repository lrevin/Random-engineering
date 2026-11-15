# 뽑공 팀 개발 약속

> 2026-11-14부터 적용. 사람도, AI 도구(Claude Code, Codex 등)도 이 문서를 따릅니다.
> 규칙을 바꾸고 싶으면 이 파일을 고치는 커밋을 올리고 단톡에 알립니다.

## 0. 한눈에

1. **기준 브랜치는 `develop` 하나뿐**입니다. 모든 작업은 `develop`에서 새 브랜치를 따서 하고, 끝나면 `develop`으로 돌려보냅니다.
2. **작업 브랜치는 짧게** 씁니다. 하루~사흘 안에 `develop`에 합치고 지웁니다. 오래 따로 키우지 않습니다.
3. **올리기 전 검사 4개**를 모두 통과해야 합니다. (아래 4장)
4. **DB 변경은 Flyway 새 파일로만** 합니다. 이미 적용된 파일은 고치지 않습니다.
5. **회원 데이터와 돈이 걸린 값은 서버가 정답**입니다. 앱이 보낸 값으로 재화·보상을 주지 않습니다.
6. **비밀값(키·비밀번호)은 Git에 올리지 않습니다.**

---

## 1. 브랜치

| 브랜치 | 용도 | 누가 올리나 |
|---|---|---|
| `main` | 발표·출시용. 확인이 끝난 `develop`만 합칩니다 | 팀장 |
| `develop` | **팀 공통 최신 코드.** 항상 빌드되고 검사가 통과하는 상태 | 모두 (아래 순서대로) |
| `feature/<짧은-영어-이름>` | 작업 하나 | 각자 |

**작업 순서**

```bash
git checkout develop && git pull origin develop
git checkout -b feature/quest-server          # 작업 시작
# ... 작업 · 커밋 ...
git pull origin develop                       # 올리기 직전에 최신 develop을 내 브랜치에 합침 (충돌은 내 브랜치에서 해결)
# 4장 검사 4개 통과 확인
git checkout develop && git merge --no-ff feature/quest-server && git push origin develop
git push origin --delete feature/quest-server # 다 합쳤으면 지움
```

- 큰 작업(서버 구조, 공용 파일 `app-state.tsx`·`auth-client.ts`·DB 마이그레이션)은 **합치기 전에 단톡에 한 줄** 남깁니다.
- 다른 사람 브랜치에 직접 push하지 않습니다. 필요하면 그 브랜치에서 새 브랜치를 따서 작업하고 주인에게 알립니다.
- **충돌이 나면:** 데이터·인증·지갑·보상 로직은 서버 쪽 코드를 살리고, 화면 모양·문구는 화면 담당 쪽을 살립니다. 애매하면 물어봅니다.

> 2026-11-14 정리: `feature/mysql-backend-integration`, `feature/kakao-admob`, `feature/social-battle`은 모두 `develop`에 합쳤습니다. 앞으로는 `develop`에서 새로 따서 작업합니다.

## 2. 폴더 구조와 담당

| 폴더 | 내용 | 담당 |
|---|---|---|
| `app/` | 모바일 앱 (Expo SDK 57 · React Native · TypeScript · Expo Router) | 이재빈 |
| `app/src/app/` | 화면 (파일 이름 = 주소) | 이재빈 |
| `app/src/components/` | 화면 조각. 아이콘은 `Icon.tsx` SVG만 씀 (UI에 이모지 금지) | 이재빈 |
| `app/src/lib/` | 앱 로직. **서버 호출은 `auth-client.ts`·`api.ts`·`quiz.ts`·`social.ts`·`speed.ts`에서만** | 이재빈 · 김창원 |
| `api/server/` | API 서버 진입점 (`server.mjs`), 인증(`auth.mjs`), 카카오(`kakao.mjs`) | 김창원 |
| `api/mysql/` | 기능별 서비스(`*-service.mjs`) + 주소 처리(`*-http.mjs`) + `migrations/` (Flyway) | 김창원 |
| `api/quiz-server/` | 퀴즈 AI 서버, 생성 문제 저장소(`pools/`) | 강건우 · 김주안 |
| `app/src/data/quizbank/` | 앱에 넣는 기본 문제 은행 (**주제 묶음 형식 `{ "주제id": [문제…] }`만**) | 김주안 |
| `docs/` | 문서. 설정 방법은 `*_SETUP.md`, 기능 규칙은 기능 이름 `.md` | 모두 |
| `scripts/` | 데이터 생성·검사 도구 (Python) | 모두 |

## 3. 코드 규칙

### 공통
- **주석·문서·커밋 메시지는 한국어**로, 무엇을 왜 바꿨는지 씁니다.
- 새 기능을 만들면 그 기능의 규칙(숫자, 제한, 예외)을 `docs/` 또는 파일 맨 위 주석에 남깁니다.

### 앱
- 화면 파일에서 `fetch`를 직접 부르지 않습니다. `lib/`의 함수를 거칩니다.
- **기기 저장(AsyncStorage) 키를 새로 만들면 `app/src/lib/local-data.ts`의 `LOCAL_KEYS`에 먼저 추가**합니다. 회원 캐시는 앱이 자동으로 `pg.mysql.*`로 바꿔 계정마다 나눕니다.
- `app-state.tsx`가 새 모듈을 불러오게 되면 `app/tests/mysql-mode.test.mjs`의 가짜 모듈 목록에도 추가합니다. 안 하면 시험이 "Unexpected dependency"로 실패합니다.
- 색·간격은 `theme.ts` 토큰만, 글자는 `components/ui`의 `T`를 씁니다.

### 서버
- 기능 하나 = `api/mysql/<기능>-service.mjs`(로직, DB) + `<기능>-http.mjs`(주소, 입력 검사) + `server.mjs`에 연결 한 줄.
- 오류 응답은 항상 `{ "error": "<영어 코드>" }` + 상태 코드입니다. 사용자 문장은 앱이 코드로 만듭니다(`lib/auth.ts`의 `authErrorMessage`).
- **재화·보상·권한**:
  - 지급과 차감은 모두 서버 지갑(`wallets`, `wallet_transactions`, `wallet_operations`)에서 합니다.
  - 같은 요청이 두 번 와도 한 번만 처리되게 `request_id` 유일 키를 씁니다.
  - 광고 보상은 AdMob 서버 확인(SSV)으로만 줍니다. 결제는 영수증 확인 후에만 줍니다.
  - 확인 방법이 아직 없는 보상은 `verification_required`(409)로 막아 둡니다. 임시로라도 열지 않습니다.
- 새 주소를 만들면 `api/API_RULES.md` 엔드포인트 목록에 한 줄 추가합니다.

### DB (Flyway)
- 변경은 `api/mysql/migrations/V<다음번호>__<영어_설명>.sql` 새 파일로만 합니다.
- 이미 `develop`에 들어간 V 파일은 **절대 고치지 않습니다** (EC2 DB 이력이 깨짐).
- 번호가 겹치지 않게, 새 마이그레이션을 만들기 시작하면 단톡에 "V7 씀"처럼 알립니다.
- 표를 새로 만들기 전에 기존 표(지갑 원장, 기록 등)로 해결할 수 있는지 먼저 봅니다.

### 문제 은행
- `app/src/data/quizbank/`에는 주제 묶음 형식 파일만 둡니다. 서버가 이 폴더를 그대로 읽어 DB에 넣으므로 다른 형식이 섞이면 서버 시험이 실패합니다.
- AI가 만든 문제, 시험용 mock 데이터는 `api/quiz-server/pools/`에 둡니다(주제별 배열 형식).

## 4. 올리기 전 검사 (모두 통과해야 `develop`에 합침)

```bash
cd app && npx tsc --noEmit && npx eslint src && npm test
cd ../api/server && npm test
```

- 화면을 바꿨으면 에뮬레이터나 휴대폰에서 직접 한 번 열어 봅니다.
- 휴대폰 안쪽 부품(네이티브 모듈)을 추가했으면 **APK를 새로 빌드해야 한다고 단톡에 알립니다.** 예: `expo-audio`, `expo-secure-store`
- `npx expo install <패키지>`로 설치합니다. `npm install`로 넣으면 Expo 57과 버전이 안 맞을 수 있습니다.
  - 예: `expo-audio` 설치 때 `expo-asset` 58이 따라 들어와 빌드가 깨졌습니다.

## 5. 비밀값과 환경 설정

- `.env`, `.env.local`, 키 파일은 Git에 올리지 않습니다. 이름과 설명만 `.env.example`에 적습니다.
- 서버 비밀값(`JWT_SECRET`, DB 비밀번호, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`)은 EC2의 `api/server/.env`에만 둡니다.
- 앱에 들어가도 되는 값(공개 API 주소, AdMob 앱·광고 단위 ID)만 앱 코드나 `EXPO_PUBLIC_*`에 둡니다.
- 비밀값을 채팅·이슈·커밋에 붙여 넣지 않습니다. 실수로 올렸으면 **바로 재발급**합니다.

## 6. AI 도구 사용

- AI에게 작업을 맡길 때도 이 문서를 먼저 읽게 합니다. 저장소 루트의 `CLAUDE.md`, `AGENTS.md`가 이 문서를 가리킵니다.
- AI가 만든 코드도 4장 검사를 통과해야 하고, 커밋은 사람이 확인하고 올립니다.
- AI가 DB 마이그레이션, 지갑·보상 로직, 인증을 고쳤으면 담당자(김창원)가 한 번 봅니다.

## 7. 지금 기준 정보

| 항목 | 값 |
|---|---|
| 공개 API | `https://ppobgong.o-r.kr` (Nginx → EC2:8788 → RDS MySQL) |
| 카카오 개발자 앱 | "뽑공" (앱 ID 1650041), 리다이렉트 `https://ppobgong.o-r.kr/auth/kakao/callback` — [KAKAO_LOGIN_SETUP.md](KAKAO_LOGIN_SETUP.md) |
| AdMob | 앱 ID·보상형 광고 단위는 `app/app.json`, `app/src/lib/ads.ts` — [ADMOB_SETUP.md](ADMOB_SETUP.md) |
| 마지막 마이그레이션 | `V5__battle_matching.sql` (다음은 V6) |
| 진행 현황 | [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) |
