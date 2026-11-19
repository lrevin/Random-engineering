r"""뽑공 실시간 퀴즈 생성 서버 (강의실 PC에서 실행, 인터넷 연결은 터널로만).

실행 (C:\ppobgong-llm 에서, Ollama 켜져 있어야 함):  python server.py
  - 이 PC 안에서만 열립니다 (127.0.0.1:8788). 밖에서는 접속할 수 없고, EC2는 SSH 터널로만 들어옵니다.
  - 처음 실행하면 token.txt 를 만듭니다. EC2 API 서버는 요청 헤더 X-Quiz-Token 에 이 값을 넣어야 합니다.

요청·응답 형식은 API_SPEC.md 를 보세요.
- 새 문제는 generate.py 와 같은 방식(위키백과 근거, 자동 검사, 검수 2번)으로 만듭니다.
- 이미 나온 문제(팀 문제 은행 + 미리 만든 문제 + 전에 실시간으로 만든 문제)를 모델에게 보여 줘서 겹치지 않게 합니다.
- 새로 만든 문제가 모자라면 미리 만든 문제(out/checked, out/pools)로 채웁니다.
- 그래픽카드가 1장이라 요청은 한 번에 하나씩 처리합니다 (나머지는 순서대로 기다림).
"""
import json
import os
import random
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import generate as g

HOST, PORT = "127.0.0.1", int(os.environ.get("QUIZ_PORT", "8788"))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
LIVE = os.path.join(OUT, "realtime")  # 실시간으로 만든 문제 (다음 출제 때 중복 비교 + 창고)
MODEL = os.environ.get("QUIZ_MODEL", "qwen3:14b")
REVIEWER = os.environ.get("QUIZ_REVIEWER", "")  # 비우면 MODEL 로 검수. gemma3:12b 로 바꾸면 교차 검수 (느려짐)
COUNT = 8  # 한 번에 출제 요청하는 수 (검사·검수 후 줄어듦)
ROUNDS = 2  # 모자랄 때 최대 몇 번 만들지
KEYS = ("type", "q", "choices", "answer", "explain")

TOKEN_FILE = os.path.join(HERE, "token.txt")
if not os.path.exists(TOKEN_FILE):
    with open(TOKEN_FILE, "w") as f:
        f.write(secrets.token_urlsafe(24))
TOKEN = open(TOKEN_FILE).read().strip()

TOPICS = json.load(open(os.path.join(g.DATA, "topics.json"), encoding="utf8"))
BANK = json.load(open(os.path.join(g.DATA, "bank.json"), encoding="utf8"))
GPU = threading.Lock()
os.makedirs(LIVE, exist_ok=True)


def load(path):
    try:
        return json.load(open(path, encoding="utf8"))
    except (OSError, ValueError):
        return []


def stored(tid):
    """미리 만든 문제 + 전에 실시간으로 만든 문제"""
    pre = load(os.path.join(OUT, "checked", f"{tid}.json")) or load(os.path.join(OUT, "pools", f"{tid}.json"))
    return pre + load(os.path.join(LIVE, f"{tid}.json"))


def wiki_for(tid):
    for sub in ("wiki_full", "wiki"):
        w = load(os.path.join(g.DATA, sub, f"{tid}.json"))
        if w:
            return w


def log(msg):
    line = time.strftime("%m-%d %H:%M:%S ") + "[실시간] " + msg
    print(line, flush=True)
    with open(g.LOG, "a", encoding="utf8") as f:
        f.write(line + "\n")


def make(tid, want):
    old = stored(tid)
    fresh = []
    start = time.time()
    with GPU:  # 한 번에 하나씩
        # 새 문제가 모자라면 한 번 더 만듦 (학습 15분 안에 끝나도록 6분이 넘으면 멈춤)
        for _ in range(ROUNDS):
            try:
                fresh += g.make_topic(MODEL, REVIEWER or MODEL, tid, TOPICS[tid], wiki_for(tid), BANK, COUNT, log,
                                      extra=old + fresh)
            except Exception as e:
                log(f"{tid}: 생성 실패 ({e}) — 미리 만든 문제로 대신함")
                break
            if len(fresh) >= want or time.time() - start > 360:
                break
    if fresh:
        with open(os.path.join(LIVE, f"{tid}.json"), "w", encoding="utf8") as f:
            json.dump(load(os.path.join(LIVE, f"{tid}.json")) + fresh, f, ensure_ascii=False, indent=1)
    out = [{k: q[k] for k in KEYS if k in q} | {"source": "live"} for q in fresh[:want]]
    if len(out) < want:  # 모자라면 창고에서 채움 (새 문제와 겹치지 않는 것)
        spare = [q for q in old if not g.style_issues(q) and all(g.similarity(q["q"], o["q"]) < 0.5 for o in out)]
        random.shuffle(spare)
        out += [{k: q[k] for k in KEYS if k in q} | {"source": "pool"} for q in spare[:want - len(out)]]
    return out, len(fresh)


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):  # 기본 접속 기록은 끔 (log.txt 에 따로 남김)
        pass

    def authed(self):
        return secrets.compare_digest(self.headers.get("X-Quiz-Token", ""), TOKEN)

    def do_GET(self):
        if self.path != "/health":
            return self.reply(404, {"error": "not found"})
        self.reply(200, {"ok": True, "model": MODEL, "reviewer": REVIEWER or MODEL,
                         "busy": GPU.locked(), "topics": len(TOPICS)})

    def do_POST(self):
        if self.path != "/quiz":
            return self.reply(404, {"error": "not found"})
        if not self.authed():
            return self.reply(401, {"error": "bad token"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0) or b"{}")
        except ValueError:
            return self.reply(400, {"error": "bad json"})
        tid, want = body.get("topicId"), body.get("count", 4)
        if tid not in TOPICS:
            return self.reply(400, {"error": "unknown topicId"})
        if not isinstance(want, int) or not 1 <= want <= 10:
            return self.reply(400, {"error": "count must be 1~10"})
        start = time.time()
        qs, made = make(tid, want)
        log(f"{tid} 요청 {want}개 → 새로 만듦 {made}개, 응답 {len(qs)}개 ({time.time() - start:.0f}초)")
        self.reply(200, {"topicId": tid, "questions": qs, "model": MODEL,
                         "generated": made, "seconds": round(time.time() - start)})


if __name__ == "__main__":
    print(f"실시간 퀴즈 서버: http://{HOST}:{PORT}  (출제 {MODEL}, 검수 {REVIEWER or MODEL})", flush=True)
    print("끄려면 Ctrl + C", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
