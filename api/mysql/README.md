# MySQL 백엔드 전환 안내

2026-11-12 로컬 작업에서 실제 app/에 인증·프로필·기록·기본 문제의 MySQL 연결을 병합했다. 최신 화면과 로컬 부가 기능은 유지하며 Supabase 모드도 선택할 수 있다. 두 인증 시스템의 계정·토큰·데이터는 자동으로 공유되지 않는다.

## 파일 위치

| 위치 | 역할 |
|---|---|
| `api/supabase/` | 기존 Supabase 구현. 이번 작업에서 변경하지 않음 |
| `api/server/`, `api/shared/` | 서버 실행·기본 문제 DB 적재·공통 처리 |
| `api/mysql/*-service.mjs`, `*-http.mjs` | MySQL 계정·학습 기록·기본 문제 업무 로직 |
| `api/mysql/schema-v2.sql` | 전체 25개 테이블 초기 생성 SQL(지갑 3개·자격증 3개 포함). 빈 DB에 적용 |
| `api/mysql/app-integration/app/` | 이전 앱 전환 후보 파일. 현재 로컬 app/에 필요한 변경을 선별 병합했으며 최신 앱에 통째로 덮어쓰지 않음 |

Supabase 서버 구현은 그대로이며 실제 `app/`에는 연결 변경을 병합했다. 앱 전환 후보를 통째로 덮어쓰기보다 최신 앱과 비교해 전환 부분을 반영한다. 앱 의존성·설정 변경은 `npx expo install expo-secure-store`와 config plugin 설정으로 적용하고, 다른 팀원의 package/lock 파일을 그대로 덮어쓰지 않는다.

## 서버 선택 방법

현재 로컬 실제 앱에서 아래 선택 설정이 유효하다. 로컬 .env.local은 mysql로 설정했으며, 설정이 없을 때 기본값은 supabase다. [병합 범위·실행 안내](../../docs/MYSQL_APP_MERGE.md)를 참고한다.

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
| 앱의 로그인 복원·갱신·계정별 기기 보관 | 실제 로컬 app/에 병합. 실기기 검증은 별도 |
| 이메일 인증 메일·재설정·소셜 로그인 | 미구현 |
| 프로필 조회·저장 | MySQL API 구현·검증 완료 |
| 회원 탈퇴 신청·7일 이내 취소·만료 계정 정리 | 구현·검증 완료. 정리는 명령/스케줄러 실행 필요 |
| 학습 기록·오답·메모·XP 지급/취소·동기화 API | 구현·실제 MySQL 검증 완료. 앱 전환 후보 연결됨 |
| 기본 문제 앱 조회 | MySQL 조회·기기 캐시 연결됨. 전환 후보에만 적용 |
| AI 문제의 MySQL 직접 수신·적재 | 미구현. 현재 AI 서버는 JSON pool 사용 |
| 톱니바퀴 재화 | 이번 공유는 DDL·명세만 포함. 실행 코드·앱 연결은 로컬에 보관 중이며 미업로드. 결제·보상 정책 미확정 |

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

`cd api/server`에서 `npm run records:test`로 검증한다. [검증 기록](RECORD_MYSQL_VALIDATION.md)을 참고한다. 학습 기록 전환 당시에는 기존 19개 테이블을 사용하여 SQL 변경이 없었으며, 변경 코드는 develop에서 공유하며 실제 앱 병합은 별도다.

## 톱니바퀴 MySQL 전환 (2026-11-08 검토 기준)

**2026-11-09 공유 범위:** schema-v2.sql·PPOBGONG_DB_STRUCTURE_V2.md·README.md 세 파일만 develop에 반영한다. 아래 서비스·앱·추가 SQL·테스트 파일은 로컬 구현을 설명하며 이번 업로드에는 포함하지 않는다. 현재 원격 서버에 톱니바퀴 API가 연결됐다는 뜻은 아니다.

GitHub develop 1046c98에서 확인한 톱니바퀴는 Supabase API가 아닌 기기 저장 로직이다. 이를 `wallet-service.mjs`(로컬 파일)·`wallet-http.mjs`(로컬 파일)로 옮기고 전환 후보의 홈·상점·공부 화면에 연결했다. 원래 app과 Supabase·AI 서버는 변경하지 않았다. 최신 develop의 소셜·배틀 기능 전체를 후보에 병합한 작업은 아니다.

- 신규 회원 지갑은 가입 트랜잭션에서 0으로 생성하고, 지갑이 없는 기존 회원도 0으로 보완한다. 기기의 잔액·초기 30개는 서버 보상으로 이전하지 않는다. 초기 보상·유료 결제는 미구현이다.
- 로컬 서버는 검토 당시 develop 1046c98의 개발용 가격을 적용한다(이후 develop의 가격·사용처 변경은 미반영): 2분 연장 10개, 보호권 1개 20개(최대 2개), 연속 기록 복구 하루 20개(최대 2일). 최종 결제 정책을 확정한 것은 아니다.
- 지갑 행 잠금 아래 차감·거래·사용 효과·요청 영수증을 함께 저장한다. 같은 요청은 재처리하지 않는다. 보호권 자동 사용·복구 날짜는 서버 학습 기록과 기존 보호 날짜로 계산하며, 후속 XP의 연속 보너스에도 반영한다. 과거 XP는 소급 재계산하지 않는다.
- 시간 연장은 서버에 세션 식별자·연장 순번별 120초 이용 권한을 기록하고 앱 타이머에 적용한다. 학습 타이머 자체는 여전히 기기에서 동작하며 서버 출제·실제 학습 시간 검증을 추가한 것은 아니다.
- MySQL 재화 사용은 온라인에서만 가능하다. 응답 유실 시 동일 요청으로 재시도한다. 기기의 이전 보호권·복구 날짜를 자동으로 신뢰하거나 이전하지 않는다.

### 테이블과 적용 순서

wallets(잔액), wallet_transactions(증감 원장)에 wallet_operations(중복 처리 영수증·보호권과 보호 날짜 상태)를 추가했다. 마지막 처리의 상태를 서버에서 읽으므로 조회 인덱스는 (user_id, id)다. 무료 보호권 사용도 영수증에 기록하며, 계정 물리 삭제 시 세 테이블 모두 CASCADE로 삭제한다.

기존 DB에는 자동 적용하지 않았다. 지갑 두 테이블을 이미 생성했다면 추가 파일 `wallet-operations.sql`(로컬 파일)만 선택한 테스트 DB에 실행해야 새 서버를 사용할 수 있다. 아직 두 테이블이 없다면 add-wallet-tables.sql → wallet-operations.sql 순서다. schema-v2.sql은 현재 자격증을 포함한 25개 테이블의 빈 DB 초기 생성용이며 기존 DB에 통째로 재실행하지 않는다. 최초 보상 0 정책이므로 정상적인 신규 지갑에는 사용할 재화가 없다. 내부 지급 함수는 준비했지만 임의 지급 HTTP API는 제공하지 않는다.

### API · 검증

GET /me/wallet, GET /me/wallet/transactions, POST /me/wallet/freezes, POST /me/wallet/streak/check, POST /me/wallet/streak/restore, POST /me/wallet/study/extend를 제공한다. 상세 계약과 검증 범위는 `WALLET_MYSQL_VALIDATION.md`(로컬 파일)를 참고한다.

기존 DB 적용 후에는 api/server에서 npm run wallet:test를 실행한다. 별도 빈 임시 DB에서 전체 검증하려면 접속 정보가 있는 환경에서 node --env-file=.env ../mysql/wallet-validate.mjs를 실행한다. 임시 DB 생성·삭제 권한이 필요하며 해당 실행이 생성한 DB만 정리한다. 실기기 검증·실제 앱 병합·결제/멤버십·배틀권은 별도 작업이다. 이번에는 문서·초기 SQL 세 파일만 공유하며, 위 실행 코드·검증 도구와 실제 DB 적용은 별도로 관리한다.

## 자격증 DB 및 Flyway 전환 (2026-11-12)

자격증 목록·시험 과목·과목별 세부분야/주제 연결은 certificates, certificate_subjects, certificate_subject_items에 저장한다.

**현재 설정 DB는 21개 테이블이며 wallet_operations가 없다.** 서비스 DB에는 이번 변경을 적용하지 않았다. V1의 22개 테이블 정의와 차이를 확인·정리하기 전에는 baseline을 실행하지 않는다. 새 프로필 API를 해당 DB에서 사용하기 전 자격증 테이블·초기 데이터도 준비해야 한다. profiles.interests는 기존 JSON 형식을 유지하며 categories와 certificates의 활성 ID를 검증한다.

### 적용 순서

- 이번부터 Flyway로 변경 이력을 관리한다. V1은 변경 전 22개 테이블, V2는 자격증 3개 테이블 추가다. 이후 변경은 V3__설명.sql부터 추가한다. 공유·적용한 마이그레이션은 덮어쓰지 않는다.
- schema-v2.sql은 자격증 포함 25개 테이블의 최신 빈 DB용 스냅샷이다. 기존 DB에 재실행하지 않는다. Flyway 설치와 스냅샷 설치를 같은 DB에 중복 실행하지 않는다.
- 기존 22개 테이블 DB는 구조가 V1과 일치하는지 확인한 후 baselineVersion=1로 명시적으로 baseline하고 migrate한다. baseline은 구조 차이를 고쳐주지 않는다. 일부 지갑 테이블 등이 없는 DB는 먼저 차이를 조정해야 한다.
- 신규 빈 DB는 Flyway migrate로 V1→V2를 적용한다. baselineOnMigrate=false를 유지한다.
- api/mysql에서 Flyway CLI를 실행한다. FLYWAY_URL(jdbc:mysql://호스트:3306/DB), FLYWAY_USER, FLYWAY_PASSWORD는 환경별로 지정한다. Node 서버의 MYSQL_* 환경변수를 Flyway가 자동으로 읽지는 않는다. RDS TLS 설정도 별도로 맞춘다.
- 기존 DB: flyway baseline → flyway info → flyway migrate → flyway validate. 신규 빈 DB: flyway migrate → flyway validate. 서버 시작만으로 자동 실행되지 않는다.
- 테이블 준비 후 api/server에서 npm run db:import로 분류·기본 문제를 적재한 다음, node --env-file-if-exists=.env import-certificates.mjs를 실행한다. 자격증 적재는 npm run db:import-certificates로도 실행할 수 있다. 자격증 초기 데이터는 seeds/certificates.json에 고정하며 TS를 런타임 검증 기준으로 사용하지 않는다.
- 자격증 적재는 전체 참조 검증 후 트랜잭션으로 저장하고 DB별 적재 잠금으로 동시 실행을 직렬화한다. 같은 내용은 재사용하고 DB 내용이 달라졌다면 실패한다. 향후 운영 데이터 변경은 새 마이그레이션으로 명시하며 초기 seed를 덮어쓰는 동기화로 처리하지 않는다.
- MySQL DDL은 전체 트랜잭션 롤백을 기대할 수 없으므로 적용 전 백업·테스트 DB 검증이 필요하다. 실제 Flyway OSS 13.12.1의 migrate·baseline·validate는 임시 DB에서 검증했다. 서비스 DB에는 적용하지 않았다.


### 파일 정리 기준

- 유지: README.md(실행 안내), PPOBGONG_DB_STRUCTURE_V2.md(설계 기준), migrations/(실제 변경 이력), schema-v2.sql(빈 DB 스냅샷), flyway.conf, seeds/, 모든 실행 코드.
- 보관 이동 후보: AUTH_MYSQL_VALIDATION.md, ACCOUNT_MYSQL_VALIDATION.md, RECORD_MYSQL_VALIDATION.md는 docs/mysql-validation/ 등으로 이동 가능하지만 테스트 증빙이므로 삭제를 권하지 않는다. 이동 시 문서 링크도 수정한다.
- schema.sql은 Supabase 전환 초창기 MySQL 초안이다. 현재 설치에 함께 실행하지 않는다. 참조 코드·문서가 남아 있을 수 있으므로 archive/로 이동하려면 저장소 전체 참조를 먼저 수정한다.
- app-integration/은 예전 전환 후보다. 실제 app/과 병합 상태를 대조하기 전에는 삭제하지 않는다.
- 이번 수정본에서는 원본 파일을 삭제하거나 이동하지 않았다.

### 재검증 결과

실제 Flyway 신규 설치·V1 baseline 업그레이드·최신 SQL 직접 생성의 25개 테이블 정의가 일치했다. 자격증 10개·과목 42개·연결 538건을 확인했으며 통합 테스트 63개와 앱 타입·lint 검사가 통과했다. [상세 검증 기록](../../docs/mysql-validation/CERTIFICATE_DB_VALIDATION.md)을 참고한다. api/server에서 npm run certificates:test로 별도 임시 DB 검증을 재실행하며, FLYWAY_EXECUTABLE을 지정하면 실제 CLI도 사용한다. 기본 실행은 SQL 경로만 검증한다.

### 온보딩 관심 분야 상한

프로필 API는 세부분야와 자격증 ID를 합쳐 최대 90개까지 허용한다(현재 세부분야 80개 + 자격증 10개). 91개 이상·중복·미등록·비활성 ID는 거절한다. API 입력 검증 변경이므로 DB 마이그레이션은 필요 없으며 실행 중인 백엔드는 재시작해야 한다. 자격증만 선택한 경우와 전체 90개 선택을 실제 앱 클라이언트로 검증한다.

## MySQL 통합 작업 브랜치 공유 안내

이 브랜치는 기존 develop의 Supabase 연결 코드와 MySQL 전환 작업을 구분하고, 로컬 개발 내용을 팀원 및 EC2에 공유하기 위해 만들었다. main·develop에 병합하거나 PR을 생성하지 않는다.

현재 앱은 여전히 인증 제공자를 선택하는 구조다. 클론만으로 공통 서버에 자동 연결되는 MySQL 전용 배포본은 아니며, 환경별 설정은 예제 파일을 참고해 별도로 준비한다. 비밀번호·개인 키·로컬 환경 파일은 저장소에 포함하지 않는다.

공유 시점의 알려진 제한: schema-v2.sql과 기존 검증 문서 3개가 로컬에서 삭제됐다. setup-db.mjs 및 certificate-validate.mjs에는 삭제된 SQL 참조가 남아 있으므로 db:setup·certificates:test는 정리 전 사용하지 않는다. 빈 DB의 테이블 생성은 api/mysql에서 Flyway migrate·validate로 진행하고 초기 데이터는 별도 적재한다. 기존 문서의 삭제 파일 링크도 추가 정리가 필요하다.
