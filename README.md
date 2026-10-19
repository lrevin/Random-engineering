# 뽑공 (PPOBGONG)

> 랜덤 주제 하나, **15분 공부하고 2분 설명하기**
> 2026학년도 2학기 컴퓨터공학과 졸업작품 (캡스톤 디자인)

AI 없이 위키·백과사전으로 15분 동안 스스로 공부하고, 메모를 가린 채 2분 동안 소리 내어 설명하는 **파인만 학습법 기반 모바일 학습 앱**입니다.
듀오링고처럼 매일 알림과 연속 학습 일수(스트릭)로 꾸준한 학습 습관을 만들고, 컴퓨터공학·정보보안 개념 374개를 랜덤으로 뽑아 줍니다.

## 팀
| 역할 | 이름 |
|---|---|
| 팀장 | 이재빈 |
| 팀원 | 강건우, 김창원, 김주안 |
| 지도교수 | 심재연 교수님 |

## 주요 기능
- **주제 뽑기** — 관심 분야·난이도 필터, 슬롯머신 애니메이션, 이미 공부한 주제 제외
- **15분 공부** — 원형 타이머, 한국어·영어 위키백과/나무위키 바로가기, 자동 저장 메모
- **2분 설명** — 메모 가리기(누르는 동안만 보기), 남은 30초 경고, 설명 가이드 3단계
- **자기 평가** — 별점 1~5, 잘 설명한 것 / 막혔던 것
- **기록·통계** — 연속 학습 일수 🔥, 최근 7일, 분야별 횟수, 다시 볼 주제(★2 이하)
- **매일 알림** — 그날 공부했으면 건너뛰고, 연속 기록이 끊기기 전에 알려 주는 스마트 알림
- **회원 / 둘러보기** — 이메일 회원가입(카카오·Apple 예정) 또는 로그인 없이 사용, 가입 시 기록 이전
- **이어 하기** — 앱을 껐다 켜도 진행 중이던 타이머와 단계 복원

## 기술 스택
| 구분 | 사용 기술 |
|---|---|
| 앱 | React Native 0.86, Expo SDK 57, TypeScript, Expo Router |
| 백엔드 | Supabase (PostgreSQL, Auth, Row Level Security) |
| 알림 | expo-notifications (로컬 알림) |
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
4. `npx expo start --clear`

> 안드로이드 Expo Go(SDK 53+)에서는 알림이 비활성화됩니다. 알림은 개발 빌드(EAS Build)에서 확인하세요.

## 폴더 구조
```
src/
├─ app/          화면 (Expo Router: 파일 하나 = 화면 하나)
│  ├─ (tabs)/    공부 · 기록 · 설정 탭
│  ├─ study.tsx  15분 공부
│  ├─ explain.tsx 2분 설명
│  └─ finish.tsx 자기 평가
├─ components/   공용 UI (타이머 링, 관심 분야 선택 등)
├─ lib/          상태·동기화, 알림, 타이머, 통계
└─ data/         주제 데이터 (374개)
supabase/schema.sql  DB 스키마 + 보안 정책
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
