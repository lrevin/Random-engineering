# 뽑공 앱 (Expo · React Native)

앱은 자체 MySQL 백엔드 API만 사용합니다. DB에 직접 접속하지 않습니다.

## 서버 주소

`.env.example`을 `.env.local`로 복사하고 `EXPO_PUBLIC_API_URL`을 설정합니다.
팀원용 APK는 `https://ppobgong.o-r.kr`, Android 에뮬레이터의 PC 백엔드는 `http://10.0.2.2:8788`을 사용합니다.
DB 비밀번호·JWT_SECRET·AI 비밀 키는 앱 설정에 넣지 않습니다.

## 개발 및 빌드

```bash
npm ci
npx expo run:android                    # 개발용 앱 최초 설치·네이티브 변경
npx expo start --dev-client --clear     # 설치된 개발용 앱으로 개발
npx expo run:android --variant release  # 코드가 포함된 릴리스 APK
```

API 주소를 바꾸면 개발 서버를 다시 시작하거나 릴리스 APK를 다시 빌드합니다.
릴리스 서명 키는 저장소 밖에서 관리하며 공유 대상에게는 APK만 전달합니다.

## 검증

```bash
npm run typecheck
npm run lint
node --test tests/*.test.mjs
```

로그인 토큰은 모바일 SecureStore, 웹은 탭 단위 sessionStorage에 저장합니다.
기존 MySQL 계정별 로컬 저장 키와 기록·메모 대기 상태를 유지합니다.
기본 문제 은행 전체를 앱에 포함하며 별도 다운로드 없이 사용합니다. 현재 21개 JSON 파일·220개 주제·5,520문제, 원본 합계 2,232,426바이트(약 2.13MiB)입니다. 분야별 다운로드 기능은 제거했습니다. 부분 내장 빌드용 주제 API·캐시 경로는 유지합니다.
AI 생성·친구·배틀은 별도 서버 설정과 구현이 필요하며 MySQL 인증 연결만으로 활성화되지 않습니다.
백엔드 실행과 API는 `../api/server/README.md`를 참고합니다.
