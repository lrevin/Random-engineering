"""계획서용 그림 만들기 (Pillow): 시스템 구성도, DB 구조도, 추진 일정표.
사용법: python scripts/make_figures.py   → docs/images/*.png
"""
import datetime as dt
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "images")
FONT = r"C:\Windows\Fonts\NotoSansKR-VF.ttf"

INK = (17, 22, 38)
NAVY = (29, 39, 66)
RED = (224, 69, 58)
CREAM = (255, 248, 233)
CHIP = (255, 240, 200)
GRAY = (120, 126, 140)
LINE = (210, 205, 195)
WHITE = (255, 255, 255)
GOLD = (247, 181, 0)
GREEN = (47, 125, 79)


def F(size, w=500):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([w])
    except Exception:  # noqa: BLE001
        pass
    return f


def box(d, x, y, w, h, title, lines, head=INK, accent=None, title_size=34, line_size=26):
    d.rounded_rectangle([x, y, x + w, y + h], radius=22, fill=WHITE, outline=INK, width=4)
    d.rounded_rectangle([x, y, x + w, y + 74], radius=22, fill=head)
    d.rectangle([x, y + 50, x + w, y + 74], fill=head)
    d.text((x + 28, y + 37), title, font=F(title_size, 800), fill=WHITE, anchor="lm")
    if accent:
        d.rectangle([x + 18, y + 96, x + 26, y + h - 22], fill=accent)
    ty = y + 104
    for ln in lines:
        bold = ln.startswith("**")
        t = ln.replace("**", "")
        d.text((x + 44, ty), t, font=F(line_size, 700 if bold else 450), fill=INK if bold else (60, 66, 84))
        ty += line_size + 18


def chip(d, cx, cy, text, fill=CHIP, size=24):
    f = F(size, 700)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    w, h = r - l + 30, b - t + 18
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=10, fill=fill)
    d.text((cx, cy), text, font=f, fill=INK, anchor="mm")


def arrow(d, pts, both=False, width=5, color=INK, dash=False):
    if dash:
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            n = int(max(abs(x2 - x1), abs(y2 - y1)) / 18)
            for i in range(0, n, 2):
                a, b = i / n, min(1, (i + 1) / n)
                d.line([x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b], fill=color, width=width)
    else:
        d.line(pts, fill=color, width=width, joint="curve")

    def head(p_from, p_to):
        (x1, y1), (x2, y2) = p_from, p_to
        import math
        a = math.atan2(y2 - y1, x2 - x1)
        L, Wd = 26, 14
        d.polygon([(x2, y2), (x2 - L * math.cos(a) + Wd * math.sin(a), y2 - L * math.sin(a) - Wd * math.cos(a)),
                   (x2 - L * math.cos(a) - Wd * math.sin(a), y2 - L * math.sin(a) + Wd * math.cos(a))], fill=color)
    head(pts[-2], pts[-1])
    if both:
        head(pts[1], pts[0])


def dashed_rect(d, x1, y1, x2, y2, color=GRAY, width=3, seg=16):
    for x in range(int(x1), int(x2), seg * 2):
        d.line([x, y1, min(x + seg, x2), y1], fill=color, width=width)
        d.line([x, y2, min(x + seg, x2), y2], fill=color, width=width)
    for y in range(int(y1), int(y2), seg * 2):
        d.line([x1, y, x1, min(y + seg, y2)], fill=color, width=width)
        d.line([x2, y, x2, min(y + seg, y2)], fill=color, width=width)


LOGOS = os.path.join(OUT, "logos")


def logo(im, name, x, y, h):
    """로고를 높이 h로 붙이고 너비를 돌려줌"""
    lg = Image.open(os.path.join(LOGOS, name + ".png")).convert("RGBA")
    lg = lg.crop(lg.getbbox())
    w = round(lg.width * h / lg.height)
    lg = lg.resize((w, h), Image.LANCZOS)
    im.paste(lg, (int(x), int(y)), lg)
    return w


def tech(im, d, x, y, name, label, sub=None, h=60, size=28):
    """로고 + 이름(+ 작은 설명) 한 덩어리. 차지한 너비를 돌려줌"""
    w = logo(im, name, x, y, h)
    tx = x + w + 14
    if sub:
        d.text((tx, y + h / 2 - 4), label, font=F(size, 800), fill=INK, anchor="ls")
        d.text((tx, y + h / 2 + 6), sub, font=F(size - 6, 450), fill=GRAY, anchor="lt")
        tw = max(d.textlength(label, font=F(size, 800)), d.textlength(sub, font=F(size - 6, 450)))
    else:
        d.text((tx, y + h / 2), label, font=F(size, 800), fill=INK, anchor="lm")
        tw = d.textlength(label, font=F(size, 800))
    return w + 14 + tw


def hero(im, d, x, w, y, name, label, h=96, size=36):
    """박스 가운데에 큰 로고 + 이름"""
    lg = Image.open(os.path.join(LOGOS, name + ".png"))
    lw = round(lg.crop(lg.getbbox()).width * h / lg.crop(lg.getbbox()).height)
    tw = d.textlength(label, font=F(size, 800))
    sx = x + (w - (lw + 20 + tw)) / 2
    logo(im, name, sx, y, h)
    d.text((sx + lw + 20, y + h / 2), label, font=F(size, 800), fill=INK, anchor="lm")


def lines_at(d, x, y, lines, size=26, center=None):
    for ln in lines:
        bold = ln.startswith("**")
        t = ln.replace("**", "")
        f = F(size, 700 if bold else 450)
        col = INK if bold else (60, 66, 84)
        if center is not None:
            d.text((center, y), t, font=f, fill=col, anchor="mt")
        else:
            d.text((x, y), t, font=f, fill=col)
        y += size + 18


def architecture():
    W, H = 2400, 1560
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)

    d.text((60, 50), "사용자 화면", font=F(30, 700), fill=GRAY)
    box(d, 60, 100, 560, 420, "모바일 앱 (iOS · Android)", [])
    tech(im, d, 104, 200, "react", "React Native", "0.86")
    tech(im, d, 390, 200, "expo", "Expo", "SDK 57")
    tech(im, d, 104, 290, "typescript", "TypeScript", "Expo Router")
    lines_at(d, 104, 390, ["주제 뽑기(슬롯머신) · 15분 공부", "퀴즈 7문제 (AI 4 + 기본 3) · 레벨"])

    box(d, 60, 600, 560, 440, "휴대폰 안 (오프라인에서도 동작)", [], head=NAVY)
    tech(im, d, 104, 700, "android", "Android")
    tech(im, d, 370, 700, "apple", "iOS")
    lines_at(d, 104, 800, ["**내장 퀴즈 문제 은행**", "주제 1,054개 (공학 11 · 과학 5)", "기록 저장 (AsyncStorage)", "매일 알림 (expo-notifications)"])
    arrow(d, [(340, 520), (340, 600)], both=True)

    dashed_rect(d, 760, 60, 1660, 1120)
    lab = F(32, 700)
    lw = d.textlength(" Supabase Cloud ", font=lab)
    d.rectangle([786, 34, 790 + 48 + lw + 4, 86], fill=WHITE)
    logo(im, "supabase", 792, 40, 40)
    d.text((838, 60), " Supabase Cloud ", font=lab, fill=GRAY, anchor="lm")

    box(d, 800, 110, 820, 300, "인증 · 보안", [], accent=GOLD)
    x = 844
    x += tech(im, d, x, 200, "supabase", "Supabase Auth", "이메일 로그인", h=56) + 50
    x += tech(im, d, x, 200, "jsonwebtokens", "JWT", "토큰 자동 갱신", h=56) + 50
    lines_at(d, x, 205, ["**RLS**", "본인 데이터만"], size=24)
    x = 844
    x += logo(im, "kakaotalk", x, 300, 40) + 10
    x += logo(im, "apple", x, 300, 40) + 14
    d.text((x, 320), "카카오 · Apple 로그인 (예정)", font=F(24, 450), fill=(60, 66, 84), anchor="lm")

    box(d, 800, 450, 820, 240, "REST API (PostgREST)", [], accent=NAVY)
    tech(im, d, 844, 545, "postgresql", "PostgREST", "DB 표를 바로 REST API로", h=56)
    lines_at(d, 1260, 548, ["profiles · study_records", "조회·저장 · 회원 탈퇴"], size=24)

    box(d, 800, 730, 820, 340, "서버 함수 (Edge Function)", [], accent=RED)
    tech(im, d, 844, 825, "denojs", "Deno", "TypeScript", h=60)
    tech(im, d, 1110, 825, "claude", "generate-quiz", "퀴즈 AI 서버가 꺼졌을 때", h=60)
    lines_at(d, 844, 925, ["출제 → 2번 검수 → 통과한 문제만 저장", "주제당 최대 40문제 → AI 비용 상한"])
    for y in (410, 690):
        arrow(d, [(1210, y), (1210, y + 40)])

    # 퀴즈 AI 서버 (개인 PC 등에서 계속 켜 두는 출제 AI)
    box(d, 760, 1200, 900, 300, "퀴즈 AI 서버 (PC 등에서 상시 구동)", [], head=RED)
    tech(im, d, 804, 1295, "nodejs", "Node.js", "api/quiz-server", h=60)
    tech(im, d, 1150, 1295, "claude", "출제 지침", "gem.md (Gems처럼)", h=60)
    lines_at(d, 804, 1395, ["공부 시작 즉시 출제 → 1차·2차 검수", "주제별 문제 창고 · 쉬는 동안 계속 출제"])

    box(d, 1800, 110, 540, 300, "데이터베이스", [])
    hero(im, d, 1800, 540, 205, "postgresql", "PostgreSQL")
    lines_at(d, 0, 330, ["profiles · study_records · quizzes"], size=24, center=2070)

    box(d, 1800, 470, 540, 300, "AI 퀴즈 생성 · 검수", [], head=RED)
    hero(im, d, 1800, 540, 560, "claude", "Claude API", h=84)
    logo(im, "anthropic", 2070 - 60, 655, 22)
    lines_at(d, 0, 700, ["claude-opus-5-5 · 개인정보 전송 X"], size=24, center=2070)

    box(d, 1800, 830, 540, 300, "학습 자료 (외부)", [], head=NAVY)
    hero(im, d, 1800, 540, 925, "wikipedia", "한국어 위키백과", h=80, size=32)
    lines_at(d, 0, 1030, ["문서 718개 · 공식 문서 60개", "RFC · NIST · W3C · ISO 등"], size=24, center=2070)

    # 앱 ↔ Supabase
    arrow(d, [(620, 260), (800, 260)], both=True)
    chip(d, 710, 222, "HTTPS · JWT")
    arrow(d, [(620, 430), (700, 430), (700, 900), (800, 900)])
    chip(d, 700, 660, "topicId")
    # 앱 → 퀴즈 AI 서버
    arrow(d, [(620, 470), (680, 470), (680, 1350), (760, 1350)])
    chip(d, 680, 1180, "공부 시작 즉시")
    # REST ↔ DB
    arrow(d, [(1620, 570), (1700, 570), (1700, 260), (1800, 260)], both=True)
    chip(d, 1700, 420, "SQL · RLS")
    # Edge → DB (저장), Edge → Claude
    arrow(d, [(1620, 820), (1740, 820), (1740, 340), (1800, 340)], both=True, dash=True)
    arrow(d, [(1620, 960), (1760, 960), (1760, 620), (1800, 620)])
    chip(d, 1745, 740, "출제 · 검수")
    # 퀴즈 AI 서버 → Claude
    arrow(d, [(1660, 1420), (2380, 1420), (2380, 620), (2340, 620)])
    chip(d, 1880, 1420, "출제 · 1차 · 2차 검수")
    # 앱 → 학습 자료 (인앱 브라우저)
    arrow(d, [(340, 1040), (340, 1530), (2300, 1530), (2300, 1130)], dash=True)
    chip(d, 1200, 1530, "앱 안 문서 창으로 위키백과 · 공식 문서 열기 (시간이 끝나면 자동으로 닫힘)")
    im.save(os.path.join(OUT, "architecture.png"))


def table_box(d, x, y, w, name, cols, head=INK):
    rowh = 46
    h = 74 + rowh * len(cols) + 16
    d.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=WHITE, outline=INK, width=4)
    d.rounded_rectangle([x, y, x + w, y + 70], radius=18, fill=head)
    d.rectangle([x, y + 48, x + w, y + 70], fill=head)
    d.text((x + 24, y + 35), name, font=F(32, 800), fill=WHITE, anchor="lm")
    ty = y + 84
    for c, t, key in cols:
        if key:
            d.rounded_rectangle([x + 18, ty + 4, x + 62, ty + 34], radius=6, fill=GOLD if key == "PK" else CHIP)
            d.text((x + 40, ty + 19), key, font=F(17, 800), fill=INK, anchor="mm")
        d.text((x + 76, ty + 19), c, font=F(24, 650), fill=INK, anchor="lm")
        d.text((x + w - 24, ty + 19), t, font=F(21, 450), fill=GRAY, anchor="rm")
        ty += rowh
    return h


def erd():
    W, H = 2200, 1060
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    table_box(d, 60, 380, 420, "auth.users", [("id", "uuid", "PK"), ("email", "text", ""), ("created_at", "timestamptz", "")], head=GRAY)
    table_box(d, 640, 60, 620, "profiles", [
        ("id", "uuid", "PK"), ("nickname", "text (1~20자)", ""), ("interests", "text[] 세부 분야", ""),
        ("level", "0~3 (골고루·Lv.1~3)", ""), ("study_minutes", "int (기본 15)", ""),
        ("reminder_enabled", "boolean", ""), ("reminder_time", "'HH:MM'", "")])
    table_box(d, 640, 520, 620, "study_records", [
        ("id", "uuid (앱에서 생성)", "PK"), ("user_id", "uuid", "FK"), ("topic_id", "text", ""),
        ("score / quiz_total", "smallint", ""), ("rp", "int 랭크 포인트", ""), ("wrong", "jsonb 오답", ""),
        ("memo · study_sec", "text · int", ""), ("quiz_source", "bank·ai·offline", ""), ("studied_at", "timestamptz", "")])
    table_box(d, 1480, 380, 660, "quizzes", [
        ("topic_id", "text", "PK"), ("questions", "jsonb 검수 통과 AI 문제", ""), ("model", "text", ""), ("created_at", "timestamptz", "")], head=RED)

    def rel(p1, p2, label, l1="1", l2="N"):
        arrow(d, [p1, ((p1[0] + p2[0]) / 2, p1[1]), ((p1[0] + p2[0]) / 2, p2[1]), p2], width=4)
        chip(d, (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, label, size=21)
        d.text((p1[0] + 12, p1[1] - 32), l1, font=F(24, 800), fill=RED)
        d.text((p2[0] - 36, p2[1] - 32), l2, font=F(24, 800), fill=RED)

    rel((480, 450), (640, 140), "1 : 1", "1", "1")
    rel((480, 520), (640, 640), "1 : N")
    d.text((1480, 700), "※ 앱은 quizzes 표에 직접 접근하지 않고", font=F(22, 500), fill=GRAY)
    d.text((1480, 734), "   서버 함수(service role)만 읽고 씁니다.", font=F(22, 500), fill=GRAY)
    d.text((1480, 790), "※ 모든 표는 RLS 사용: 본인 행만 조회·수정", font=F(22, 500), fill=GRAY)
    d.text((1480, 824), "※ 랭크는 study_records에서 계산 (별도 저장 X)", font=F(22, 500), fill=GRAY)
    im.save(os.path.join(OUT, "erd.png"))


def gantt():
    tasks = [
        ("기획 · 요구사항 분석", "2026-09-01", "2026-09-21", "공통", True),
        ("화면 설계 · 앱 MVP (뽑기·타이머·기록)", "2026-09-15", "2026-10-12", "이재빈", True),
        ("공학·과학 주제 데이터 (1,054개)", "2026-10-06", "2026-10-26", "이재빈", True),
        ("퀴즈 · 레벨 · 랭크 · 오답 노트", "2026-10-19", "2026-11-02", "이재빈", True),
        ("퀴즈 문제 은행 작성 · 분야별 검수", "2026-10-26", "2026-11-30", "이재빈", False),
        ("AI 출제 · 2번 검수 지침, 문제 품질 점검", "2026-10-26", "2026-11-23", "김주안", False),
        ("Supabase DB · RLS · 기록 동기화", "2026-11-02", "2026-11-16", "김창원", False),
        ("카카오 · Apple 로그인 (Supabase Auth)", "2026-11-09", "2026-11-23", "김창원", False),
        ("퀴즈 AI 서버 · 서버 함수 배포 · CI", "2026-11-02", "2026-11-23", "강건우", False),
        ("화면 디자인 다듬기", "2026-11-16", "2026-11-30", "이재빈", False),
        ("사용자 테스트 · 개선", "2026-11-23", "2026-12-07", "이재빈", False),
        ("발표 준비 · 최종 보고서", "2026-12-01", "2026-12-14", "공통", False),
    ]
    colors = {"이재빈": RED, "강건우": NAVY, "김창원": GREEN, "김주안": GOLD, "공통": GRAY}
    start, end = dt.date(2026, 9, 1), dt.date(2026, 12, 20)
    days = (end - start).days
    W, left, top, rowh = 2400, 640, 150, 78
    H = top + rowh * len(tasks) + 170
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    x0, x1 = left, W - 60
    px = (x1 - x0) / days
    # 달 표시
    for m in (9, 10, 11, 12):
        ms = dt.date(2026, m, 1)
        me = dt.date(2026, m + 1, 1) if m < 12 else end
        a, b = x0 + (ms - start).days * px, x0 + min((me - start).days, days) * px
        d.rectangle([a, 60, b, 110], fill=NAVY if m % 2 else (52, 64, 98))
        d.text(((a + b) / 2, 85), f"{m}월", font=F(30, 800), fill=WHITE, anchor="mm")
    # 주 눈금
    wk = start
    while wk <= end:
        x = x0 + (wk - start).days * px
        d.line([x, 120, x, H - 150], fill=(236, 232, 224), width=2)
        wk += dt.timedelta(days=7)
    # 오늘
    today = dt.date(2026, 10, 31)
    tx = x0 + (today - start).days * px
    for y in range(120, H - 150, 20):
        d.line([tx, y, tx, y + 10], fill=RED, width=4)
    d.text((tx + 8, 128), "현재 (10/31)", font=F(22, 700), fill=RED)
    for i, (name, s, e, who, done) in enumerate(tasks):
        y = top + i * rowh
        d.text((60, y + rowh / 2), name, font=F(27, 650), fill=INK, anchor="lm")
        a = x0 + (dt.date.fromisoformat(s) - start).days * px
        b = x0 + (dt.date.fromisoformat(e) - start).days * px
        c = colors[who]
        if done:
            d.rounded_rectangle([a, y + 16, b, y + rowh - 16], radius=12, fill=c)
        else:
            d.rounded_rectangle([a, y + 16, b, y + rowh - 16], radius=12, fill=WHITE, outline=c, width=5)
        d.text((b + 12, y + rowh / 2), who, font=F(22, 600), fill=GRAY, anchor="lm")
    # 범례
    lx, ly = 60, H - 110
    for who, c in colors.items():
        d.rounded_rectangle([lx, ly, lx + 40, ly + 28], radius=6, fill=c)
        d.text((lx + 52, ly + 14), who, font=F(24, 600), fill=INK, anchor="lm")
        lx += 200
    d.rounded_rectangle([lx + 40, ly, lx + 80, ly + 28], radius=6, fill=GRAY)
    d.text((lx + 92, ly + 14), "완료", font=F(24, 600), fill=INK, anchor="lm")
    d.rounded_rectangle([lx + 200, ly, lx + 240, ly + 28], radius=6, fill=WHITE, outline=GRAY, width=4)
    d.text((lx + 252, ly + 14), "예정", font=F(24, 600), fill=INK, anchor="lm")
    im.save(os.path.join(OUT, "schedule.png"))


def bars(d, x, y, w, h, title, items, unit, src, color):
    d.text((x, y), title, font=F(32, 800), fill=INK)
    top, base = y + 90, y + h - 70
    mx = max(v for _, v, _ in items)
    bw = w / (len(items) * 2)
    for i, (label, v, note) in enumerate(items):
        bx = x + bw * (0.5 + i * 2)
        bh = (base - top - 40) * v / mx
        d.rounded_rectangle([bx, base - bh, bx + bw * 1.2, base], radius=10, fill=color if i == len(items) - 1 else (200, 196, 186))
        d.text((bx + bw * 0.6, base - bh - 24), f"{v:,}{unit}", font=F(28, 800), fill=INK, anchor="mm")
        d.text((bx + bw * 0.6, base + 28), label, font=F(24, 600), fill=GRAY, anchor="mm")
        if note:
            d.text((bx + bw * 0.6, base - bh / 2), note, font=F(22, 700), fill=WHITE, anchor="mm")
    d.line([x, base, x + w, base], fill=INK, width=3)
    d.text((x, y + h - 20), src, font=F(18, 450), fill=GRAY)


def market():
    W, H = 2200, 760
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    bars(d, 60, 40, 960, 680, "온라인 언어 학습 시장 규모 (억 달러)",
         [("2024년", 221, ""), ("2030년 (전망)", 548, "연 16.6%↑")], "",
         "자료: Grand View Research, Online Language Learning Market Report", RED)
    bars(d, 1180, 40, 960, 680, "듀오링고 하루 사용자 수 DAU (만 명)",
         [("2025년 2분기", 4770, ""), ("2026년 2분기", 5870, "+23%")], "",
         "자료: Duolingo 2026년 2분기 주주서한 (SEC 8-K)", NAVY)
    im.save(os.path.join(OUT, "market.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    architecture()
    erd()
    gantt()
    market()
    print("saved architecture.png, erd.png, schedule.png")
