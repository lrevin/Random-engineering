"""앱에 내장하는 퀴즈 문제 은행(app/src/data/quizbank/) 관리 도구.

사용법:
  python scripts/quizbank.py plan      # 아직 문제가 없는 주제를 20개씩 묶은 작업 목록 출력 (JSON)
  python scripts/quizbank.py check     # 모든 문제 파일 검사 (형식·개수·중복)
  python scripts/quizbank.py index     # app/src/data/quizbank/index.ts 다시 만들기
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, "app", "src", "data", "quizbank")
TOPICS = os.path.join(ROOT, "api", "supabase", "functions", "generate-quiz", "topics.json")
CHUNK = 20
MIN_TOTAL, MIN_MC, MIN_OX = 12, 8, 3


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
OX_FORMAL = re.compile(r"니다\." + COND + "$")
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
    topics, problems, ok = load_topics(), [], 0
    seen_files = {}
    for f in sorted(glob.glob(os.path.join(BANK, "*.json"))):
        try:
            data = json.load(open(f, encoding="utf8"))
        except Exception as e:  # noqa: BLE001
            problems.append(f"{os.path.basename(f)}: JSON 오류 {e}")
            continue
        for tid, qs in data.items():
            where = f"{os.path.basename(f)}:{tid}"
            if tid in seen_files:
                problems.append(f"{where}: {seen_files[tid]} 에도 있음")
            seen_files[tid] = os.path.basename(f)
            if tid not in topics:
                problems.append(f"{where}: 없는 주제 id")
                continue
            if not isinstance(qs, list):
                problems.append(f"{where}: 목록이 아님")
                continue
            mc = sum(1 for q in qs if isinstance(q, dict) and q.get("type") == "mc")
            ox = sum(1 for q in qs if isinstance(q, dict) and q.get("type") == "ox")
            if len(qs) < MIN_TOTAL or mc < MIN_MC or ox < MIN_OX:
                problems.append(f"{where}: 문제 수 부족 (전체 {len(qs)}, mc {mc}, ox {ox})")
            texts = [str(q.get("q", "")).strip() for q in qs if isinstance(q, dict)]
            if len(set(texts)) != len(texts):
                problems.append(f"{where}: 같은 문제 중복")
            for i, q in enumerate(qs):
                for e in check_question(q):
                    problems.append(f"{where}#{i}: {e}")
            ok += 1
    return ok, problems


def write_index():
    files = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(BANK, "*.json")))
    ident = lambda n: "b_" + n.replace("-", "_")
    lines = [
        "// 자동 생성 파일: python scripts/quizbank.py index",
        "// 앱에 내장된 퀴즈 문제 은행. 문제 파일을 추가한 뒤 위 명령으로 다시 만드세요.",
        "",
        'import type { QuizQuestion } from "@/lib/quiz";',
    ]
    lines += [f'import {ident(n)} from "./{n}.json";' for n in files]
    lines += ["", "export const QUIZ_BANK: Record<string, QuizQuestion[]> = Object.assign(", "  {},"]
    lines += [f"  {ident(n)} as Record<string, QuizQuestion[]>," for n in files]
    lines += [");", ""]
    open(os.path.join(BANK, "index.ts"), "w", encoding="utf8").write("\n".join(lines))
    return len(files)


def plan():
    topics, bank = load_topics(), load_bank()
    # 정보보안 → 나머지 컴퓨터공학 → 다른 공학 분야 순서
    order = sorted(topics, key=lambda t: (0 if t.startswith("sec-") else 1 if topics[t]["domain"] == "컴퓨터공학" else 2))
    todo = [t for t in order if t not in bank]
    chunks, i = [], 0
    while i < len(todo):
        cat = todo[i].rsplit("-", 1)[0]
        group = []
        while i < len(todo) and todo[i].rsplit("-", 1)[0] == cat and len(group) < CHUNK:
            group.append(todo[i])
            i += 1
        n = len(glob.glob(os.path.join(BANK, f"{cat}-*.json"))) + sum(1 for c in chunks if c["category"] == cat) + 1
        chunks.append({"category": cat, "file": f"app/src/data/quizbank/{cat}-{n}.json",
                       "topics": [{"id": t, **topics[t]} for t in group]})
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
        print(f"index.ts: 파일 {write_index()}개")
    else:
        t, b = load_topics(), load_bank()
        print(f"문제 은행: {len(b)}/{len(t)} 주제, 문제 {sum(len(v) for v in b.values())}개, 남은 묶음 {len(plan())}개")
