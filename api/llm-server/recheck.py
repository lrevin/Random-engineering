r"""이미 만든 문제(out/pools)를 다른 모델로 한 번 더 검수합니다 (인터넷 필요 없음).
같은 모델이 만들고 검수하면 자기 실수를 못 잡을 수 있어서, 다른 회사 모델로 교차 검수합니다.

사용법 (C:\ppobgong-llm 에서, Ollama 켜져 있어야 함):
  python recheck.py                     out/pools 전체를 gemma3:12b 로 검수
  python recheck.py --model gemma3:12b --limit 20
결과: 통과한 문제만 out/checked/<주제id>.json 에 저장 (이미 검수한 주제는 건너뜀)
      export.py 는 out/checked 가 있으면 그 결과를 씁니다.
"""
import argparse
import glob
import json
import os
import time

import generate as g

HERE = os.path.dirname(os.path.abspath(__file__))
POOLS = os.path.join(HERE, "out", "pools")
CHECKED = os.path.join(HERE, "out", "checked")


def wiki_for(tid):
    for sub in ("wiki_full", "wiki"):
        p = os.path.join(g.DATA, sub, f"{tid}.json")
        if os.path.exists(p):
            return json.load(open(p, encoding="utf8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="gemma3:12b")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    topics = json.load(open(os.path.join(g.DATA, "topics.json"), encoding="utf8"))
    os.makedirs(CHECKED, exist_ok=True)
    files = [f for f in sorted(glob.glob(os.path.join(POOLS, "*.json")))
             if not os.path.exists(os.path.join(CHECKED, os.path.basename(f)))]
    if a.limit:
        files = files[:a.limit]

    def log(msg):
        line = time.strftime("%m-%d %H:%M:%S ") + "[교차검수] " + msg
        print(line, flush=True)
        with open(g.LOG, "a", encoding="utf8") as f:
            f.write(line + "\n")

    log(f"시작: 검수 모델 {a.model}, 주제 {len(files)}개")
    before = after = 0
    t0 = time.time()
    for n, f in enumerate(files, 1):
        tid = os.path.basename(f)[:-5]
        qs = json.load(open(f, encoding="utf8"))
        kept = []
        if qs:
            t, wiki = topics[tid], wiki_for(tid)
            try:
                r1, _ = g.ask(a.model, g.REVIEW1, g.review1_prompt(t, wiki, qs), g.REVIEW1_SCHEMA, think=True)
                by1 = {r.get("index"): r for r in r1.get("results", [])}
                pass1 = [q for i, q in enumerate(qs) if g.pass1(q, by1.get(i))]
                if pass1:
                    r2, _ = g.ask(a.model, g.REVIEW2, g.review2_prompt(t, wiki, pass1), g.REVIEW2_SCHEMA, think=True)
                    by2 = {r.get("index"): r for r in r2.get("results", [])}
                    kept = [{**q, "rechecked": a.model} for i, q in enumerate(pass1) if (by2.get(i) or {}).get("verdict") == "keep"]
            except Exception as e:
                log(f"{tid}: 실패 ({e}) — 다음 실행 때 다시 검수")
                continue
        with open(os.path.join(CHECKED, f"{tid}.json"), "w", encoding="utf8") as out:
            json.dump(kept, out, ensure_ascii=False, indent=1)
        before += len(qs)
        after += len(kept)
        avg = (time.time() - t0) / n
        log(f"{tid} {topics[tid]['ko']}: {len(qs)} → {len(kept)}  (진행 {n}/{len(files)}, 남은 시간 약 {avg * (len(files) - n) / 60:.0f}분)")
    log(f"끝: {before}문제 중 {after}개 통과")


if __name__ == "__main__":
    main()
