# 자격증 DB·Flyway 적용 및 재검증 — 2026-11-12

## 반영 범위

제공된 certificate-db-update.zip의 자격증 명세·최신 스키마·V1/V2 마이그레이션·초기 데이터·프로필 검증을 로컬에 반영했다. 기존 실제 app/ 병합 수정은 보존했고 README는 최근 병합 안내에 자격증 내용을 합쳤다. 원본 파일 삭제·이동이나 Git 커밋·push는 하지 않았다.

- certificates, certificate_subjects, certificate_subject_items 추가: 총 25개 업무 테이블
- 초기 데이터: 기존 앱의 10개 자격증 ID·순서·본문과 완전 일치. 과목 42개, 연결 538건
- profiles.interests: 활성 세부분야와 자격증 ID 모두 허용. 미등록·비활성·중복 ID 거절
- import-certificates.mjs: 제공된 적재 절차를 유지하고 함수 호출형 검증과 같은 DB 내 동시 적재 잠금을 추가
- 변경 이력: V1=기존 22개, V2=자격증 3개. V1은 변경 전 초기 SQL과 일치하며 이후 변경은 V3부터 추가

## 실제 MySQL 및 Flyway 검증

MySQL 8.0.46의 고유 이름 임시 DB 3개에서 검증했다.

1. 신규 빈 DB: 실제 Flyway OSS 13.12.1로 migrate(V1→V2), validate 통과
2. 빈 DB: 최신 schema-v2.sql 직접 생성 통과
3. 기존 V1 구조: 실제 Flyway baseline(version 1), migrate(V2), validate 통과

세 경로의 25개 업무 테이블 SHOW CREATE TABLE 결과가 모두 일치했다. Flyway 적용 DB에는 이력 테이블 flyway_schema_history가 별도로 존재한다.

기본 분류·문제와 자격증을 적재한 뒤 기존 인증·프로필·탈퇴·기록·기본 문제·앱 모드 검사와 자격증 검사를 함께 실행했다. 최종 63개 테스트 모두 통과했다.

자격증 검사는 원본 데이터 일치, 모든 연결 순서, 반복·동시 적재, 미등록 참조의 사전 거절, DB 편집 내용 보존, 비활성 상태 보존, 중간 실패 전체 롤백, FK/CHECK/UNIQUE 제약, 실제 병합 앱 클라이언트의 혼합 관심 분야 저장을 포함한다. 앱 타입 검사·lint도 통과했다.

모든 검증 종료 후 해당 실행이 생성한 임시 DB만 삭제했다. 기존 설정 DB에는 DDL·초기 데이터·Flyway 이력을 적용하지 않았다.

## 기존 설정 DB 상태

읽기 전용 확인 결과 업무 테이블 21개, wallet_operations·자격증 테이블·Flyway 이력 테이블은 없다. 따라서 현재 DB에 version 1 baseline을 바로 수행하면 안 된다. V1의 22개 테이블 정의와 실제 구조를 먼저 대조하고 빠진 지갑 영수증 테이블 등 차이를 별도로 정리한 뒤 baseline해야 한다. 테이블 수만 맞추는 것으로 구조 검증을 대신하지 않는다.

프로필 검증 API가 certificates를 참조하므로, 서비스에 새 코드를 반영하기 전에 해당 DB에 V2와 자격증 seed까지 적용해야 한다. 이번 작업은 로컬 파일 반영과 임시 DB 검증만 수행했다.

## 재실행

api/server에서:

- npm run db:import-certificates: 이미 준비된 지정 DB에 초기 자격증 데이터 적재
- npm run certificates:test: 고유 임시 DB 3개를 생성하여 SQL 비교·적재·통합 테스트 후 정리
- 실제 Flyway까지 재검증하려면 FLYWAY_EXECUTABLE에 Flyway 실행 파일 절대 경로를 지정한 뒤 certificates:test 실행. 지정하지 않으면 SQL 직접 실행 경로를 검증하고 CLI 미사용 여부를 출력한다.

검증용 공식 배포본은 작업 폴더 output/tools/flyway/flyway-13.12.1/에만 두었고 시스템 PATH나 저장소에는 설치하지 않았다. 마이그레이션 파일은 적용 후 수정하지 않는다.

앱의 DB 자격증 목록 조회·캐시 전환은 이번 범위에 포함하지 않았으며 여전히 앱의 기존 목록을 사용한다. 기존 목록과 서버 seed가 현재 일치함을 검증했다.
