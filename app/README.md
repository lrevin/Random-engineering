# 뽑공 앱 (Expo · React Native)

iOS·안드로이드 공용 앱입니다. 코드 하나로 두 플랫폼을 함께 만듭니다.

## 실행
```bash
npm install
npx expo start            # 개발 서버 (휴대폰 Expo Go로 QR 코드 스캔)
npx expo start --android  # 안드로이드 에뮬레이터
npx expo start --web      # 브라우저
```
- 휴대폰: **Expo Go** 앱 설치 → 컴퓨터와 같은 와이파이 → QR 코드 스캔
  - 아이폰은 기본 카메라 앱으로, 안드로이드는 Expo Go 안의 "Scan QR code"로 스캔
- 에뮬레이터: Android Studio → Device Manager → 가상 기기 ▶ 실행 후 `npx expo start --android`
- 서버(Supabase)를 연결하지 않으면 **둘러보기 모드**로만 동작합니다. 퀴즈는 내장 문제 은행과 연습 문제로 나옵니다.

### 서버 연결
1. `.env.example`을 복사해 `.env.local`로 이름을 바꾸고 Supabase 주소·Publishable key를 넣습니다.
2. `npx expo start --clear`
3. DB와 서버 함수 만드는 법은 [`../api/API_RULES.md`](../api/API_RULES.md)를 봅니다.

> 안드로이드 Expo Go(SDK 53+)에는 알림 모듈이 없어서 알림이 꺼집니다. 알림은 개발 빌드(EAS Build)에서 확인합니다.

## 검사
```bash
npx tsc --noEmit   # 타입 검사
npx expo lint      # 코드 규칙 검사
```

## 폴더 구조
```
src/
├─ app/                화면 (Expo Router: 파일 하나 = 화면 하나)
│  ├─ (tabs)/          공부 · 기록 · 설정 탭
│  ├─ welcome / login / signup / onboarding   첫 화면 · 로그인 · 가입 · 분야 선택 온보딩
│  ├─ study.tsx        15분 공부
│  ├─ quiz.tsx         퀴즈 10문제
│  ├─ result.tsx       결과 · RP · 랭크
│  ├─ wrong/[id].tsx   오답 노트
│  └─ record/[id].tsx  기록 상세
├─ components/         공용 UI (타이머 링, 분야·난이도 선택, 랭크 배지, 자료 링크)
├─ lib/
│  ├─ app-state.tsx    로그인·기록·설정 상태와 서버 동기화 (서버 호출은 여기와 quiz.ts에만)
│  ├─ quiz.ts          퀴즈 불러오기 (내장 → AI → 연습 문제)
│  ├─ rank.ts          RP·랭크 계산
│  ├─ notify.ts        매일 알림 · 타이머 종료 알림
│  └─ useCountdown / useStageTimer / stats …
└─ data/
   ├─ it.ts, ee.ts …   분야별 주제 데이터
   ├─ kowiki.ts        주제별 한국어 위키백과 문서 제목 (자동 생성)
   ├─ links.ts         공식 문서 주소
   └─ quizbank/        내장 퀴즈 문제 은행 (주제당 15문제)
```

## 앱 이름 바꾸기
[`src/config.ts`](src/config.ts)의 `APP_NAME`과 [`app.json`](app.json)의 `name` 두 곳을 고칩니다.
