"""앱에 내장하는 퀴즈 문제 은행(app/src/data/quizbank/) 관리 도구.

사용법:
  python scripts/quizbank.py plan      # 주제당 30문제가 안 된 주제를 묶은 작업 목록 출력 (JSON, 묶음당 약 300문제)
  python scripts/quizbank.py check     # 모든 문제 파일 검사 (형식·개수·중복)
  python scripts/quizbank.py index     # app/src/data/quizbank/index.ts 다시 만들기 (문제 은행 전체를 앱에 넣음)
  python scripts/quizbank.py index --remote  # 서버(quiz_bank 표)에서 받아 쓰는 방식: 앱에는 주제당 4문제만 넣음
  python scripts/quizbank.py upload    # 문제 은행을 Supabase quiz_bank 표에 올림 (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경 변수)
  python scripts/quizbank.py status    # 진행 현황

문제 파일 형식 (app/src/data/quizbank/<이름>.json):
  { "<주제 id>": [ {"type":"mc","q":"...","choices":["a","b","c","d"],"answer":0,"explain":"..."},
                   {"type":"ox","q":"...","answer":true,"explain":"..."}, ... ] }
"""
import glob
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, "app", "src", "data", "quizbank")
TOPICS = os.path.join(ROOT, "api", "supabase", "functions", "generate-quiz", "topics.json")
# 주제당 목표: 30문제 (4지선다 22 + OX 8). 한 주제의 문제는 여러 파일에 나뉘어 있어도 됨 (나중에 더 채울 때)
TARGET, TARGET_MC, TARGET_OX = 30, 22, 8
MIN_TOTAL, MIN_MC, MIN_OX = 12, 8, 3  # 이보다 적으면 오류 (작성 중인 주제 포함)
CHUNK_QUESTIONS = 300  # 작성 묶음 하나에 새로 쓸 문제 수
STARTER = os.path.join(ROOT, "app", "src", "data", "quizbank-starter.json")
STARTER_MC, STARTER_OX = 3, 1  # --remote 일 때 앱에 남기는 주제당 문제 (서버에 못 닿을 때 쓰는 기본 문제)


def load_topics():
    return json.load(open(TOPICS, encoding="utf8"))


def load_bank():
    bank = {}
    for f in sorted(glob.glob(os.path.join(BANK, "*.json"))):
        for tid, qs in json.load(open(f, encoding="utf8")).items():
            bank.setdefault(tid, []).extend(qs)
    return bank


# ───────── 말투 (docs/quiz-authoring.md "말투") — api/quiz-server/core.mjs 의 styleIssues 와 같은 규칙 ─────────
COND = r"(\s*\([^()]*\))?"
MC_END = re.compile(r"\?" + COND + "$")
OX_END = re.compile(r"다\." + COND + "$")
OX_FORMAL = re.compile(r"(?<!아)니다\." + COND + "$")  # "아니다."는 해라체라 허용
HAEYO = re.compile(r"(예요|에요|해요|어요|아요|이죠|죠|네요|군요)[.!?]?(\s|$)")
BANNED_Q = re.compile(r"(고르시오|고르세요|무엇일까|뭘까|인가요\?|일까요\?|\[AI\]|\[연습)")
NUMBERED = re.compile(r"^\s*(\d+[.)]\s|[①-⑳]|[A-Da-d][.)]\s)")


def style_issues(q):
    text, explain, bad = str(q.get("q", "")).strip(), str(q.get("explain", "")).strip(), []
    if q.get("type") == "mc" and not MC_END.search(text):
        bad.append("말투: 4지선다 문제는 '~은/는?'으로 끝나야 함")
    if q.get("type") == "ox" and (not OX_END.search(text) or OX_FORMAL.search(text)):
        bad.append("말투: OX 문제는 해라체 '~다.'로 끝나야 함")
    if BANNED_Q.search(text):
        bad.append("말투: 문제에 쓰지 않는 말투")
    if "니다" not in explain:
        bad.append("말투: 해설은 합니다체")
    if HAEYO.search(explain) or HAEYO.search(text):
        bad.append("말투: 해요체 금지")
    if re.search(r"(정답은?\s*\d+\s*번|\d+\s*번\s*보기|보기\s*\d+)", explain):
        bad.append("말투: 해설에 보기 번호")
    if q.get("type") == "mc" and any(NUMBERED.search(c) or re.search(r"[^.]\.$", c) for c in q.get("choices") or [] if isinstance(c, str)):
        bad.append("말투: 보기에 번호·마침표")
    return bad


def check_question(q):
    errs = []
    if not isinstance(q, dict):
        return ["not an object"]
    text, explain = str(q.get("q", "")).strip(), str(q.get("explain", "")).strip()
    if not text or len(text) > 400:
        errs.append("bad q")
    if not explain or len(explain) > 400:
        errs.append("bad explain")
    if q.get("type") == "mc":
        ch = q.get("choices")
        if not (isinstance(ch, list) and len(ch) == 4 and all(isinstance(c, str) and c.strip() and len(c) <= 200 for c in ch)):
            errs.append("choices must be 4 non-empty strings")
        elif len({c.strip() for c in ch}) != 4:
            errs.append("duplicate choices")
        if not (isinstance(q.get("answer"), int) and not isinstance(q.get("answer"), bool) and 0 <= q["answer"] < 4):
            errs.append("mc answer must be 0-3")
        bad = [c for c in (ch or []) if isinstance(c, str) and c.strip() in ("모두 맞다", "모두 정답", "정답 없음", "위 보기 모두")]
        if bad:
            errs.append("forbidden choice")
    elif q.get("type") == "ox":
        if not isinstance(q.get("answer"), bool):
            errs.append("ox answer must be true/false")
        if "choices" in q:
            errs.append("ox must not have choices")
    else:
        errs.append("type must be mc or ox")
    return errs + style_issues(q)


def check():
    topics, problems = load_topics(), []
    merged = {}  # 주제 id → 여러 파일의 문제를 합친 목록
    for f in sorted(glob.glob(os.path.join(BANK, "*.json"))):
        try:
            data = json.load(open(f, encoding="utf8"))
        except Exception as e:  # noqa: BLE001
            problems.append(f"{os.path.basename(f)}: JSON 오류 {e}")
            continue
        for tid, qs in data.items():
            where = f"{os.path.basename(f)}:{tid}"
            if tid not in topics:
                problems.append(f"{where}: 없는 주제 id")
                continue
            if not isinstance(qs, list):
                problems.append(f"{where}: 목록이 아님")
                continue
            for i, q in enumerate(qs):
                for e in check_question(q):
                    problems.append(f"{where}#{i}: {e}")
            merged.setdefault(tid, []).extend(qs)
    for tid, qs in merged.items():
        mc = sum(1 for q in qs if isinstance(q, dict) and q.get("type") == "mc")
        ox = sum(1 for q in qs if isinstance(q, dict) and q.get("type") == "ox")
        if len(qs) < MIN_TOTAL or mc < MIN_MC or ox < MIN_OX:
            problems.append(f"{tid}: 문제 수 부족 (전체 {len(qs)}, mc {mc}, ox {ox})")
        texts = [str(q.get("q", "")).strip() for q in qs if isinstance(q, dict)]
        if len(set(texts)) != len(texts):
            problems.append(f"{tid}: 같은 문제 중복")
    return len(merged), problems


def write_index(remote=False):
    head = [
        "// 자동 생성 파일: python scripts/quizbank.py index" + (" --remote" if remote else ""),
        "// 앱에 내장된 퀴즈 문제 은행. 문제 파일을 추가한 뒤 위 명령으로 다시 만드세요.",
        "",
        'import type { QuizQuestion } from "@/lib/quiz";',
    ]
    if remote:
        # 주제당 몇 문제만 남기고 나머지는 서버(quiz_bank 표)에서 받음
        starter = {}
        for tid, qs in sorted(load_bank().items()):
            mc = [q for q in qs if q.get("type") == "mc"][:STARTER_MC]
            ox = [q for q in qs if q.get("type") == "ox"][:STARTER_OX]
            starter[tid] = mc + ox
        json.dump(starter, open(STARTER, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
        lines = head + ['import starter from "../quizbank-starter.json";', "",
                        "/** 앱에 든 문제가 일부뿐이라 서버에서 나머지를 받아 씀 */",
                        "export const BANK_BUNDLED_FULL = false;",
                        "export const QUIZ_BANK = starter as Record<string, QuizQuestion[]>;", ""]
        open(os.path.join(BANK, "index.ts"), "w", encoding="utf8").write("\n".join(lines))
        return len(starter)
    if os.path.exists(STARTER):
        os.remove(STARTER)
    files = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(BANK, "*.json")))
    ident = lambda n: "b_" + n.replace("-", "_")
    lines = head + [f'import {ident(n)} from "./{n}.json";' for n in files]
    lines += ["", "const FILES = ["]
    lines += [f"  {ident(n)}," for n in files]
    lines += ["] as Record<string, QuizQuestion[]>[];", ""]
    lines += ["/** 문제 은행 전체가 앱에 들어 있음 (서버에서 받을 필요 없음) */", "export const BANK_BUNDLED_FULL = true;", ""]
    lines += ["// 한 주제의 문제가 여러 파일에 나뉘어 있으면 합칩니다", "export const QUIZ_BANK: Record<string, QuizQuestion[]> = {};"]
    lines += ["for (const f of FILES) for (const [id, qs] of Object.entries(f)) (QUIZ_BANK[id] ??= []).push(...qs);", ""]
    open(os.path.join(BANK, "index.ts"), "w", encoding="utf8").write("\n".join(lines))
    return len(files)


def upload(batch=50):
    """문제 은행을 quiz_bank 표에 올림 (같은 주제는 덮어씀). service role 키는 DB 담당자 PC의 환경 변수에만 둠"""
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경 변수를 먼저 정해 주세요.")
    rows = [{"topic_id": t, "questions": qs} for t, qs in sorted(load_bank().items())]
    for i in range(0, len(rows), batch):
        req = urllib.request.Request(
            url.rstrip("/") + "/rest/v1/quiz_bank", method="POST",
            data=json.dumps(rows[i:i + batch], ensure_ascii=False).encode("utf8"),
            headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json",
                     "Prefer": "resolution=merge-duplicates,return=minimal"})
        urllib.request.urlopen(req, timeout=60).read()
        print(f"올림 {min(i + batch, len(rows))}/{len(rows)}")
    return len(rows)


def need_of(qs):
    """주제당 30문제(mc 22 + ox 8)까지 더 써야 할 개수"""
    mc = sum(1 for q in qs if q.get("type") == "mc")
    ox = sum(1 for q in qs if q.get("type") == "ox")
    return max(0, TARGET_MC - mc), max(0, TARGET_OX - ox)


def plan():
    topics, bank = load_topics(), load_bank()
    # 아직 문제가 없는 주제 → 컴퓨터공학 → 나머지 순서 (같은 세부 분야끼리 묶음)
    order = sorted(topics, key=lambda t: (t in bank, 0 if topics[t]["domain"] == "컴퓨터공학" else 1, t))
    todo = [t for t in order if sum(need_of(bank.get(t, []))) > 0]
    used_names = {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(BANK, "*.json"))}
    chunks, i = [], 0
    while i < len(todo):
        cat = todo[i].rsplit("-", 1)[0]
        group, budget = [], 0
        while i < len(todo) and todo[i].rsplit("-", 1)[0] == cat and budget < CHUNK_QUESTIONS:
            group.append(todo[i])
            budget += sum(need_of(bank.get(todo[i], [])))
            i += 1
        n = 1
        while f"{cat}-{n}" in used_names:
            n += 1
        used_names.add(f"{cat}-{n}")
        items = []
        for t in group:
            mc, ox = need_of(bank.get(t, []))
            items.append({"id": t, **topics[t], "write_mc": mc, "write_ox": ox,
                          "existing": [q["q"] for q in bank.get(t, [])]})
        chunks.append({"category": cat, "file": f"app/src/data/quizbank/{cat}-{n}.json", "questions": budget, "topics": items})
    return chunks


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    sys.stdout.reconfigure(encoding="utf-8")
    if cmd == "plan":
        print(json.dumps(plan(), ensure_ascii=False))
    elif cmd == "check":
        ok, problems = check()
        print(f"검사한 주제 {ok}개, 문제 {len(problems)}건")
        for p in problems[:80]:
            print("  " + p)
        sys.exit(1 if problems else 0)
    elif cmd == "index":
        if "--remote" in sys.argv:
            print(f"index.ts: 서버에서 받는 방식, 앱에는 주제 {write_index(remote=True)}개 × {STARTER_MC + STARTER_OX}문제")
        else:
            print(f"index.ts: 파일 {write_index()}개")
    elif cmd == "upload":
        print(f"주제 {upload()}개를 quiz_bank 표에 올렸습니다.")
    else:
        t, b = load_topics(), load_bank()
        full = sum(1 for k in t if sum(need_of(b.get(k, []))) == 0)
        left = sum(sum(need_of(b.get(k, []))) for k in t)
        print(f"문제 은행: {len(b)}/{len(t)} 주제에 문제 있음, 30문제 다 찬 주제 {full}개, 문제 {sum(len(v) for v in b.values())}개, "
              f"남은 문제 {left}개, 남은 묶음 {len(plan())}개")
