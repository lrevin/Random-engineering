"""영어 위키피디아 문서 제목 → 한국어 위키백과 문서 제목(언어 간 링크)을 받아 app/src/data/kowiki.ts 로 저장합니다.
사용법: python scripts/fetch_kowiki.py
"""
import glob
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data")
UA = "PpobgongCapstone/1.0 (student project; contact via GitHub)"
SKIP = ("index.ts", "types.ts", "kowiki.ts", "links.ts")
ROW = re.compile(r'\[\s*"((?:[^"\\]|\\.)+)",\s*"((?:[^"\\]|\\.)+)",\s*[123],')

titles = set()
for f in glob.glob(os.path.join(DATA, "*.ts")):
    if os.path.basename(f) in SKIP:
        continue
    for m in ROW.finditer(open(f, encoding="utf8").read()):
        titles.add(json.loads('"' + m.group(2) + '"'))
titles = sorted(titles)


def post(params):
    data = urllib.parse.urlencode(params).encode()
    for attempt in range(6):
        try:
            req = urllib.request.Request(
                "https://en.wikipedia.org/w/api.php", data=data,
                headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
            )
            return json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("rate limited")


result = {}
for i in range(0, len(titles), 50):
    batch = titles[i:i + 50]
    d = post({"action": "query", "titles": "|".join(batch), "redirects": 1, "prop": "langlinks",
              "lllang": "ko", "lllimit": "max", "format": "json"})["query"]
    norm = {x["from"]: x["to"] for x in d.get("normalized", [])}
    redir = {x["from"]: x["to"] for x in d.get("redirects", [])}
    pages = {p["title"]: p for p in d["pages"].values()}
    for t in batch:
        t2 = norm.get(t, t)
        t2 = redir.get(t2, t2)
        ll = pages.get(t2, {}).get("langlinks")
        if ll:
            result[t] = ll[0]["*"]
    time.sleep(1.2)

out = [
    "// 자동 생성 파일: python scripts/fetch_kowiki.py",
    "// 영어 위키피디아 문서 제목 → 한국어 위키백과 문서 제목 (위키백과 언어 간 링크 기준)",
    "// 한국어 문서가 없는 주제는 목록에 없습니다.",
    "",
    "export const KO_WIKI: Record<string, string> = {",
]
for k in sorted(result):
    out.append(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(result[k], ensure_ascii=False)},")
out.append("};")
open(os.path.join(DATA, "kowiki.ts"), "w", encoding="utf8").write("\n".join(out) + "\n")
print(f"titles {len(titles)}, with Korean article {len(result)}")
