# MySQL 문제 적재와 문제 API

> 실제 app/은 자체 MySQL API 전용입니다. EXPO_PUBLIC_API_URL은 필수이며 인증 제공자 선택 환경변수는 사용하지 않습니다.

기본 JSON 원본을 읽어 **MySQL에 문제별 행으로 직접 저장**한다. 중간 question-rows.json 파일은 생성하지 않는다. 원본 JSON과 AI 생성 서버의 주제별 pool 저장은 유지한다.

필요 환경: Node.js 22.13 이상, MySQL 8.4 권장. 실제 검증은 MySQL 8.0.46에서 수행했다. 기본 분류를 앱 코드에서 읽기 위해 최초 적재 시 app/의 개발 의존성(TypeScript)도 필요하다.

```powershell
cd app
npm ci
cd ../api/server
npm ci
# .env.example을 참고해 .env에 MYSQL_HOST/PORT/USER/PASSWORD/DATABASE 설정
```

`.env`는 Git에서 제외한다. RDS 접속 시 MYSQL_SSL_CA로 CA 인증서를 지정하며 인증서 검증을 끄지 않는다.

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

현재 기본 문제 21개 파일·5,520문제와 마스터 16개 분야·80개 세부 분야·1,054개 주제를 적재한다. 원본 또는 마스터가 변경되면 실제 개수를 다시 검증한다. 같은 파일 버전을 재적재해도 중복 행을 만들지 않는다. 같은 문제 ID의 주제·출처·내용 해시가 충돌하면 실패한다. 적재 중 오류가 나면 전체 DML을 롤백한다.

파일 변경 시 새 버전을 등록하고 기존 버전을 비활성화한다. 변경되지 않은 문제 행은 공유한다. 폴더에서 제거된 기본 파일은 DB에서도 출제를 중단하고 원본 위치 이력은 보존한다. 분류 마스터의 기존 정의 변경은 자동 덮어쓰지 않고 별도 변경으로 처리한다.

## 문제 API

MYSQL_USER가 설정돼 있으면 MySQL을 직접 조회한다. DB 연결 실패 시 JSON으로 몰래 대체하지 않는다. MySQL 설정이 없으면 기존 JSON 모드로 실행할 수 있다.

- `GET /health`: 저장 방식(mysql/json)과 데이터 수. 인증·프로필·기록 API 활성 상태도 표시한다.
- `GET /quiz-bank/:topicId`: 기존 `{ questions: [...] }` 응답. `/api/quiz-bank/:topicId`도 지원한다.
- 활성 분야·세부 분야·주제 및 공개 문제·공개 파일 버전에 연결된 기본 문제만 제공한다.
- 알려진 활성 주제에 문제가 없으면 200과 빈 배열, 없는/비활성 주제는 404다.
- ETag·CORS 지원. DB 장애는 503이며 DB 오류 상세·접속 정보는 응답에 포함하지 않는다.
- 기존 오프라인 학습 계약처럼 정답·해설을 포함한다. 온라인 서버 채점용 출제 API가 아니다.

앱의 `EXPO_PUBLIC_API_URL`에 서버 주소를 지정한다. Android 에뮬레이터는 `http://10.0.2.2:8788`, 실제 기기는 PC의 LAN 주소와 서버 HOST=0.0.0.0을 사용한다. 앱 캐시는 7일이며 네트워크 실패 시 캐시·내장 문제로 학습한다.

## 검증 범위

- `npm test`: JSON 검증·병합·식별자·파일 처리·기존 HTTP 회귀 테스트.
- `npm run db:test`: 현재 테이블·FK·CHECK·UNIQUE, 5,520문제 원본 대조, 중복 없는 재적재, MySQL HTTP 조회, 실패 시 롤백, 메모 순번 UPDATE 및 기록 삭제·XP 취소·삭제 표식의 SQL 처리 검증.

이메일 가입·로그인·세션 유지 API는 MySQL로 구현했다. 프로필 조회·저장과 7일 유예 회원 탈퇴·취소·정리 기능도 MySQL로 구현했다. 학습 기록·XP·동기화 API와 실제 app/의 연결도 구현되어 있다. 통신 실패 시 기기에 보관하고 재전송한다.

AI pool은 아직 별도 JSON 저장이다. AI 문제의 MySQL 수신·적재는 LLM 전달 형식 확정 후 연결한다. 톱니바퀴 테이블은 결제 모델 확정 전이므로 생성하지 않는다.
## 이메일 인증과 로그인 유지

서버 .env에 최소 32바이트의 임의 JWT_SECRET을 설정한다. 이 값은 앱에 넣지 않는다. 현재 로컬 서버에는 임의 키를 생성해 설정했다. .env와 앱의 .env.local은 Git에서 제외한다.

| 메서드 | 경로 | 동작 |
|---|---|---|
| POST | /auth/signup | 이메일·비밀번호로 계정 생성, 로그인 토큰 발급 |
| POST | /auth/login | 비밀번호 확인 후 새 로그인 세션 생성 |
| POST | /auth/refresh | Refresh Token 회전과 Access Token 재발급 |
| POST | /auth/logout | 해당 로그인 세션과 Refresh Token 폐기, 204 |
| GET | /auth/me | Bearer Access Token으로 사용자·계정 상태 확인 |

/api 접두사도 지원한다. signup/login/refresh 응답은 accessToken·refreshToken·expiresIn·user를 포함한다. expiresIn은 900초, 세션 절대 만료는 로그인 후 30일이다. 비밀번호는 8자 이상, UTF-8 72바이트 이하다(글자 종류 제한 없음). BCrypt 비용은 12다.

이메일 인증 메일은 아직 도입하지 않았다. 현재 가입은 email_verified_at=NULL로 로그인하며, 메일을 보냈다고 표시하지 않는다. 소셜 로그인·비밀번호 재설정·기존 Supabase 계정 이전은 이번 범위가 아니다.

Refresh Token은 48바이트 무작위 값이며 DB에는 SHA-256만 저장한다. 회전은 사용자→세션→토큰 순서의 잠금과 트랜잭션으로 처리한다. 소비된 토큰 재사용 시 해당 세션을 폐기하는 엄격한 개발 정책을 적용한다. 응답 유실에 대한 유예는 없다. 앱의 동시 갱신 요청은 하나로 합친다. 기존 명세대로 로그아웃은 Refresh Token을 폐기하며 이미 발급한 Access Token은 최대 15분간 유효하다. deleting 계정과 auth_version 불일치는 즉시 거절한다.

모바일 로그인 정보는 expo-secure-store, 웹 미리보기는 탭 단위 sessionStorage에 보관한다. 앱 재시작·화면 복귀·활성 중 주기 확인으로 세션을 검증·갱신한다. 네트워크 오류 시 로그인 정보를 유지하고, 갱신 거절 시 로그인 정보를 지운다. 오프라인 로그아웃은 기기 정보를 지우지만 통신 실패 시 서버 세션 폐기까지 보장하지 않는다.

실제 앱은 프로필을 서버에서 조회·저장하고, 탈퇴 신청 성공 시 로그인을 지운다. 탈퇴는 즉시 접근 차단 후 7일 뒤 데이터 삭제이며 7일 이내 비밀번호 확인으로 취소할 수 있다. 학습 기록의 MySQL 동기화는 실제 app/에 연결했다.

```powershell
npm run auth:test
```

실제 MySQL·HTTP API와 앱의 인증 클라이언트를 함께 테스트한다. 테스트 계정은 종료 시 삭제한다. IP 요청 제한·형식 검사·16KB 요청 크기 제한·인증 응답 no-store·비밀번호 및 토큰 원문 로그 금지를 적용했다. 운영 배포 시 HTTPS가 필요하다.
## 프로필·회원 탈퇴 API

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | /me/profile | 인증한 본인 프로필, 미등록 시 404 |
| PUT | /me/profile | 본인 프로필 전체 생성·수정, 입력·관심 분야 코드 검사 |
| DELETE | /me | 7일 유예 탈퇴 신청, 모든 세션 폐기, auth_version 증가, 202 |
| POST | /auth/cancel-deletion | email/password 확인 후 7일 이내 신청 취소, 취소 후 새 로그인 필요 |

프로필은 nickname·interests·level·studyMinutes·reminderEnabled·reminderTime을 사용한다. 요청 사용자 ID는 소유권에 사용하지 않는다. `npm run accounts:purge`는 기간이 지난 deleting 계정과 소유 데이터를 FK 순서에 맞춰 트랜잭션으로 삭제한다. 실패 시 해당 사용자 삭제를 롤백한다. 이 명령의 일일 스케줄 등록은 운영 작업이며 자동 설정하지 않았다. 현재 취소는 이메일·비밀번호 계정만 지원한다. `npm run account:test`로 검증한다.
## 학습 기록 API

모든 /me 경로는 본인 Access Token이 필요하며 요청의 userId를 신뢰하지 않는다.

| 메서드 | 경로 | 동작 |
|---|---|---|
| PUT | /me/records | records 배열 1~100개, 각 5~10문제(일반 기본 7)·답안·학습 시각·메모 저장. 항목별 성공/실패 반환 |
| GET | /me/records | limit 1~100과 cursor로 기록 목록 조회 |
| GET | /me/records/snapshot | 일관된 전체 기록과 변경 커서 조회. 실제 app/에서 사용 |
| GET | /me/records/changes | cursor 이후 변경·삭제 조회. 만료된 커서는 409 full_resync_required |
| GET | /me/records/:id | 문제 스냅샷·제출 답안·오답을 포함한 기록 상세 |
| PUT | /me/records/:id/memo | memo·baseChangeSeq로 수정. 충돌 시 409와 서버 기록 반환 |
| DELETE | /me/records/:id | 기록·답안 삭제, XP 원지급 취소, 삭제 표식 저장. 같은 요청 재전송은 204 |
| GET | /me/stats | XP 원장 합계·주제별 기록 통계 |

기록 ID와 attemptId를 재사용해 XP를 재지급할 수 없다. 삭제 후에도 완료된 시도와 XP 원장을 보관한다. 기록 내용은 불변이며 메모만 별도로 수정한다. XP·오답·주제 정보는 서버에서 계산한다. 문제와 정답 자체는 앱이 보낸 스냅샷이므로 검증 상태는 client_reported다. 오래된 기록(30일 초과)·5분 초과 미래 시각은 연속 학습 날짜에 포함하지 않는다. 오래된 기록의 기본 XP는 지급한다.

기록 업로드는 최대 4MB, 그 외 JSON 요청은 16KB다. 삭제 표식에 90일 만료 시각을 저장하지만 정리 작업은 아직 자동화하지 않았다. 현재 표식을 계속 보존하므로 삭제 동기화가 일찍 끊기지 않는다. 운영 전 정리 작업과 min_available_seq 갱신을 함께 구현해야 한다.

기본 문제는 GET /quiz-bank/:topicId로 MySQL의 공개 문제만 읽는다. 빈 주제는 빈 배열, 비활성·없는 주제는 404이며 ETag를 지원한다. JSON 원본 적재는 기존 db:import 명령을 사용한다.
