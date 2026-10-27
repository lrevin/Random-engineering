"""앱의 주제 데이터(app/src/data/*.ts)를 서버 함수용 JSON으로 내보냅니다.
퀴즈 생성 함수는 이 목록에 있는 주제만 받아서, 임의의 요청으로 AI 비용이 나가는 것을 막습니다.
사용법: python scripts/export_topics.py   (주제를 추가·수정한 뒤 다시 실행하고 함수를 재배포하세요)
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data")
OUT = os.path.join(ROOT, "api", "supabase", "functions", "generate-quiz", "topics.json")
LEVEL = {1: "기초", 2: "중급", 3: "심화"}

index_src = open(os.path.join(DATA, "index.ts"), encoding="utf8").read()
# DOMAINS 배열 순서대로: { id: "it", name: "컴퓨터공학", ... categories: IT_CATEGORIES }
domains = re.findall(r'\{ id: "([a-z]+)", name: "([^"]+)",.*?categories: ([A-Z]+)_CATEGORIES \}', index_src)
file_of = dict(re.findall(r'import \{ ([A-Z]+)_CATEGORIES, [A-Z]+_RAW \} from "\./([a-z]+)";', index_src))

STR = r'"((?:[^"\\]|\\.)*)"'
CAT = re.compile(r'\{ id: ' + STR + r', name: ' + STR + r', emoji: ' + STR + r' \}')
KEY = re.compile(r'^\s*"?([a-z0-9-]+)"?: \[\s*$')
ROW = re.compile(r'^\s*\[\s*' + STR + r',\s*' + STR + r',\s*([123]),\s*' + STR + r'\s*\],?\s*$')
unq = lambda s: json.loads('"' + s + '"')

topics = {}
for dom_id, dom_name, prefix in domains:
    src = open(os.path.join(DATA, file_of[prefix] + ".ts"), encoding="utf8").read()
    cats_block = src.split("_CATEGORIES")[1].split("];")[0]
    cats = {unq(m.group(1)): unq(m.group(2)) for m in CAT.finditer(cats_block)}
    raw_block = src.split("_RAW")[1]
    current, i = None, 0
    for line in raw_block.splitlines():
        k = KEY.match(line)
        if k:
            current, i = k.group(1), 0
            continue
        r = ROW.match(line)
        if r and current:
            i += 1
            tid = f"{current}-{i:02d}"
            topics[tid] = {
                "ko": unq(r.group(1)), "en": unq(r.group(2)), "lv": int(r.group(3)), "level": LEVEL[int(r.group(3))],
                "hint": unq(r.group(4)), "category": cats.get(current, current), "domain": dom_name,
            }

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(topics, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=0)
print(f"exported {len(topics)} topics -> {os.path.relpath(OUT, ROOT)}")
