"""한국어 위키백과 쪽에서 거꾸로 찾아 kowiki.ts 에 없는 주제를 채웁니다.
주제의 한국어 이름으로 한국어 문서를 찾고, 그 문서의 영어 언어 간 링크가 우리 영어 제목과 같을 때만 넣습니다.
(영어 위키 API가 막혔을 때 쓰는 보조 도구. 평소에는 fetch_kowiki.py 를 쓰세요.)
사용법: python scripts/fetch_kowiki_reverse.py
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
SKIP = ("index.ts", "types.ts", "kowiki.ts", "links.ts", "related.ts")
ROW = re.compile(r'\[\s*"((?:[^"\\]|\\.)+)",\s*"((?:[^"\\]|\\.)+)",\s*[123],')
KO_ROW = re.compile(r'^\s*("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*"),$')

kowiki_path = os.path.join(DATA, "kowiki.ts")
existing = {}
for line in open(kowiki_path, encoding="utf8"):
    m = KO_ROW.match(line)
    if m:
        existing[json.loads(m.group(1))] = json.loads(m.group(2))

pairs = {}
for f in glob.glob(os.path.join(DATA, "*.ts")):
    if os.path.basename(f) in SKIP:
        continue
    for m in ROW.finditer(open(f, encoding="utf8").read()):
        ko, en = json.loads('"' + m.group(1) + '"'), json.loads('"' + m.group(2) + '"')
        if en not in existing:
            pairs[en] = ko


def candidates(ko):
    base = re.sub(r"\s*\(.*?\)\s*", " ", ko).strip()
    out = [ko, base]
    inner = re.findall(r"\((.*?)\)", ko)
    out += [x.strip() for x in inner if re.search(r"[가-힣]", x)]
    return list(dict.fromkeys(x for x in out if x))


def post(params):
    data = urllib.parse.urlencode(params).encode()
    for attempt in range(8):
        try:
            req = urllib.request.Request("https://ko.wikipedia.org/w/api.php", data=data,
                                         headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"})
            return json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("rate limited")


norm_en = lambda s: s.replace("_", " ").strip().lower()
cand_of = {en: candidates(ko) for en, ko in pairs.items()}
all_titles = sorted({c for cs in cand_of.values() for c in cs})
ko_to_en = {}
for i in range(0, len(all_titles), 50):
    batch = all_titles[i:i + 50]
    d = post({"action": "query", "titles": "|".join(batch), "redirects": 1, "prop": "langlinks",
              "lllang": "en", "lllimit": "max", "format": "json"})["query"]
    norm = {x["from"]: x["to"] for x in d.get("normalized", [])}
    redir = {x["from"]: x["to"] for x in d.get("redirects", [])}
    pages = {p["title"]: p for p in d["pages"].values()}
    for t in batch:
        t2 = redir.get(norm.get(t, t), norm.get(t, t))
        ll = pages.get(t2, {}).get("langlinks")
        if ll:
            ko_to_en[t] = (t2, ll[0]["*"])
    time.sleep(2)

added = 0
for en, cs in cand_of.items():
    for c in cs:
        hit = ko_to_en.get(c)
        if hit and norm_en(hit[1]) == norm_en(en):
            existing[en] = hit[0]
            added += 1
            break

out = [
    "// 자동 생성 파일: (저장소 루트에서) python scripts/fetch_kowiki.py",
    "// 영어 위키피디아 문서 제목 → 한국어 위키백과 문서 제목 (위키백과 언어 간 링크 기준)",
    "// 한국어 문서가 없는 주제는 목록에 없습니다.",
    "",
    "export const KO_WIKI: Record<string, string> = {",
]
for k in sorted(existing):
    out.append(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(existing[k], ensure_ascii=False)},")
out.append("};")
open(kowiki_path, "w", encoding="utf8").write("\n".join(out) + "\n")
print(f"찾을 주제 {len(pairs)}개, 새로 넣음 {added}개, 전체 {len(existing)}개")
