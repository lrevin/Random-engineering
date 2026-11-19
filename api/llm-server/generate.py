r"""위키백과 본문을 참고해 주제별 퀴즈를 만들고, 2번 검수해서 통과한 문제만 out/pools/<주제id>.json 에 저장합니다.

사용법 (C:\ppobgong-llm 에서, Ollama 가 켜져 있어야 함):
  python generate.py --topics os-07,ds-01      특정 주제만
  python generate.py --limit 5                 아직 안 만든 주제 중 앞에서 5개
  python generate.py                           아직 안 만든 주제 전부 (오래 걸림)
옵션: --model qwen3:14b  --count 8 (주제당 출제 수)  --redo (이미 만든 주제도 다시)

- 출제: 생각 기능 끔 (빠르게).  검수 1·2차: 생각 기능 켬 (꼼꼼하게).
- 검수 기준은 prompts/review1.md, review2.md (팀 퀴즈 AI 서버와 같은 지침).
- 진행 기록은 out/log.txt 에 남습니다. 중간에 멈춰도 다시 실행하면 이어서 합니다.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "out", "pools")
LOG = os.path.join(HERE, "out", "log.txt")
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")


def read(path):
    with open(path, encoding="utf8") as f:
        return f.read()


GEM = read(os.path.join(HERE, "prompts", "gem.md"))
REVIEW1 = read(os.path.join(HERE, "prompts", "review1.md"))
REVIEW2 = read(os.path.join(HERE, "prompts", "review2.md"))

# ───────── 출력 형식 (팀 퀴즈 AI 서버 core.mjs 와 같음) ─────────
SCHEMA = {
    "type": "object",
    "properties": {"questions": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": ["mc", "ox"]},
            "q": {"type": "string"},
            "choices": {"type": "array", "items": {"type": "string"}},
            "answer_index": {"type": "integer"},
            "answer_bool": {"type": "boolean"},
            "explain": {"type": "string"},
            "evidence": {"type": "string"},
        },
        "required": ["type", "q", "choices", "answer_index", "answer_bool", "explain", "evidence"],
    }}},
    "required": ["questions"],
}
REVIEW1_SCHEMA = {
    "type": "object",
    "properties": {"results": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "index": {"type": "integer"}, "answer_index": {"type": "integer"},
            "answer_bool": {"type": "boolean"}, "ambiguous": {"type": "boolean"},
            "on_topic": {"type": "boolean"}, "sound": {"type": "boolean"}, "note": {"type": "string"},
        },
        "required": ["index", "answer_index", "answer_bool", "ambiguous", "on_topic", "sound", "note"],
    }}},
    "required": ["results"],
}
REVIEW2_SCHEMA = {
    "type": "object",
    "properties": {"results": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "index": {"type": "integer"},
            "verdict": {"type": "string", "enum": ["keep", "drop"]},
            "reason": {"type": "string"},
        },
        "required": ["index", "verdict", "reason"],
    }}},
    "required": ["results"],
}


NO_THINK = set()


def post(body):
    req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=900))


def ask(model, system, user, schema, think):
    body = {
        "model": model, "stream": False, "think": think, "format": schema,
        "options": {"temperature": 0.7 if not think else 0.2, "num_ctx": 16384},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    if model in NO_THINK:
        body.pop("think")
    try:
        res = post(body)
    except urllib.error.HTTPError as e:
        if "think" not in body or e.code != 400:
            raise
        NO_THINK.add(model)  # 생각 기능이 없는 모델 (예: gemma3) 은 끄고 다시 요청
        body.pop("think")
        res = post(body)
    text = res["message"]["content"]
    return json.loads(text), res.get("eval_count", 0)


# ───────── 형식·말투 검사 (core.mjs 의 toQuestions / styleFix / styleIssues 와 같은 규칙) ─────────
COND = r"(\s*\([^()]*\))?"
MC_END = re.compile(r"\?" + COND + "$")
OX_END = re.compile(r"다\." + COND + "$")
OX_FORMAL = re.compile(r"(?<!아)니다\." + COND + "$")
HAEYO = re.compile(r"(예요|에요|해요|어요|아요|이죠|죠|네요|군요)[.!?]?(\s|$)")
BANNED_Q = re.compile(r"(고르시오|고르세요|무엇일까|뭘까|[가-힣]요\?|일까\?|\[AI\]|\[연습)")
META = re.compile(r"(참고 ?자료|위키백과|위키피디아|명시되어|라고 나와|언급되어|본문에)")  # 학생은 참고 자료를 못 보므로 해설에 쓰지 않음
NUMBERED = re.compile(r"^\s*(\d+[.)]\s|[①-⑳]|[A-Da-d][.)]\s)")
FOREIGN = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")  # 일본어·한자가 섞이면 버림


def to_questions(raw):
    out = []
    for r in raw or []:
        q, explain = str(r.get("q", "")).strip(), str(r.get("explain", "")).strip()
        if not q or not explain or len(q) > 400 or len(explain) > 400:
            continue
        ev = str(r.get("evidence", "")).strip()
        if r.get("type") == "ox":
            out.append({"type": "ox", "q": q, "answer": bool(r.get("answer_bool")), "explain": explain, "evidence": ev})
        elif r.get("type") == "mc":
            ch = [NUMBERED.sub("", str(c).strip()).rstrip(".").strip() for c in r.get("choices", [])]
            a = r.get("answer_index")
            if len(ch) == 4 and all(c and len(c) <= 200 for c in ch) and len(set(ch)) == 4 and isinstance(a, int) and 0 <= a < 4:
                out.append({"type": "mc", "q": q, "choices": ch, "answer": a, "explain": explain, "evidence": ev})
    return out


def style_issues(q):
    bad = []
    if q["type"] == "mc" and not MC_END.search(q["q"]):
        bad.append("mc 끝맺음")
    if q["type"] == "ox" and (not OX_END.search(q["q"]) or OX_FORMAL.search(q["q"])):
        bad.append("ox 끝맺음")
    if BANNED_Q.search(q["q"]):
        bad.append("금지 말투")
    if "니다" not in q["explain"]:
        bad.append("해설 합니다체 아님")
    if HAEYO.search(q["explain"]) or HAEYO.search(q["q"]):
        bad.append("해요체")
    if re.search(r"(정답은?\s*\d+\s*번|\d+\s*번\s*보기|보기\s*\d+)", q["explain"]):
        bad.append("해설에 보기 번호")
    text = q["q"] + q["explain"] + "".join(q.get("choices", []))
    if META.search(q["q"] + q["explain"]):
        bad.append("참고 자료 언급")
    if FOREIGN.search(text):
        bad.append("한자·일본어 섞임")
    return bad


def grounded(q, text):
    """근거 문장이 참고 자료에 실제로 있는지 (띄어쓰기·문장부호 무시, 20자 이상)"""
    ev = norm(q.get("evidence", ""))
    return len(ev) >= 20 and ev in norm(text)


def contained(part, whole):
    """part 의 글자 2개 묶음 중 whole 에 들어 있는 비율"""
    P = {norm(part)[i:i + 2] for i in range(len(norm(part)) - 1)}
    W = {norm(whole)[i:i + 2] for i in range(len(norm(whole)) - 1)}
    return len(P & W) / len(P) if P else 0.0


def answer_based(q, text=""):
    """정답 내용이 근거 문장에 실제로 들어 있는지 (한국어 자료일 때만 검사)
    근거 문장은 맞게 가져왔는데 정답은 엉뚱하게 지어낸 문제를 거릅니다."""
    ev = q.get("evidence", "")
    if not re.search(r"[가-힣]", ev):
        return True  # 영어 자료는 정답(한국어)과 글자로 비교할 수 없어서 건너뜀
    if q["type"] == "mc":
        ans = q["choices"][q["answer"]]
        # 근거 문장에 있거나, 근거 문장엔 없어도 본문 전체에 거의 그대로 있으면 통과
        return contained(ans, ev) >= 0.5 or contained(ans, text) >= 0.7
    return contained(q["q"], ev) >= 0.3


def norm(s):
    return re.sub(r"[^0-9a-z가-힣]", "", str(s).lower())


def similarity(a, b):
    A = {norm(a)[i:i + 2] for i in range(len(norm(a)) - 1)}
    B = {norm(b)[i:i + 2] for i in range(len(norm(b)) - 1)}
    if not A or not B:
        return 1.0 if norm(a) == norm(b) else 0.0
    return len(A & B) / len(A | B)


def distinct(qs, against):
    kept = []
    for q in qs:
        if not any(similarity(q["q"], o) >= 0.5 for o in against + [k["q"] for k in kept]):
            kept.append(q)
    return kept


# ───────── 프롬프트 ─────────
def topic_line(t):
    return f"개념: {t['ko']} (영어: {t['en']})\n분야: {t['domain']} > {t['category']}\n난이도: Lv.{t['lv']} {t['level']}\n참고 힌트: {t['hint']}"


def ref_block(wiki):
    return f"참고 자료 (위키백과, {wiki['title']}):\n{wiki['text'][:6000]}"


def draft_prompt(t, wiki, existing, count):
    lst = "\n".join(f"{i + 1}. {q}" for i, q in enumerate(existing)) or "(아직 없음)"
    return (f"{topic_line(t)}\n\n{ref_block(wiki)}\n\n이미 있는 문제 (이것과 비슷한 문제는 만들지 마세요):\n{lst}\n\n"
            f"위 문제들과 겹치지 않는 새로운 유형의 퀴즈 {count}문제를 만들어 주세요. 개념 이름은 \"{t['ko']}\"로 씁니다.\n"
            f"모든 문제는 참고 자료만 읽고 풀 수 있어야 합니다. evidence에는 정답의 근거가 되는 문장을 참고 자료에서 **한 글자도 바꾸지 말고 그대로** 복사해 넣으세요 "
            f"(참고 자료가 영어면 영어 문장 그대로). 근거 문장을 찾을 수 없는 내용은 문제로 만들지 마세요.\n"
            f"학생은 참고 자료를 보지 못합니다. 해설에 \"참고 자료\", \"명시되어 있다\" 같은 말이나 인용문을 넣지 말고, 개념 설명으로만 쓰세요.\n"
            f"같은 문장을 근거로 여러 문제를 만들지 말고, 서로 다른 내용을 물어보세요.\n"
            f"OX 문제는 절반 정도를 정답이 X인 틀린 진술(흔한 오개념)로 만드세요. 4지선다로 이미 물은 내용을 OX로 다시 묻지 마세요.\n"
            f"\"리스트\"처럼 여러 뜻으로 읽힐 수 있는 보기, 특정 의사코드의 변수 이름(firstNode 등)을 묻는 문제는 만들지 마세요.\n"
            f"말투는 지침의 \"말투\" 규칙을 그대로 따르세요 (4지선다 \"~은/는?\", OX \"~다.\", 해설 \"~입니다/~합니다\").")


def review1_prompt(t, wiki, qs):
    lst = "\n\n".join(
        f"[{i}] (4지선다) {q['q']}\n" + "\n".join(f"  {j}) {c}" for j, c in enumerate(q["choices"]))
        if q["type"] == "mc" else f"[{i}] (OX) {q['q']}" for i, q in enumerate(qs))
    return (f"{topic_line(t)}\n\n{ref_block(wiki)}\n\n아래 문제를 정답표 없이 직접 풀고 판단해 주세요. "
            f"OX 문제는 answer_index를 0으로, 4지선다는 answer_bool을 false로 두세요.\n\n{lst}")


def review2_prompt(t, wiki, qs):
    def one(i, q):
        if q["type"] == "mc":
            ch = "\n".join(f"  {j}) {c}" for j, c in enumerate(q["choices"]))
            return f"[{i}] (4지선다) {q['q']}\n{ch}\n  정답: {q['answer']}) {q['choices'][q['answer']]}\n  해설: {q['explain']}"
        return f"[{i}] (OX) {q['q']}\n  정답: {'O' if q['answer'] else 'X'}\n  해설: {q['explain']}"
    lst = "\n\n".join(one(i, q) for i, q in enumerate(qs))
    return f"{topic_line(t)}\n\n{ref_block(wiki)}\n\n아래 문제를 정답표·해설까지 보고 판정해 주세요.\n\n{lst}"


def pass1(q, r):
    if not r or r.get("ambiguous") or not r.get("on_topic") or not r.get("sound"):
        return False
    return r.get("answer_index") == q["answer"] if q["type"] == "mc" else r.get("answer_bool") == q["answer"]


# ───────── 한 주제 처리 ─────────
def make_topic(model, rmodel, tid, t, wiki, bank, count, log, extra=()):
    start = time.time()
    existing = [q if isinstance(q, str) else q["q"] for q in bank.get(tid, [])]
    existing += [q if isinstance(q, str) else q["q"] for q in extra]  # 전에 AI가 만든 문제도 겹치지 않게
    n = len(wiki["text"])
    count = min(count, 4 if n < 1000 else 6 if n < 2500 else count)  # 자료가 짧으면 적게 (같은 내용 반복 방지)
    raw, tok1 = ask(model, GEM, draft_prompt(t, wiki, existing, count), SCHEMA, think=False)
    qs = to_questions(raw.get("questions"))
    drafted = len(qs)
    styled = [q for q in qs if not style_issues(q)]
    based = [q for q in styled if grounded(q, wiki["text"]) and answer_based(q, wiki["text"])]
    why = {}
    for q in qs:
        for b in style_issues(q):
            why[b] = why.get(b, 0) + 1
    qs = distinct(based, existing)
    if not qs:
        log(f"{tid} {t['ko']}: 만듦 {drafted} → 말투 {len(styled)} → 근거 {len(based)} → 중복 0 ({time.time() - start:.0f}초) 말투 탈락 이유 {why}")
        return []

    r1, tok2 = ask(rmodel, REVIEW1, review1_prompt(t, wiki, qs), REVIEW1_SCHEMA, think=True)
    by1 = {r.get("index"): r for r in r1.get("results", [])}
    after1 = [q for i, q in enumerate(qs) if pass1(q, by1.get(i))]
    after2, tok3 = [], 0
    if after1:
        r2, tok3 = ask(rmodel, REVIEW2, review2_prompt(t, wiki, after1), REVIEW2_SCHEMA, think=True)
        by2 = {r.get("index"): r for r in r2.get("results", [])}
        after2 = [q for i, q in enumerate(after1) if (by2.get(i) or {}).get("verdict") == "keep"]

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    kept = [{**q, "model": model, "reviewer": rmodel, "source": wiki["url"], "createdAt": now} for q in after2]
    log(f"{tid} {t['ko']}: 만듦 {drafted} → 말투 {len(styled)} → 근거 {len(based)} → 중복 {len(qs)} → 1차 {len(after1)} → 2차 {len(after2)} "
        f"({time.time() - start:.0f}초, 출력 {tok1 + tok2 + tok3}토큰)")
    return kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="qwen3:14b")
    ap.add_argument("--reviewer", default="", help="검수 모델 (비우면 출제 모델과 같음)")
    ap.add_argument("--count", type=int, default=8)
    ap.add_argument("--wiki", default="wiki_full", help="참고 자료 폴더 (data/ 아래)")
    ap.add_argument("--topics", default="")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--redo", action="store_true")
    a = ap.parse_args()

    topics = json.load(open(os.path.join(DATA, "topics.json"), encoding="utf8"))
    bank = json.load(open(os.path.join(DATA, "bank.json"), encoding="utf8"))
    os.makedirs(OUT, exist_ok=True)

    ids = [x.strip() for x in a.topics.split(",") if x.strip()]
    if not ids:
        # 주제가 많은 분야부터 (컴퓨터공학 → 전기·전자 → 기계 …), 분야 안에서는 원래 순서
        size = {}
        for v in topics.values():
            size[v["domain"]] = size.get(v["domain"], 0) + 1
        ids = sorted(topics, key=lambda k: -size[topics[k]["domain"]])
    unknown = [x for x in ids if x not in topics]
    if unknown:
        sys.exit(f"없는 주제 id: {unknown}")
    if not a.redo:
        ids = [x for x in ids if not os.path.exists(os.path.join(OUT, f"{x}.json"))]
    if a.limit:
        ids = ids[:a.limit]

    def log(msg):
        line = time.strftime("%m-%d %H:%M:%S ") + msg
        print(line, flush=True)
        with open(LOG, "a", encoding="utf8") as f:
            f.write(line + "\n")

    log(f"시작: 출제 {a.model} / 검수 {a.reviewer or a.model}, 주제 {len(ids)}개, 주제당 {a.count}문제 출제")
    total, t0 = 0, time.time()
    for n, tid in enumerate(ids, 1):
        wp = os.path.join(DATA, a.wiki, f"{tid}.json")
        if not os.path.exists(wp):
            wp = os.path.join(DATA, "wiki", f"{tid}.json")  # 긴 본문이 없으면 요약본 사용
        wiki = json.load(open(wp, encoding="utf8"))
        try:
            kept = make_topic(a.model, a.reviewer or a.model, tid, topics[tid], wiki, bank, a.count, log)
        except Exception as e:  # 한 주제가 실패해도 다음 주제로 넘어감
            log(f"{tid}: 실패 ({e})")
            continue
        with open(os.path.join(OUT, f"{tid}.json"), "w", encoding="utf8") as f:
            json.dump(kept, f, ensure_ascii=False, indent=1)
        total += len(kept)
        avg = (time.time() - t0) / n
        log(f"  진행 {n}/{len(ids)} · 통과 문제 누적 {total}개 · 남은 시간 약 {avg * (len(ids) - n) / 60:.0f}분")
    log("끝")


if __name__ == "__main__":
    main()
