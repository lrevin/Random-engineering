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
