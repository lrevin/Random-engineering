# LLM 퀴즈 서버 (강건우)

강의실 PC(RTX A4000 16GB)에서 **오픈 모델로 퀴즈를 만드는 서버**입니다. 위키백과 본문을 근거로 문제를 만들고,
두 모델로 검수해서 통과한 문제만 EC2 백엔드에 넘깁니다. Claude API를 쓰는 `api/quiz-server` 를 대신합니다.

| 모델 (Ollama) | 역할 |
|---|---|
| `qwen3:14b` (알리바바) | 문제 생성, 1차·2차 검수 |
| `gemma3:12b` (구글) | 교차 검수 (다른 회사 모델로 한 번 더) |

## 구조

```
[앱] → [EC2 API 서버 (김창원)] ── SSH 역방향 터널 ──▶ [강의실 PC: server.py] → Ollama
                │   EC2 127.0.0.1:18788  →  PC 127.0.0.1:8788
                └─ 터널이 끊기면 DB의 미리 만든 문제 사용
```
- 학교 방화벽은 밖에서 들어오는 접속을 막으므로, **PC가 먼저 EC2로 SSH 연결을 열어 두고** EC2가 그 연결로 요청합니다 (`tunnel.py`).
- 서버는 PC 안(127.0.0.1)에서만 열리고, 요청에는 `X-Quiz-Token` 이 필요합니다. 요청·응답 형식은 [API_SPEC.md](API_SPEC.md).

## 문제를 만드는 과정 (generate.py / server.py 공통)

1. **출제** (qwen3, 생각 끔): 위키백과 본문 + 주제 정보 + 이미 있는 문제 목록을 주고 JSON 형식으로 출제. 문제마다 근거 문장을 본문에서 그대로 옮기게 함
2. **자동 검사**: 말투 규칙 (`prompts/gem.md`), 한자·일본어 섞임, 근거 문장이 본문에 실제로 있는지, 정답이 근거와 맞는지, 비슷한 문제
3. **1차 검수** (qwen3, 생각 켬): 정답을 가리고 직접 풀어 보기 (`prompts/review1.md`)
4. **2차 검수** (qwen3, 생각 켬): 정답·해설까지 보고 판정 (`prompts/review2.md`)
5. **교차 검수** (gemma3): 3·4를 다른 모델로 한 번 더 (`recheck.py`, 실시간은 `QUIZ_REVIEWER=gemma3:12b`)

## 파일

| 파일 | 하는 일 |
|---|---|
| `prepare_data.py` | 저장소의 주제·문제 은행·한국어 위키 연결표를 `data/` 로 모음 |
| `fetch_wiki.py` | 주제별 위키백과 본문 받기 (`--full` 이면 긴 본문). 출처·라이선스(CC BY-SA 4.0) 함께 저장 |
| `generate.py` | 전체 주제 미리 생성 (분야 큰 순서, 이어서 하기 가능) |
| `recheck.py` | 미리 만든 문제를 gemma3로 교차 검수 |
| `export.py` | 결과를 `out/ai_quizzes.json` (주제id → 문제 목록) 으로 합침. 백엔드가 DB로 변환 |
| `server.py` | 실시간 생성 서버 (`POST /quiz`, `GET /health`) |
| `tunnel.py` | EC2 역방향 터널 + 자동 재연결 (`tunnel_config.json` 은 example 을 복사해 작성) |
| `test_server.py` | 실시간 서버 시험 |

## 실행 (Windows, Python 3.12, Ollama)

```powershell
ollama pull qwen3:14b
ollama pull gemma3:12b
cd api\llm-server
py prepare_data.py
py -u fetch_wiki.py; py -u fetch_wiki.py --full
py -u generate.py; py -u recheck.py; py export.py   # 전체 미리 생성 (약 30시간)

# 실시간 (창 2개)
$env:QUIZ_REVIEWER="gemma3:12b"; py -u server.py
py -u tunnel.py
```

## 결과 (2026-11-17)

- 주제 1,054개 중 1,052개 처리, qwen3 검수 통과 2,857문제 → gemma3 교차 검수 통과 **2,145문제** (주제 759개)
- AI 문제가 없는 주제 295개는 팀 문제 은행으로 대체
- 속도: 주제당 약 1~2분 (출제 + 검수), 실시간 요청 약 2~4분

## 올리지 않는 것

`token.txt`, `*.pem`, `tunnel_config.json` (비밀 값), `data/`, `out/` (위 스크립트로 다시 만들 수 있음).
