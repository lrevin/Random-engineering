r"""out/pools 의 주제별 문제를 모아 DB에 넣기 좋은 파일 하나로 만듭니다 (인터넷 필요 없음).

사용법 (C:\ppobgong-llm 에서):  python export.py
결과:
  out/ai_quizzes.json   주제id → 문제 목록 (앱 문제 은행과 같은 형식: type, q, choices, answer, explain)
  out/ai_quizzes.sql    MySQL ai_quizzes 표에 바로 넣는 SQL (api/mysql/schema.sql 기준)
  out/summary.txt       주제별 문제 수, 문제가 0개인 주제 목록
이 세 파일을 USB로 옮겨 김창원에게 전달합니다.
"""
import glob
import json
import os

import generate as g  # 말투 검사 규칙 재사용

HERE = os.path.dirname(os.path.abspath(__file__))
POOLS = os.path.join(HERE, "out", "pools")
CHECKED = os.path.join(HERE, "out", "checked")  # recheck.py 로 교차 검수한 결과 (있으면 이쪽을 씀)
OUTDIR = os.path.join(HERE, "out")
KEYS = ("type", "q", "choices", "answer", "explain")


def main():
    topics = json.load(open(os.path.join(HERE, "data", "topics.json"), encoding="utf8"))
    data, models = {}, set()
    for f in sorted(glob.glob(os.path.join(POOLS, "*.json"))):
        tid = os.path.basename(f)[:-5]
        c = os.path.join(CHECKED, f"{tid}.json")
        qs = json.load(open(c if os.path.exists(c) else f, encoding="utf8"))
        qs = [q for q in qs if not g.style_issues(q)]  # 규칙을 고치기 전에 만든 문제도 한 번 더 검사
        data[tid] = [{k: q[k] for k in KEYS if k in q} for q in qs]
        models.update(q.get("model", "") for q in qs)
    with open(os.path.join(OUTDIR, "ai_quizzes.json"), "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    model = ", ".join(sorted(m for m in models if m))[:40] or "unknown"
    with open(os.path.join(OUTDIR, "ai_quizzes.sql"), "w", encoding="utf8") as f:
        f.write("-- 뽑공 AI 문제 (오픈 모델 생성 + 2번 검수). 실행: mysql ... ppobgong < ai_quizzes.sql\n")
        f.write("SET NAMES utf8mb4;\n")
        for tid, qs in data.items():
            if not qs:
                continue
            js = json.dumps(qs, ensure_ascii=False).replace("\\", "\\\\").replace("'", "''")
            f.write(f"INSERT INTO ai_quizzes (topic_id, questions, model) VALUES ('{tid}', '{js}', '{model}') "
                    f"ON DUPLICATE KEY UPDATE questions = VALUES(questions), model = VALUES(model);\n")

    total = sum(len(v) for v in data.values())
    empty = [t for t in topics if not data.get(t)]
    with open(os.path.join(OUTDIR, "summary.txt"), "w", encoding="utf8") as f:
        f.write(f"주제 {len(topics)}개 중 처리 {len(data)}개, 문제 {total}개 (모델 {model})\n")
        f.write(f"문제가 0개인 주제 {len(empty)}개 (기존 문제 은행으로 대체):\n")
        f.write("\n".join(f"{t} {topics[t]['ko']}" for t in empty) + "\n")
    print(f"처리한 주제 {len(data)}개, 문제 {total}개, 문제 없는 주제 {len(empty)}개")
    print("만든 파일: out\\ai_quizzes.json, out\\ai_quizzes.sql, out\\summary.txt")


if __name__ == "__main__":
    main()
