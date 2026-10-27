"""app/src/data/links.ts 의 공식 문서 주소가 실제로 열리는지 확인합니다.
사용법: python scripts/check_links.py
"""
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "app", "src", "data", "links.ts"), encoding="utf8").read()
rows = re.findall(r'^\s*"([^"]+)": \{ label: "([^"]+)", url: "([^"]+)" \}', src, re.M)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

bad = []
for title, label, url in rows:
    code = subprocess.run(
        ["curl", "-s", "-o", os.devnull, "-L", "--max-time", "25", "-A", UA, "-w", "%{http_code}", url],
        capture_output=True, text=True,
    ).stdout.strip()
    if code != "200":
        bad.append((code, title, url))
print(f"checked {len(rows)} links, problems {len(bad)}")
for b in bad:
    print("  ", *b)
