# 실제 앱 MySQL 연결 병합 — 2026-11-12

현재 로컬 브랜치 feature/mysql-app-local의 app/에 전환 후보를 파일별로 병합했다. 후보 전체를 덮어쓰지 않았다. 인증·프로필·탈퇴·일반 학습 기록·기본 문제만 MySQL API에 연결하며, 전체 기능의 서버 이전을 의미하지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| app/src/lib/api.ts, auth-client.ts, auth.ts | API 주소, 가입·로그인·회전·프로필·탈퇴·기록 요청과 오류 처리 |
| app/src/lib/auth-storage.ts, auth-storage.native.ts | 웹 탭 저장소 / 모바일 SecureStore로 MySQL 로그인 보관 |
| app/src/lib/app-state.tsx | 현재 배틀·광고·퀘스트·상점·UID 콜백을 유지하고 MySQL 세션·프로필·기록 연결 추가. 제공자별 캐시 분리, 계정별 기록과 최신 로컬 기능 상태 보관 |
| app/src/lib/types.ts, record-sync.ts | 최신 타입에 답안 스냅샷·서버 XP·변경 순번·오프라인 메모 필드 추가 및 동기화 |
| app/src/lib/quiz.ts | 최신 개인 학습·배틀 문제 생성 함수를 보존하고 기본 문제 조회를 MySQL 모드에서 API로 연결 |
| app/src/lib/supabase.ts | MySQL 모드에서는 기존 Supabase 키가 남아 있어도 SDK 초기화하지 않음 |
| app/src/app/login.tsx, signup.tsx, (tabs)/settings.tsx | 제공자별 오류 처리, 탈퇴 취소, MySQL 탈퇴 7일 유예 안내 |
| app/src/app/quiz.tsx | 실제 7문제·제출 답안 전송, 결과 화면은 서버 확정 XP 우선 |
| app/src/app/history.tsx, record/[id].tsx | 현재 화면 디자인을 유지하며 수동 동기화·메모 수정·충돌 선택 연결 |
| app/src/lib/ads.web.ts | 기존 네이티브 광고 코드는 유지. 웹은 기존 시험용 광고 화면을 사용하도록 분리 |
| app/package.json, package-lock.json, app.json | Expo 57에 맞는 expo-secure-store 의존성·플러그인 추가 |
| app/.env.example, .env.local | 선택 예시 추가. 로컬 파일은 mysql 모드로 설정, 기존 다른 값은 보존. 비밀 값은 Git에 추가하지 않음 |
| app/tests/mysql-mode.test.mjs, api/mysql/account-test.mjs, record-test.mjs | 모드 선택 검사와 실제 app/ 클라이언트를 대상으로 한 통합 검사 |

## 로컬 실행

터미널 1: 저장소의 api/server에서 npm start. server/.env의 MySQL 접속·JWT_SECRET과 DB 준비가 필요하다. 기존 DB를 초기화하거나 이 병합에서 데이터 적재하지 않았다.

터미널 2: app에서 npm run web 또는 npx expo start. 로컬 app/.env.local은 EXPO_PUBLIC_AUTH_PROVIDER=mysql이며 API 주소를 사용한다. 기본 로컬 웹 주소는 http://127.0.0.1:8788이다. 주소가 이미 설정되어 있으면 기존 값을 보존했다. Android 에뮬레이터는 http://10.0.2.2:8788 등 기기에서 접근 가능한 주소를 사용한다. 실제 휴대폰은 PC LAN 주소·서버 바인딩을 맞춰야 한다.

원하면 EXPO_PUBLIC_AUTH_PROVIDER=supabase로 기존 경로를 선택할 수 있다. 값이 없을 때 기본값도 supabase다. 설정 변경 후 앱 개발 서버를 다시 시작한다. MySQL 장애 시 Supabase로 자동 전환하지 않는다.

## 범위와 남은 작업

- 매칭·친구·배틀 서버는 기존 EXPO_PUBLIC_SOCIAL_URL을 사용한다. 이 API를 MySQL 인증과 통합한 것은 아니다.
- 톱니바퀴·광고 보상·퀘스트·스킨·프리미엄·보호권·배틀 XP는 기존 최신 로컬 기능으로 유지했다. 이전 대화에서 로컬에만 두었던 wallet 실행 코드는 이 체크아웃에 없어 이번에 병합하지 않았다. 원격에 올라간 wallet DDL만으로 API가 생기지 않는다.
- 현재 MySQL 기록 API는 일반 학습 7문제·전체 답안 계약이다. 이전 요약 기록·5문제 배틀 기록 등은 기기에 보관하고 서버 확정으로 표시하지 않는다. 서버가 계산한 XP를 우선하며 로컬 부스터·배틀 보상 등의 서버 검증은 별도다.
- AI는 별도 퀴즈 서버 설정이 있으면 사용하며, MySQL 모드에서 Supabase generate-quiz를 호출하지 않는다. 서버가 없으면 기존 기본 문제·캐시·오프라인 구성으로 진행한다.
- 실제 앱 병합은 로컬에 완료했으며, 실기기·모든 최신 기능의 종단 검증과 네이티브 설치 빌드는 별도다. 커밋·push하지 않았다.

## 검증

타입 검사·lint, MySQL 모드의 실제 app/ 웹 빌드를 확인했다. 첫 웹 빌드에서 기존 광고 SDK의 네이티브 전용 import를 발견하여 ads.web.ts로 분리했다.

별도 임시 MySQL DB에 현재 SQL의 22개 테이블과 기본 문제를 준비하고 인증·프로필·탈퇴·기록·기본 문제의 실제 병합 클라이언트 테스트를 실행했다. 검증용 DB만 생성·삭제했으며 사용자 DB에는 DDL·테스트 데이터를 적용하지 않았다. 최종 실행에서 46개 테스트가 모두 통과했다.
