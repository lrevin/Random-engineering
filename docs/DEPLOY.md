# 운영 배포 순서 (EC2 · RDS · 강의실 LLM 서버)

지난 배포(2026-11-15)와 같은 방식이다. EC2에 **릴리스 폴더를 새로 만들고** systemd 서비스 `ppobgong-api`가 그 폴더를 가리키게 바꾼다.
이전 릴리스 폴더는 지우지 않는다(되돌릴 때 씀). 비밀값(.env · 토큰 · 키)은 화면에 출력하거나 채팅 · git에 올리지 않는다.

| 누가 | 어디서 | 하는 일 |
|---|---|---|
| 김창원 | EC2 · RDS | API 서버 · DB 마이그레이션 · 터널 받을 준비 |
| 강건우 | 강의실 PC | LLM 서버(`api/llm-server`) · 터널 켜기 |
| 이재빈 | 키 · 계정 | 토스 · SMTP · AdMob 값 준비, 앱 확인 |

이번에 바뀌는 것
- DB: **V9~V14** (스터디 팀 · 보스전 / 라벤더→허니 레몬 / 친구 배틀 · 푸시 / 구독 / 비밀번호 찾기 · 알림 기록 / LLM 생성 작업)
- 서버 패키지: `nodemailer` 추가 · 자격증 10개 → 29개
- AI 퀴즈: Claude 퀴즈 서버(`api/quiz-server`)는 없어졌다. **강의실 PC의 LLM 서버를 SSH 역방향 터널로 연결**한다
  (EC2 `127.0.0.1:18788` → 강의실 PC `127.0.0.1:8788`). 자세한 규격은 [`api/llm-server/API_SPEC.md`](../api/llm-server/API_SPEC.md)

---

## 1. 릴리스 폴더 만들기 (EC2, 김창원)

```bash
cd /home/ubuntu/ppobgong-releases
git clone --branch develop --depth 1 https://github.com/lrevin/Random-engineering.git release-YYYYMMDD
cd release-YYYYMMDD/api/server && npm ci --omit=dev
cp /home/ubuntu/ppobgong-releases/<지난 릴리스>/api/server/.env ./.env && chmod 600 .env
```

기본 문제를 `npm run db:import`로 적재할 때는 분류 데이터 로더가 `app/node_modules/typescript`를 사용한다. 새 릴리스에서 서버 패키지만 설치하면 이 도구가 빠진다. 앱 잠금 파일과 동일한 TypeScript 버전을 별도로 준비하고, **API를 멈추기 전에** 새 릴리스의 `api/server`에서 아래 검사를 통과시킨다.

```bash
node --input-type=module -e "import {loadCatalog} from './catalog.mjs'; console.log(loadCatalog().topics.length)"
```

실시간 AI 생성 문제는 기본 `draft`로 저장한다. 운영 서비스의 `QUIZ_NEW_QUESTION_STATUS=draft` 설정을 확인한다. `published` 전환은 이후 신규 생성분에만 적용되며 기존 초안을 자동 공개하지 않는다.

## 2. `.env`에 새 값 추가 (EC2)

없는 값은 비워 둬도 서버는 켜진다(그 기능만 꺼짐).

| 이름 | 값 | 없으면 |
|---|---|---|
| `QUIZ_SERVER_URL` | `http://127.0.0.1:18788` (터널 주소, 기본값과 같음) | — |
| `QUIZ_SERVER_TOKEN` | 강의실 PC `api/llm-server/token.txt` 의 값 (**강건우에게 직접** 받음) | AI 문제 생성 꺼짐 → 저장 문제 · 문제 은행으로 보충 |
| `ADMOB_REWARDED_UNITS` | 우리 보상형 광고 단위 ID 2개, 쉼표로 | 광고 보상 지급 안 됨 |
| `TOSS_CLIENT_KEY` · `TOSS_SECRET_KEY` | 토스페이먼츠 API 개별 연동 키 (`test_…` → 실결제 `live_…`) | 구독 결제 꺼짐 |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASS` · `MAIL_FROM` | 메일 발송 계정 (구글이면 `smtp.gmail.com` · 587 · 앱 비밀번호) | 비밀번호 찾기 꺼짐 |

`MAIL_DEV_LOG` 는 운영에서 **비워 둔다**. `ANTHROPIC_API_KEY` 는 더 이상 쓰지 않는다.

## 3. API 멈추고 DB 백업 (EC2)

```bash
sudo systemctl stop ppobgong-api
mkdir -p /home/ubuntu/backups/release-YYYYMMDD
mysqldump --single-transaction -h <RDS 주소> -u <계정> -p <DB 이름> > /home/ubuntu/backups/release-YYYYMMDD/database-before.sql
chmod 600 /home/ubuntu/backups/release-YYYYMMDD/database-before.sql
```

## 4. 마이그레이션 V9~V14 (새 릴리스의 `api/server` 에서)

```bash
npm run db:info
npm run db:migrate
npm run db:validate
```
- V9~V14 가 Success, V1~V8 체크섬 오류 없음을 확인한다.
- V10 은 실제 사용자 데이터를 바꾼다: 꾸미기에 `lavender` 0건, `wallet_transactions` 의 `refund:lavender` 건수를 확인해 기록한다.

## 5. 자격증 · 미리 만든 AI 문제 넣기

```bash
npm run db:import-certificates          # {"certificates":29,...}
```
강건우가 미리 만든 AI 문제(`out/ai_quizzes.json`, `python export.py` 로 만듦)를 받았으면:
```bash
npm run ai:import -- --file /home/ubuntu/ai_quizzes.json --report /home/ubuntu/backups/release-YYYYMMDD/ai-import.json
```
보고서의 `rejected`(형식 오류) 수를 확인한다. 이 파일은 저장소에 올리지 않는다.

## 6. 서비스 전환 · 시작 (EC2)

```bash
sudo cp /etc/systemd/system/ppobgong-api.service.d/99-general-rewards.conf /home/ubuntu/backups/release-YYYYMMDD/
# override 파일의 WorkingDirectory 를 새 릴리스의 api/server 로 바꿈
sudo systemctl daemon-reload && sudo systemctl start ppobgong-api && sudo systemctl status ppobgong-api --no-pager
```

## 7. LLM 터널 받을 준비 (EC2, 처음 한 번만)

1. **보안 그룹**: 22번(SSH)을 학교(강의실) 공인 IP 에서만 허용한다.
2. **터널 전용 사용자** (쉘 없음):
   ```bash
   sudo adduser --system --group --shell /usr/sbin/nologin --home /home/ppobgong-tunnel ppobgong-tunnel
   sudo mkdir -p /home/ppobgong-tunnel/.ssh && sudo chmod 700 /home/ppobgong-tunnel/.ssh
   ```
3. **키**: 강건우가 강의실 PC 에서 키를 만들고 **공개키(.pub)만** 보낸다(개인키는 PC 밖으로 안 나감).
   `/home/ppobgong-tunnel/.ssh/authorized_keys` 에 한 줄로, 이 포트로만 터널을 열 수 있게 제한해서 넣는다:
   ```
   restrict,port-forwarding,permitlisten="127.0.0.1:18788" ssh-ed25519 AAAA...(공개키) ppobgong-llm
   ```
   ```bash
   sudo chown -R ppobgong-tunnel:ppobgong-tunnel /home/ppobgong-tunnel/.ssh && sudo chmod 600 /home/ppobgong-tunnel/.ssh/authorized_keys
   ```
4. 강건우에게 EC2 주소와 사용자 이름(`ppobgong-tunnel`)을 알려 준다 → 강건우가 `tunnel.py` 를 켠다.

## 8. 확인

```bash
curl -s https://ppobgong.o-r.kr/health          # mysql · kakao:true
curl -s http://127.0.0.1:18788/health           # (EC2 안) 터널이 연결되면 {"ok":true,"model":"qwen3:14b",...}
journalctl -u ppobgong-api -n 50 --no-pager      # 오류 없는지
```
앱에서: 로그인 · 관심 분야 저장(새 자격증) · 친구 · 배틀 · **공부 시작 → 퀴즈에 AI 문제가 섞여 나오는지** ·
상점 구독 버튼(토스 키가 있으면 활성) · 비밀번호 찾기 메일(SMTP 가 있으면).

통합 테스트(`friend-battle:test` · `subscription:test` · `account-notify:test` 등)는 계정을 만들고 지우므로 **운영 DB 가 아닌 시험용 DB** 에서만 돌린다.

## 9. 되돌리기

1. `sudo systemctl stop ppobgong-api` → 백업해 둔 override 파일로 되돌리고 daemon-reload · start (이전 릴리스 폴더로).
2. DB 는 3번의 덤프로 복원한다. V9~V14 는 대부분 새 표라 그대로 둬도 이전 코드가 돈다. V10 이 바꾼 테마 데이터만 덤프 기준으로 맞춘다.
3. LLM 서버 · 터널이 꺼져도 앱은 멈추지 않는다(저장 문제 · 문제 은행으로 보충). 급하면 `QUIZ_SERVER_TOKEN` 을 비우고 재시작하면 외부 호출을 아예 하지 않는다.


## 10. 운영 데이터 보존·백업·용량 관리

2026-11-22 운영 적용 완료. 사용자 승인 후 EC2 백업·보관 기간 정리·점검 예약과 journal 제한을 설치했다. 첫 백업·점검 성공과 정리 미리보기 0건을 확인했다. S3 미사용·RDS 점검 기준 1일이며, RDS 콘솔 설정·IAM 역할은 변경하지 않았다. 새 DB 테이블·Flyway 변경은 없다.

### 보존 기준

| 대상 | 기준 | 자동 정리 범위 |
|---|---|---|
| 학습·답안·XP·재화·구매·배틀 결과 | 계정 유지 중 보존 | 삭제하지 않음. 기록 삭제 UI는 기존 숨김 유지 |
| 확인 코드 | 만료 후 7일 | 만료 시각 기준. 유효 코드·최근 발송 제한 근거 유지 |
| 로그인 세션·갱신 토큰 | 만료/폐기 후 30일 | 유효 세션·토큰 제외. 소비된 토큰은 소비만으로 지우지 않음 |
| 알림 이력 | 생성 후 90일 | 현재 기간 중복 방지 이력 유지 |
| AI 생성 작업 | 종료 후 90일 | 종료 상태이며 문제·학습 시도가 참조하지 않는 작업만 |
| AI 초안·비활성 문제 | 변경 후 90일 검토 후보 | 풀이·기본 파일 참조 제외. JSON 내 생성 결과·배틀·개인 진행 참조와 재전송 정책까지 추가 검토 후 수동 결정. 도구는 문제를 삭제하지 않음 |
| 취소·만료 매칭 | 만료 후 30일 검토 후보 | 배틀·초대와 연결되지 않은 행만 조회. 요청 UUID 재전송 방지에 쓰이므로 자동 삭제하지 않음 |
| 탈퇴 회원 | 30일 유예 | 기존 API의 시간별 정리를 유지. 운영 도구는 대상 수만 보고 |
| 백업 | 최소 30일 및 최신 3개 | 이 도구가 완료 표시한 백업만 정리. 불완전·기존 미등록 백업 보존 |
| 릴리스 | 최신 3개 및 실제 현재 버전 | 검증 후 명시 등록한 릴리스만 정리. 현재 버전이 오래됐으면 4개 이상 남을 수 있음 |
| 서버 journal | 최대 30일·영구 200MiB·임시 50MiB·여유 1GiB | 로컬 drop-in 예제만 제공. journald 전체에 적용되므로 설치 전에 기존 설정 확인 |

임시 생성 작업의 기한 만료와 보관 데이터 삭제는 별개다. 공개 AI 주제당 40개 제한도 비활성화 기준이며 전체 DB 저장량 상한이 아니다. 유료 운영 전에는 결제 자료의 법정 보관·파기 기준을 별도로 확정한다.

### 미리보기와 실행

릴리스의 `api/server`에서 실행한다. `.env`는 실행 프로세스만 읽고 값·덤프·확인 코드·토큰을 로그나 Git에 넣지 않는다.

```bash
npm run ops:maintenance                    # 삭제하지 않고 종류별 최대 200건 조회
npm run ops:maintenance -- --limit 100      # 한 번 처리할 행 수: 1~1000
npm run ops:audit                          # 테이블별 추정 행 수·용량·디스크 70%/85% 단계·설정된 백업 폴더 용량/정리 후보
```

실제 삭제는 `--apply`가 필요하다. CLI는 최근 48시간 안의 정상 백업과 전체 파일 체크섬을 먼저 검증한다. `OPS_BACKUP_ROOT`의 최신 유효 백업을 사용하거나 `--backup-dir /백업/폴더`를 지정한다. 백업이 없거나 손상됐으면 중단한다.

```bash
npm run ops:maintenance -- --apply --backup-dir /home/ubuntu/backups/backup-실제이름
```

DB별 이름 잠금으로 동시 실행을 차단하고 종류별 트랜잭션·행 잠금·조건 재검사를 한다. 종류별 최대 한 묶음만 처리하며 `possiblyMore`면 다음 실행에 나머지를 처리한다. 한 종류가 실패하면 해당 묶음을 롤백한다. 앞서 완료된 종류는 유지되며 실패 로그의 `completed`로 확인한다. 후보 ID는 문제·매칭만 출력하며 이메일·답안·토큰은 출력하지 않는다. 새 공개 API는 만들지 않았다.

### 백업과 복구 연습

`ops/operations.env.example`을 참고해 실제 운영 설정을 Git 밖 `/etc/ppobgong/operations.env`에 보관한다. 백업 루트를 미리 만들고 소유자만 접근하도록 권한 700, 설정 파일은 600으로 한다. 서비스 설정은 현재 유효 override를 소유자 전용 파일로 복사해 `OPS_SERVICE_CONFIG`로 지정한다. 실제 `.env`는 선택적으로 내용 출력 없이 별도 비밀 파일로 복사한다.

```bash
npm run ops:backup                         # 계획만 표시
npm run ops:backup -- --apply              # DB gzip·코드·서비스·환경 사본·체크섬 생성
```

새 백업은 `.ppobgong-ops.json` 완료 표시가 있어야 정상 백업으로 인정한다. 실패한 폴더는 미완료로 남기고 자동 삭제하지 않는다. DB 덤프는 단일 트랜잭션이며, 마이그레이션·배포와 동시에 실행하지 않는다. 코드 묶음에서 `.env`·키·의존성·네이티브 빌드 캐시는 제외하고 환경 사본만 별도 600 권한으로 보관한다. Linux에서 700/600을 적용하며 Windows로 옮긴 실제 백업은 별도 NTFS 접근 권한도 확인한다.

현재 운영에서는 **S3를 사용하지 않는다.** `OPS_BACKUP_S3`를 설정하지 않고 EC2 내부에 DB·코드·설정 백업을 보관한다. 새 정상 백업을 만든 뒤 등록된 로컬 백업의 최소 30일·최신 3개 정책을 적용한다. 도구의 선택적 S3 업로드 코드는 운영에서 호출하지 않으며 버킷·업로드 IAM 권한도 필요하지 않다.

RDS는 `OPS_RDS_ID`를 설정한 `ops:audit`가 자동 백업 보관 기간·최근 복구 가능 시점·암호화 여부를 읽기 전용 확인한다. **1일 이상 보관·최근 24시간 이내 복구 가능 시점 존재**이 기준이다. AWS CLI·인스턴스 역할이 준비되지 않았으면 운영 설정 완료로 표시하지 않는다. RDS 백업 설정 변경은 별도 운영 적용 작업이다.

복구는 운영 RDS·기존 개발 DB가 아닌 **별도 로컬 MySQL**에서만 실행한다. 실제 RDS 덤프의 복구 연습은 원본과 호환되는 MySQL 서버·클라이언트 버전을 준비한다. 루프백·1024 이상 포트·3306 제외·실제 MySQL 서버 포트 일치까지 검사한다. 해당 서버에 임시 DB·전용 제한 계정을 만들고 압축 덤프를 복원한다. 테스트 계정의 가입·로그인·기록 저장/조회·지갑 조회를 검사한 뒤 임시 DB·계정을 삭제한다. 예시 포트에 RDS SSH 터널을 연결해서는 안 된다.

```bash
# OPS_RESTORE_PASSWORD는 해당 격리 서버 관리자 비밀번호. 운영 비밀번호와 분리한다.
npm run ops:restore -- --backup /백업/폴더 --restore-port 33324 --restore-user root
npm run ops:restore -- --backup /백업/폴더 --restore-port 33324 --restore-user root --apply
```

발표 전 한 번, 중요한 DB 변경 후에 다시 연습한다. 보관된 덤프에는 유예 종료 전 회원 정보가 남아 있을 수 있다. 오래된 백업을 실제 운영에 복구할 때는 별도로 보관한 복구 이후의 탈퇴 처리 내역과 대조하고, 이미 삭제한 회원이 다시 서비스에 노출되지 않게 재삭제·검증한 뒤 공개한다. 이 판단을 자동화하는 외부 탈퇴 이력 저장소는 이번 작업에 추가하지 않았다.

### 릴리스 정리와 예약 설치

처음에는 기존 릴리스·백업을 자동 삭제하지 않는다. 배포 검증이 끝난 폴더만 다음 명령으로 명시 등록한다. 기존 완료 표시를 덮어쓰거나 현재 릴리스 경로를 자동 추정하지 않는다.

```bash
node ../mysql/operations.mjs register-release --root /home/ubuntu/ppobgong-releases --name 실제릴리스이름 --apply
npm run ops:files -- --root /home/ubuntu/ppobgong-releases --kind release --current /home/ubuntu/ppobgong-releases/실제현재릴리스
# 미리보기 검토 뒤 같은 명령에 --apply 추가
```

현재 경로는 `systemctl show ppobgong-api -p WorkingDirectory --value`의 실제 적용 경로를 기준으로 **릴리스 루트까지** 지정한다. 폴더 이름·심볼릭 링크만 보고 판단하지 않는다. 등록되지 않은 폴더는 보고만 하고 심볼릭 링크·현재 폴더·부모 경로는 삭제하지 않는다.

`ops/systemd/` 설정은 운영에 설치·활성화했다. 관리 도구 전용 `/home/ubuntu/ppobgong-current` 링크는 검증된 `operations-02d54a9-20261121` 릴리스를 가리킨다. 후속 배포에서는 Node 경로·사용자·파일 권한과 링크를 다시 확인한다. API 서비스의 WorkingDirectory는 이 템플릿이 변경하지 않는다.

- 매일 한국 시간 03:30: 백업. 설정한 경우 별도 저장소 업로드 후 보관 기간 정리.
- 매일 04:30: 최근 정상 백업 확인 후 DB 정리. 백업 실패 시 삭제도 차단.
- 일요일 05:00: 용량·RDS 백업 상태 점검. 디스크 70%는 주의, 85%는 조치 단계로 JSON 보고.
- 결과는 `journalctl -u 'ppobgong-ops@*'`로 확인. 실행 실패는 종료 코드 1, 디스크 85%·RDS 보관/복구 가능 시점 기준 미달은 코드 2다. 외부 알림 전송은 연결하지 않았다.

서버 재시작으로 놓친 예약은 `Persistent=true`로 보충한다. 백업과 정리가 동시에 보충되면 정리가 먼저 실패할 수 있으므로 정상 백업을 확인한 후 정리만 재실행한다. 백업 시간·보관 기간·디스크 경고는 실제 실행 결과를 주기적으로 확인해야 한다.

### 검사와 팀 공유

`npm run ops:test`는 데이터를 만들고 삭제하는 **격리 시험 DB 전용**이다. `MYSQL_HOST=127.0.0.1`, `MYSQL_DATABASE=ppobgong_ops_test`, 전용 포트와 `OPS_TEST_MYSQL_BIN`을 설정해 실행한다. 실제 덤프·복원은 MySQL 클라이언트·mysqldump·tar가 필요하다. 운영 RDS에서 실행하지 않는다. 서버 기본 `npm test`에는 DB에 접근하지 않는 정책·파일 보호 검사만 들어간다.

develop 병합 전에 운영 보존 정책·관리 CLI·systemd 예제 추가를 팀에 공유한다. 예약·로그 제한은 사용자 별도 승인 후 적용했다. S3는 사용하지 않으며, RDS 설정/조회 권한은 이 도구 배포로 자동 변경하지 않는다.

로컬 검증(2026-11-21): 앱 타입·ESLint·59개, 서버 83개, 임시 MySQL V1~V14의 운영/일반 보상 통합 14개 통과. 실제 덤프 생성·gzip·환경 파일 제외·체크섬·제한 계정 복원·로그인/기록/지갑·다른 DB 생성 차단·임시 DB/계정 정리를 검사했다. 운영 RDS/S3·systemd 설정은 적용하지 않았다. DEVELOPMENT_PROGRESS.md는 사용자가 요청한 복원 상태를 유지했다.


운영 적용 확인(2026-11-22): `operations-02d54a9-20261121` 릴리스에서 서버 83개·V1~V14 검증·HTTPS 읽기 전용 검사 통과. 승인 후 세 timer enabled/active 및 첫 backup/audit 성공 확인. 코드·DB·환경 사본 백업 전체 체크섬 일치, S3 업로드 없음, 정리 미리보기 삭제 0건. RDS 자동 조회는 AWS CLI/IAM 설정이 없어 `not_configured`로 보고한다. 적용 전 메타데이터는 `/home/ubuntu/backups/deploy-operations-02d54a9-20261121/`에 보관했다.
