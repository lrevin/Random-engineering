# MySQL 백엔드 안내

현재 실행 대상은 루트 app/과 api/server/입니다. 앱 인증·프로필·기록·기본 문제 조회는 MySQL API를 사용합니다.
예전 제공자 선택과 전환 후보 앱은 제거했습니다. 서버 구현과 검증 명령은 [서버 안내](../server/README.md)를 따릅니다.

## 실행 설정

앱의 app/.env.local에는 EXPO_PUBLIC_API_URL을 설정합니다. 공통 서버는 https://ppobgong.o-r.kr,
Android 에뮬레이터의 PC 백엔드는 http://10.0.2.2:8788입니다.
API 주소를 변경하면 개발 서버를 재시작하거나 APK를 다시 빌드합니다.
서버 비밀번호·JWT_SECRET은 api/server/.env에서만 관리합니다.
공용 주제·출제 지침 JSON은 api/shared/data/에서 관리합니다.

## 구현 현황과 이전 작업 기록

아래는 기능별 구현·설계 이력입니다. 과거 후보·선택 모드에 관한 표현은 당시 기록이며 현재 실행 설정은 위 내용을 따릅니다.

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
| 학습 기록·오답·메모·XP 지급/취소·동기화 API | 구현·실제 MySQL 검증 완료. 실제 app/ 연결됨 |
| 기본 문제 앱 조회 | MySQL 조회·기기 캐시 연결됨. 실제 app/에 적용 |
| AI 문제의 MySQL 직접 수신·적재 | 미구현. 현재 AI 서버는 JSON pool 사용 |
| 톱니바퀴 재화 | 이번 공유는 DDL·명세만 포함. 실행 코드·앱 연결은 로컬에 보관 중이며 미업로드. 결제·보상 정책 미확정 |

전환 앱의 프로필은 MySQL API에서 조회·저장하며 기기에는 캐시한다. 탈퇴는 즉시 이용 중지·세션 폐기 후 7일 뒤 서버 데이터를 삭제하고, 7일 이내에는 로그인 화면에서 비밀번호를 확인하여 취소할 수 있다. 새 학습 기록은 전체 답안과 문제 스냅샷을 MySQL에 저장한다. 오프라인 기록·메모는 기기에 보관하고 연결 후 반영하며, 삭제는 온라인에서 처리한다. 기존 Supabase 계정·기록의 자동 이전은 없다.

## 완전 전환 조건과 검증

서비스에서 사용할 기능 전체의 MySQL API·앱 연결·기존 데이터 이전·통합 테스트가 완료돼야 Supabase를 대체하는 **완전한 백엔드 전환**이 가능하다. 일부 기능의 로컬 보관이나 테이블 생성만으로 전환 완료로 판단하지 않는다. 아직 도입하지 않을 결제·추가 기능은 별도 일정으로 관리한다.

이식 전 작업 폴더에서는 MySQL 8.0.46 인증 테스트 14개·DB 테스트 8개·회귀 테스트 6개와 앱 웹 빌드가 통과했다. 이 폴더에서도 기본 API 회귀 테스트 6개·실제 MySQL 인증 테스트 14개·DB 테스트 8개가 통과했고 인증 선택 설정 5가지 경우를 확인했다. 실제 app/은 MySQL 전용으로 정리했다. 실기기 검증 범위는 별도로 확인한다. 테스트 계정은 생성 후 정리한다. `npm test`, `npm run db:test`, `npm run auth:test`의 실행 범위는 [서버 안내](../server/README.md)와 [기존 인증 검증 기록](AUTH_MYSQL_VALIDATION.md)을 참고한다. DB 테스트·적재는 지정 DB에 기본 문제를 실제 저장하므로 별도 테스트 DB를 사용한다.

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

**2026-11-09 공유 범위:** 당시 초기 SQL·구조 명세·안내 파일만 공유했다(과거 작업 기록). 아래 서비스·앱·추가 SQL·테스트 파일은 로컬 구현을 설명하며 이번 업로드에는 포함하지 않는다. 현재 원격 서버에 톱니바퀴 API가 연결됐다는 뜻은 아니다.

GitHub develop 1046c98에서 확인한 톱니바퀴는 Supabase API가 아닌 기기 저장 로직이다. 이를 `wallet-service.mjs`(로컬 파일)·`wallet-http.mjs`(로컬 파일)로 옮기고 전환 후보의 홈·상점·공부 화면에 연결했다. 원래 app과 Supabase·AI 서버는 변경하지 않았다. 최신 develop의 소셜·배틀 기능 전체를 후보에 병합한 작업은 아니다.

- 신규 회원 지갑은 가입 트랜잭션에서 0으로 생성하고, 지갑이 없는 기존 회원도 0으로 보완한다. 기기의 잔액·초기 30개는 서버 보상으로 이전하지 않는다. 초기 보상·유료 결제는 미구현이다.
- 로컬 서버는 검토 당시 develop 1046c98의 개발용 가격을 적용한다(이후 develop의 가격·사용처 변경은 미반영): 2분 연장 10개, 보호권 1개 20개(최대 2개), 연속 기록 복구 하루 20개(최대 2일). 최종 결제 정책을 확정한 것은 아니다.
- 지갑 행 잠금 아래 차감·거래·사용 효과·요청 영수증을 함께 저장한다. 같은 요청은 재처리하지 않는다. 보호권 자동 사용·복구 날짜는 서버 학습 기록과 기존 보호 날짜로 계산하며, 후속 XP의 연속 보너스에도 반영한다. 과거 XP는 소급 재계산하지 않는다.
- 시간 연장은 서버에 세션 식별자·연장 순번별 120초 이용 권한을 기록하고 앱 타이머에 적용한다. 학습 타이머 자체는 여전히 기기에서 동작하며 서버 출제·실제 학습 시간 검증을 추가한 것은 아니다.
- MySQL 재화 사용은 온라인에서만 가능하다. 응답 유실 시 동일 요청으로 재시도한다. 기기의 이전 보호권·복구 날짜를 자동으로 신뢰하거나 이전하지 않는다.

### 테이블과 적용 순서

wallets(잔액), wallet_transactions(증감 원장)에 wallet_operations(중복 처리 영수증·보호권과 보호 날짜 상태)를 추가했다. 마지막 처리의 상태를 서버에서 읽으므로 조회 인덱스는 (user_id, id)다. 무료 보호권 사용도 영수증에 기록하며, 계정 물리 삭제 시 세 테이블 모두 CASCADE로 삭제한다.

지갑 테이블의 과거 단독 SQL 설치 안내는 더 이상 사용하지 않는다. 현재 설치·변경은 아래 Flyway 절차를 따른다. 최초 보상 0 정책이므로 정상적인 신규 지갑에는 사용할 재화가 없다. 내부 지급 함수는 준비했지만 임의 지급 HTTP API는 제공하지 않는다.

### API · 검증

GET /me/wallet, GET /me/wallet/transactions, POST /me/wallet/freezes, POST /me/wallet/streak/check, POST /me/wallet/streak/restore, POST /me/wallet/study/extend를 제공한다. 상세 계약과 검증 범위는 `WALLET_MYSQL_VALIDATION.md`(로컬 파일)를 참고한다.

기존 DB 적용 후에는 api/server에서 npm run wallet:test를 실행한다. 별도 빈 임시 DB에서 전체 검증하려면 접속 정보가 있는 환경에서 node --env-file=.env ../mysql/wallet-validate.mjs를 실행한다. 임시 DB 생성·삭제 권한이 필요하며 해당 실행이 생성한 DB만 정리한다. 실기기 검증·실제 앱 병합·결제/멤버십·배틀권은 별도 작업이다. 이번에는 문서·초기 SQL 세 파일만 공유하며, 위 실행 코드·검증 도구와 실제 DB 적용은 별도로 관리한다.

## DB 설치·변경: Flyway 마이그레이션

실행 SQL의 기준은 `api/mysql/migrations/`뿐이다. 단일 초기 SQL 스냅샷 실행 경로는 사용하지 않는다.

- V1: 기존 업무 테이블 22개.
- V2: 자격증·시험 과목·과목별 학습 항목 연결 테이블 3개 추가.
- 현재 업무 테이블은 25개이며 Flyway 이력 테이블은 별도로 생성된다.
- 이미 적용한 V1·V2는 수정하지 않는다. 후속 변경은 V3 이상의 새 파일로 추가한다.

Flyway를 PATH에 설치하거나 `FLYWAY_EXECUTABLE`에 실행 파일 경로를 지정한다.
`api/server`의 아래 명령은 `.env`의 MYSQL_*를 Flyway 설정으로 변환한다.
비밀번호는 명령 인자로 전달하지 않으며 RDS CA 지정 시 호스트·인증서를 검증한다.

```bash
# 새 DB 생성 + Flyway migrate + validate
npm run db:setup

# 이미 만든 빈 DB에 설치. 테이블이 하나라도 있으면 거절
npm run db:setup -- --existing-empty

# Flyway 이력이 있는 기존 DB의 상태 확인·추가 변경 적용
npm run db:info
npm run db:migrate
npm run db:validate

# 테이블 준비 후 초기 데이터 적재
npm run db:import
npm run db:import-certificates
```

Flyway 이력이 없는 기존 DB는 V1과 실제 구조가 일치하는지 먼저 확인한다.
일치하는 V1 DB만 `npm run db:baseline -- --baseline-version=1` 후 migrate·validate한다.
이미 V2 구조인 DB는 V2까지 일치하는지 확인한 뒤 version 2를 명시해야 한다.
baseline은 구조를 고치지 않고 적용 기준점만 기록하므로 확인 없이 실행하지 않는다.
`baselineOnMigrate=false`, `cleanDisabled=true`를 유지하며 앱/API 시작 시 자동 적용하지 않는다.

초기 설치 실패 시 새 DB를 자동 삭제하거나 덮어쓰지 않는다. MySQL DDL의 부분 적용이 남을 수 있어 원인을 확인해야 한다.
DDL 설치·업그레이드와 데이터 적재는 별도 명령이다. 운영 DB에 이번 정리를 자동 적용하지 않았다.

## 실제 로컬 DB 통합 검사

`npm run test:integration` 또는 `npm run certificates:test`는 Flyway가 필수다.
로컬 MySQL에 고유 이름의 임시 DB만 생성하고 신규 설치·V1 baseline 전환·반복 migrate·이력 검증과
인증·프로필·탈퇴·학습 기록·XP·동기화·기본 문제·자격증·앱 클라이언트 검사를 실행한다.
이 실행이 생성한 임시 DB만 정리하며 기존 설정 DB와 운영 RDS를 변경하지 않는다.
Flyway가 없을 때 SQL 직접 실행으로 조용히 대체하지 않는다.
