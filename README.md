# 뽑공 (PPOBGONG)

> 랜덤 공학 주제 하나, **15분 공부하고 퀴즈 10문제**
> 2026학년도 2학기 컴퓨터공학과 졸업작품 (캡스톤 디자인)

공학 11개 분야 · **854개 개념** 중 하나를 랜덤으로 뽑아 위키백과·공식 문서로 15분 동안 스스로 공부하고, **AI가 만든 퀴즈 10문제**로 확인하는 모바일 학습 앱입니다.
듀오링고처럼 매일 알림, 연속 학습 일수(스트릭), **브론즈 → 실버 → 골드 → 플래티넘 → 다이아 → 엔지니어** 랭크로 꾸준한 학습 습관을 만듭니다.

## 팀
| 역할 | 이름 |
|---|---|
| 팀장 | 이재빈 |
| 팀원 | 강건우, 김창원, 김주안 |
| 지도교수 | 심재연 교수님 |

## 학습 흐름
```
회원가입 → 온보딩(공학 분야 여러 개 선택 → 세부 분야 → 시작 난이도 → 알림)
   → 주제 뽑기 → 한국어 위키백과 / 공식 문서 보며 15분 공부 → 퀴즈 10문제 → RP 획득 · 랭크 상승
```

## 주요 기능
- **분야 고르기** — 가입 후 온보딩에서 공학 분야를 카드로 여러 개 선택, 세부 분야와 시작 난이도(Lv.1~3 / 골고루) 설정
- **주제 뽑기** — 관심 분야·난이도 필터, 슬롯머신 애니메이션, 이미 공부한 주제 제외
- **공부 자료 바로가기** — 각 주제의 **실제 한국어 위키백과 문서**(언어 간 링크로 확인한 718개 문서)와, 표준이 있는 주제는 **공식 문서**(RFC·NIST·W3C·WHATWG·ISO·IEEE 등 60개) 버튼
- **15분 공부** — 원형 타이머, 자동 저장 메모, 앱을 껐다 켜도 이어 하기, 끝나는 순간 알림
- **AI 퀴즈 10문제** — 4지선다 7 + OX 3, 문제마다 정답·해설 즉시 표시(듀오링고식 피드백), 틀린 문제 다시 보기
- **랭크 시스템**
  - 사용자 랭크: 퀴즈로 얻은 RP 누적 (브론즈 0 · 실버 300 · 골드 900 · 플래티넘 2,000 · 다이아 4,000 · 엔지니어 7,000)
  - 주제별 숙련 랭크: 그 주제에서 맞힌 문제 누적 (실버 15 · 골드 30 · 플래티넘 45 · 다이아 60 · 엔지니어 75 + 만점 1회)
  - 주제마다 다른 RP: 정답 1개당 Lv.1 4 · Lv.2 6 · Lv.3 9 RP, 만점 +20%, 첫 클리어 +Lv×10, 3일 연속 +10%, 복습은 ×0.7 / ×0.5
- **기록·통계** — 연속 학습 일수 🔥, 최근 7일, 분야별 횟수, 다시 볼 주제(6점 이하), 퀴즈만 다시 풀기
- **매일 알림** — 그날 공부했으면 건너뛰고, 연속 기록이 끊기기 전에 알려 주는 스마트 알림
- **회원 / 둘러보기** — 이메일 회원가입(카카오·Apple 예정) 또는 로그인 없이 사용, 가입 시 기록 이전, 앱 안에서 회원 탈퇴

## AI 퀴즈 구조
- 앱 → Supabase Edge Function [`generate-quiz`](supabase/functions/generate-quiz/index.ts) → Claude API (`claude-opus-5-5`, 구조화 출력)
- **주제마다 한 번만 생성**해서 `quizzes` 표에 저장하고 모든 사용자가 공유 → AI 호출은 최대 854회
- 함수는 [`topics.json`](supabase/functions/generate-quiz/topics.json)에 있는 주제만 받음 (임의 요청으로 비용이 나가지 않도록)
- 15문제를 만들어 두고, 풀 때마다 10문제를 골라 보기 순서를 섞음
- 서버가 없거나 오프라인이면 앱 데이터로 만든 **연습 문제**로 대신함
- 개인정보·공부 기록은 AI에 보내지 않음 (주제 이름·분야·난이도만 전달)

## 수록 분야
| 분야 | 세부 분야 | 주제 수 |
|---|---|---|
| 💻 컴퓨터공학 | 자료구조, 알고리즘, 운영체제, 컴퓨터구조, 네트워크, 데이터베이스, 정보보안 등 12개 | 374 |
| ⚡ 전기·전자공학 | 회로이론, 전자회로, 반도체, 신호, 통신, 전력, 제어 | 70 |
| ⚙️ 기계공학 | 정·동역학, 재료역학, 열역학, 유체역학, 기계설계, 생산가공 | 60 |
| ⚗️ 화학공학 | 화공열역학, 반응공학, 이동현상, 분리공정, 공정제어 | 50 |
| 🌉 토목공학 | 구조, 지반, 수리·수문, 교통·측량, 콘크리트 | 50 |
| 🧪 신소재공학 | 결정구조, 상태도, 기계적 성질, 재료 종류, 재료분석 | 50 |
| 🏗️ 건축공학 | 건축구조, 환경·설비, 시공, 계획 | 40 |
| 📊 산업공학 | 최적화, 품질, 생산·물류, 인간공학 | 40 |
| 🌱 환경·에너지공학 | 수처리, 대기, 폐기물·토양, 신재생에너지 | 40 |
| ✈️ 항공우주공학 | 공기역학, 추진, 비행역학, 궤도역학 | 40 |
| 🧬 바이오·의공학 | 생명공학, 유전공학, 의공학, 생물공정 | 40 |

모든 주제의 영어 이름은 영어 위키피디아 문서 제목과 일치하는지 API로 검증했습니다.

## 기술 스택
| 구분 | 사용 기술 |
|---|---|
| 앱 | React Native 0.86, Expo SDK 57, TypeScript, Expo Router |
| 백엔드 | Supabase (PostgreSQL, Auth, Row Level Security) |
| 알림 | expo-notifications (로컬 알림) |
| AI 퀴즈 | Supabase Edge Functions (Deno) + Anthropic Claude API |
| 협업 | Git / GitHub (Git Flow), GitHub Actions CI |

## 실행 방법
```bash
npm install
npx expo start          # Expo Go 앱으로 QR 코드 스캔
npx expo start --android  # 안드로이드 에뮬레이터
npx expo start --web    # 브라우저
```
서버를 연결하지 않으면 **둘러보기 모드**로 동작합니다.

### Supabase 연결
1. [supabase.com](https://supabase.com)에서 프로젝트 생성 (Region: Seoul)
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql) 실행
3. `.env.example`을 `.env.local`로 복사하고 Project URL, Publishable key 입력
4. AI 퀴즈 함수 배포 ([Supabase CLI](https://supabase.com/docs/guides/cli) 필요):
   ```bash
   npx supabase login
   npx supabase link --project-ref <프로젝트 ID>
   npx supabase secrets set ANTHROPIC_API_KEY=<Claude API 키>
   npx supabase functions deploy generate-quiz --no-verify-jwt
   ```
5. `npx expo start --clear`

주제를 추가·수정하면 다시 실행: `python scripts/export_topics.py` (함수용 주제 목록), `python scripts/fetch_kowiki.py` (한국어 위키백과 문서), `python scripts/check_links.py` (공식 문서 주소 확인)

> 안드로이드 Expo Go(SDK 53+)에서는 알림이 비활성화됩니다. 알림은 개발 빌드(EAS Build)에서 확인하세요.

## 폴더 구조
```
src/
├─ app/          화면 (Expo Router: 파일 하나 = 화면 하나)
│  ├─ (tabs)/    공부 · 기록 · 설정 탭
│  ├─ onboarding.tsx  분야 선택 온보딩
│  ├─ study.tsx  15분 공부
│  ├─ quiz.tsx   퀴즈 10문제
│  └─ result.tsx 결과 · RP · 랭크
├─ components/   공용 UI (타이머 링, 분야·난이도 선택, 랭크 배지, 자료 링크)
├─ lib/          상태·동기화, 퀴즈(quiz.ts), 랭크(rank.ts), 알림, 타이머, 통계
└─ data/         주제 데이터 (분야별 파일), 한국어 위키 문서(kowiki.ts), 공식 문서(links.ts)
supabase/
├─ schema.sql                  DB 스키마 + 보안 정책 (프로필, 기록, 퀴즈 문제 은행)
└─ functions/generate-quiz/    AI 퀴즈 생성 함수
scripts/                       데이터 검증·생성 스크립트
```

## 브랜치 전략 (Git Flow)
- `main` — 배포 가능한 안정 버전
- `develop` — 개발 통합 브랜치
- `feature/<기능명>` — 기능 개발 후 `develop`으로 Pull Request

## 검사
```bash
npx tsc --noEmit   # 타입 검사
npx expo lint      # 코드 검사
```
