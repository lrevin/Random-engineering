r"""실시간 서버 시험: python test_server.py ds-01
(server.py 가 다른 창에서 켜져 있어야 함)"""
import json
import sys
import time
import urllib.request

tid = sys.argv[1] if len(sys.argv) > 1 else "ds-01"
token = open("token.txt").read().strip()
print(json.load(urllib.request.urlopen("http://127.0.0.1:8788/health")))
req = urllib.request.Request("http://127.0.0.1:8788/quiz", data=json.dumps({"topicId": tid, "count": 4}).encode(),
                             headers={"Content-Type": "application/json", "X-Quiz-Token": token})
t = time.time()
res = json.load(urllib.request.urlopen(req, timeout=900))
print(f"{time.time() - t:.0f}초, 새로 만든 문제 {res['generated']}개")
for q in res["questions"]:
    ans = q["choices"][q["answer"]] if q["type"] == "mc" else ("O" if q["answer"] else "X")
    print(f"[{q['type']}/{q['source']}] {q['q']}  → 정답: {ans}")
