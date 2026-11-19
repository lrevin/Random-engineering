r"""주제마다 위키백과 본문 앞부분(요약)을 받아 data/wiki/<주제id>.json 으로 저장합니다.

사용법 (C:\ppobgong-llm 에서):  python fetch_wiki.py
- 한국어 위키백과 문서가 있으면 한국어, 없으면 영어 문서를 씁니다.
- 이미 받은 주제는 건너뛰므로, 중간에 멈춰도 다시 실행하면 이어서 받습니다.
- 출처: 위키백과 (CC BY-SA 4.0). 각 파일에 문서 주소와 라이선스를 함께 저장합니다.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
FULL = "--full" in sys.argv  # 문서 본문을 길게 받기 (한 번에 1개씩)
OUT = os.path.join(DATA, "wiki_full" if FULL else "wiki")
UA = "PpobgongCapstone/1.0 (university capstone project; quiz generation)"
BATCH = 1 if FULL else 20  # 요약은 20개씩, 본문 전체는 1개씩만 받을 수 있음


def api(lang, titles):
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "prop": "extracts", "explaintext": "1", "exsectionformat": "plain",
        **({} if FULL else {"exintro": "1"}),
        "redirects": "1", "titles": "|".join(titles),
    }
    url = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return json.load(urllib.request.urlopen(req, timeout=30))
        except (urllib.error.URLError, TimeoutError) as e:
            wait = 5 * (attempt + 1)
            print(f"  다시 시도 ({e}) {wait}초 후")
            time.sleep(wait)
    raise RuntimeError("위키백과에 접속하지 못했습니다")


def fetch(lang, titles):
    """{요청한 제목: (실제 문서 제목, 본문)}"""
    res = api(lang, titles)
    q = res.get("query", {})
    alias = {t: t for t in titles}
    for key in ("normalized", "redirects"):
        for r in q.get(key, []):
            for k, v in alias.items():
                if v == r["from"]:
                    alias[k] = r["to"]
    pages = {p["title"]: p.get("extract", "") for p in q.get("pages", []) if not p.get("missing")}
    return {t: (alias[t], pages.get(alias[t], "")) for t in titles}


def main():
    topics = json.load(open(os.path.join(DATA, "topics.json"), encoding="utf8"))
    kowiki = json.load(open(os.path.join(DATA, "kowiki.json"), encoding="utf8"))
    os.makedirs(OUT, exist_ok=True)
    todo = [tid for tid in topics if not os.path.exists(os.path.join(OUT, f"{tid}.json"))]
    print(f"주제 {len(topics)}개 중 받을 것 {len(todo)}개")

    ko_todo = [t for t in todo if topics[t]["en"] in kowiki]
    en_todo = [t for t in todo if topics[t]["en"] not in kowiki]
    short = []  # 한국어 본문이 너무 짧아 영어로 다시 받을 주제

    def run(lang, ids):
        for i in range(0, len(ids), BATCH):
            chunk = ids[i:i + BATCH]
            want = {tid: (kowiki[topics[tid]["en"]] if lang == "ko" else topics[tid]["en"]) for tid in chunk}
            got = fetch(lang, list(set(want.values())))
            for tid, title in want.items():
                real, text = got.get(title, (title, ""))
                if lang == "ko" and len(text) < 200:
                    short.append(tid)
                    continue
                save(tid, lang, real, text, topics[tid])
            print(f"  {lang} {min(i + BATCH, len(ids))}/{len(ids)}")
            time.sleep(0.5 if FULL else 1)

    run("ko", ko_todo)
    run("en", en_todo + short)
    empty = [t for t in topics if os.path.exists(os.path.join(OUT, f"{t}.json")) and json.load(open(os.path.join(OUT, f"{t}.json"), encoding="utf8"))["text"] == ""]
    print(f"완료. 본문이 비어 있는 주제 {len(empty)}개: {empty[:20]}")


def clean(text):
    # 참고문헌·외부 링크 같은 뒷부분은 문제 출제에 쓸모가 없어서 자름
    for cut in ("\n같이 보기", "\n각주", "\n참고 문헌", "\n외부 링크", "\nSee also", "\nReferences", "\nNotes", "\nExternal links", "\nFurther reading"):
        i = text.find(cut)
        if i > 300:
            text = text[:i]
    return text.strip()


def save(tid, lang, title, text, topic):
    doc = {
        "topicId": tid, "ko": topic["ko"], "lang": lang, "title": title,
        "url": f"https://{lang}.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
        "license": "CC BY-SA 4.0 (Wikipedia)",
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "text": clean(text)[:6000],
    }
    with open(os.path.join(OUT, f"{tid}.json"), "w", encoding="utf8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
