# MySQL 백엔드 전환 안내

기존 Supabase 서버와 앱은 유지하고, MySQL 전환 코드를 별도로 준비한 상태다. 두 인증 시스템의 계정·토큰·데이터는 자동으로 공유되지 않는다.

## 파일 위치

| 위치 | 역할 |
|---|---|
| `api/supabase/` | 기존 Supabase 구현. 이번 작업에서 변경하지 않음 |
| `api/server/`, `api/shared/` | 서버 실행·기본 문제 DB 적재·공통 처리 |
| `api/mysql/*-service.mjs`, `*-http.mjs` | MySQL 계정·학습 기록·기본 문제 업무 로직 |
| `api/mysql/schema-v2.sql` | 전체 19개 테이블 초기 생성 SQL. 빈 DB에 적용 |
| `api/mysql/app-integration/app/` | 앱 인증·프로필·학습 기록·기본 문제 전환 후보 파일. 실제 `app/`에는 아직 적용하지 않음 |

기존 `app/` 파일과 Supabase 구현은 그대로다. 앱 전환 후보를 통째로 덮어쓰기보다 최신 앱과 비교해 전환 부분을 반영한다. 앱 의존성·설정 변경은 `npx expo install expo-secure-store`와 config plugin 설정으로 적용하고, 다른 팀원의 package/lock 파일을 그대로 덮어쓰지 않는다.

## 서버 선택 방법

현재 실제 앱은 기존 Supabase 경로다. **아래 설정은 앱 전환 후보를 실제 앱에 반영한 뒤에만 유효하다.**

앱의 `.env.local`에서 선택한다.

```env
# 기존 방식. 설정이 없을 때도 기본값은 supabase
EXPO_PUBLIC_AUTH_PROVIDER=supabase
```

```env
# 새 MySQL API 방식
EXPO_PUBLIC_AUTH_PROVIDER=mysql
EXPO_PUBLIC_API_URL=http://127.0.0.1:8788
```

- 변경 후 앱 개발 서버를 다시 시작하거나 해당 설정으로 빌드한다. 앱 화면은 공통이다.
- MySQL 모드는 API 주소가 필수이며, 실패해도 Supabase로 자동 전환하지 않는다. API 주소만으로 인증 방식을 바꾸지 않는다.
- 모바일 토큰은 SecureStore, 웹 미리보기는 탭 단위 sessionStorage에 별도로 저장한다.
- API 서버는 `api/server/.env`의 MySQL 접속 정보·JWT_SECRET을 사용한다. 앱에는 DB 비밀번호·JWT_SECRET을 넣지 않는다. 실제 `.env`는 이번에 복사하지 않았다.

서버 실행: `cd api/server` → `npm ci` → `.env.example`을 참고해 `.env` 작성 → `npm start`. 기본 포트는 8788이다. Android 에뮬레이터는 `10.0.2.2`, 실제 휴대폰은 PC의 LAN 주소를 앱 API 주소로 사용한다.

## MySQL 구현 현황

| 기능 | 상태 |
|---|---|
| 전체 테이블·기본 문제 직접 적재·문제 조회 API | 구현됨 |
| 이메일 가입·로그인·로그아웃·세션 확인 | 구현됨 |
| JWT·Refresh Token 회전·세션 만료·재사용 차단 | 구현됨 |
| 앱의 로그인 복원·갱신·계정별 기기 보관 | 구현 파일 준비됨. 이 저장소의 실제 앱에는 미적용 |
| 이메일 인증 메일·재설정·소셜 로그인 | 미구현 |
| 프로필 조회·저장 | MySQL API 구현·검증 완료 |
| 회원 탈퇴 신청·7일 이내 취소·만료 계정 정리 | 구현·검증 완료. 정리는 명령/스케줄러 실행 필요 |
| 학습 기록·오답·메모·XP 지급/취소·동기화 API | 구현·실제 MySQL 검증 완료. 앱 전환 후보 연결됨 |
| 기본 문제 앱 조회 | MySQL 조회·기기 캐시 연결됨. 전환 후보에만 적용 |
| AI 문제의 MySQL 직접 수신·적재 | 미구현. 현재 AI 서버는 JSON pool 사용 |
| 톱니바퀴 재화 | 결제 모델 확정 후 DB 반영 예정 |

전환 앱의 프로필은 MySQL API에서 조회·저장하며 기기에는 캐시한다. 탈퇴는 즉시 이용 중지·세션 폐기 후 7일 뒤 서버 데이터를 삭제하고, 7일 이내에는 로그인 화면에서 비밀번호를 확인하여 취소할 수 있다. 새 학습 기록은 전체 답안과 문제 스냅샷을 MySQL에 저장한다. 오프라인 기록·메모는 기기에 보관하고 연결 후 반영하며, 삭제는 온라인에서 처리한다. 기존 Supabase 계정·기록의 자동 이전은 없다.

## 완전 전환 조건과 검증

서비스에서 사용할 기능 전체의 MySQL API·앱 연결·기존 데이터 이전·통합 테스트가 완료돼야 Supabase를 대체하는 **완전한 백엔드 전환**이 가능하다. 일부 기능의 로컬 보관이나 테이블 생성만으로 전환 완료로 판단하지 않는다. 아직 도입하지 않을 결제·추가 기능은 별도 일정으로 관리한다.

이식 전 작업 폴더에서는 MySQL 8.0.46 인증 테스트 14개·DB 테스트 8개·회귀 테스트 6개와 앱 웹 빌드가 통과했다. 이 폴더에서도 기본 API 회귀 테스트 6개·실제 MySQL 인증 테스트 14개·DB 테스트 8개가 통과했고 인증 선택 설정 5가지 경우를 확인했다. 앱 전환 후보는 기본값 Supabase의 명시적 선택 방식으로 보완했으며 실제 앱 병합·실기기 검증은 남아 있다. 테스트 계정은 생성 후 정리한다. `npm test`, `npm run db:test`, `npm run auth:test`의 실행 범위는 [서버 안내](../server/README.md)와 [기존 인증 검증 기록](AUTH_MYSQL_VALIDATION.md)을 참고한다. DB 테스트·적재는 지정 DB에 기본 문제를 실제 저장하므로 별도 테스트 DB를 사용한다.

원래 파일을 보존하면 현재 동작을 보호할 수 있지만, 추후 같은 앱 파일을 수정할 때 생길 Git 병합 충돌까지 자동으로 없어지는 것은 아니다. 전환 준비 코드는 기존 앱과 분리해 관리한다. 공유 시 develop에만 반영하며 main 병합이나 PR 생성은 별도 작업이다.
## 프로필·탈퇴 추가 작업

추가 구현은 이 폴더의 [account-service.mjs](account-service.mjs)·[account-http.mjs](account-http.mjs)·[purge-accounts.mjs](purge-accounts.mjs)에 있고, api/server에서 연결한다. GET/PUT `/me/profile`, DELETE `/me`, POST `/auth/cancel-deletion`을 지원한다. 탈퇴 API는 202와 삭제 예정 시각을 반환하며, 당일 물리 삭제하지 않는다. 기기의 학습 데이터는 신청 성공 시 제거한다.

`cd api/server`에서 `npm run account:test`로 실제 DB 검증, `npm run accounts:purge`로 7일 지난 계정을 최대 100개 정리한다. 정리 명령은 실제 계정을 삭제하므로 운영자가 일일 스케줄에 연결해야 한다. 자동 실행 일정은 아직 설정하지 않았다. 테이블 변경은 없고 기존 users·profiles·세션 구조를 사용한다. [추가 검증 기록](ACCOUNT_MYSQL_VALIDATION.md)을 참고한다. 이 추가 작업은 develop 공유 대상이며 실제 앱 병합은 별도다.
## 학습 기록·기본 문제 추가 작업

- 기록 저장·조회·메모 수정·삭제, 오답 복원, XP 중복 지급 방지·삭제 시 원지급 취소를 지원한다. 구현은 [record-service.mjs](record-service.mjs)와 [record-http.mjs](record-http.mjs)다.
- 현재는 앱이 보낸 전체 문제·답안을 검사하는 `client_reported` 방식이다. 서버가 직접 출제한 답안만으로 채점하는 `server_verified` 방식과 AI 문제 MySQL 수신은 미구현이다.
- 기본 문제는 기존 JSON 원본을 `npm run db:import`로 DB의 문제별 행에 직접 적재한다. [question-service.mjs](question-service.mjs)가 DB를 조회하며, 중간 행별 JSON 파일은 만들지 않는다. 기존 db-store 경로는 호환용으로 유지했다.
- 기존 기기 기록 중 전체 문제·답안이 없는 기록은 임의로 복원하거나 지급하지 않고 기기에 보관한다. Supabase 계정·기록의 자동 이전은 없다.
- 로그인·화면 복귀·새 기록 저장·수동 동기화 때 서버와 맞춘다. 현재 전체 스냅샷 방식이므로 대규모 기록 최적화는 후속 작업이다. 메모 충돌은 사용자가 선택하며, 다른 기기에서 삭제된 기록의 미전송 메모는 계정별 초안으로 별도 보관한다(복구 화면은 미구현).

`cd api/server`에서 `npm run records:test`로 검증한다. [검증 기록](RECORD_MYSQL_VALIDATION.md)을 참고한다. 기존 19개 테이블을 사용하여 SQL 변경은 없으며, 변경 코드는 develop에서 공유하며 실제 앱 병합은 별도다.
