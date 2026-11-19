r"""저장소에 있는 주제·문제 은행 자료를 이 폴더의 data/ 로 모읍니다 (처음 한 번만).

사용법 (api/llm-server 에서):  python prepare_data.py
만드는 파일:
  data/topics.json  ← api/shared/data/topics.json (주제 1,054개)
  data/bank.json    ← api/shared/data/bank.json (팀 문제 은행, 겹치지 않게 참고)
  data/kowiki.json  ← app/src/data/kowiki.ts (영어 위키 제목 → 한국어 위키 제목)
그다음 python fetch_wiki.py 와 python fetch_wiki.py --full 로 위키백과 본문을 받습니다.
"""
import json
import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(HERE, "data")


def main():
    os.makedirs(DATA, exist_ok=True)
    for name in ("topics.json", "bank.json"):
        shutil.copy(os.path.join(ROOT, "api", "shared", "data", name), os.path.join(DATA, name))
    src = open(os.path.join(ROOT, "app", "src", "data", "kowiki.ts"), encoding="utf8").read()
    pairs = re.findall(r'^\s*"((?:[^"\\]|\\.)+)":\s*"((?:[^"\\]|\\.)+)",?\s*$', src, re.M)
    kowiki = {json.loads(f'"{k}"'): json.loads(f'"{v}"') for k, v in pairs}
    with open(os.path.join(DATA, "kowiki.json"), "w", encoding="utf8") as f:
        json.dump(kowiki, f, ensure_ascii=False, indent=0)
    print(f"data/ 준비 완료: 주제·문제 은행 복사, 한국어 위키 연결 {len(kowiki)}개")


if __name__ == "__main__":
    main()
