"""로고 시안 4종 (단일 아이콘) — 랜덤 + 공학.
사용법: python scripts/make_logo_concepts.py  → docs/images/logo-concepts/
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "images", "logo-concepts")
FONT = r"C:\Windows\Fonts\NotoSansKR-VF.ttf"
S = 2048  # 2배로 그린 뒤 줄여서 매끄럽게

INK = (17, 22, 38)
NAVY = (29, 39, 66)
NAVY2 = (40, 54, 92)
RED = (224, 69, 58)
RED_D = (170, 42, 36)
CREAM = (255, 248, 233)
GOLD = (247, 181, 0)
WHITE = (255, 255, 255)
CYAN = (62, 230, 193)


def F(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([w])
    except Exception:  # noqa: BLE001
        pass
    return f


def gear(cx, cy, ro, ri, teeth, rot=0.0, tooth=0.5):
    pts, step = [], 2 * math.pi / teeth
    for i in range(teeth):
        a = rot + i * step
        for da, r in ((-0.5 * tooth - 0.12, ri), (-0.5 * tooth, ro), (0.5 * tooth, ro), (0.5 * tooth + 0.12, ri)):
            ang = a + da * step
            pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


def outline(d, pts, w, color=INK):
    d.line(pts + [pts[0], pts[1]], fill=color, width=w, joint="curve")


def finish(im):
    return im.resize((1024, 1024), Image.LANCZOS)


# ───────── A. 기어 주사위 (스티커) ─────────
def concept_a():
    im = Image.new("RGB", (S, S), CREAM)
    d = ImageDraw.Draw(im)
    c = S / 2
    # 그림자
    d.polygon([(x + 34, y + 44) for x, y in gear(c, c, 820, 690, 10, rot=0.31)], fill=INK)
    g = gear(c, c, 820, 690, 10, rot=0.31)
    d.polygon(g, fill=RED)
    outline(d, g, 46)
    # 주사위 면 (가운데)
    r = 430
    d.rounded_rectangle([c - r + 22, c - r + 30, c + r + 22, c + r + 30], radius=150, fill=INK)
    d.rounded_rectangle([c - r, c - r, c + r, c + r], radius=150, fill=WHITE, outline=INK, width=40)
    pip = 92
    for fx, fy in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)):
        x, y = c + fx * 225, c + fy * 225
        d.ellipse([x - pip, y - pip, x + pip, y + pip], fill=NAVY if (fx, fy) != (0, 0) else RED)
    # 반짝이
    for sx, sy, sr in ((1690, 330, 120), (1830, 560, 60)):
        pts = []
        for i in range(8):
            a = i * math.pi / 4 - math.pi / 2
            rr = sr if i % 2 == 0 else sr * 0.36
            pts.append((sx + rr * math.cos(a), sy + rr * math.sin(a)))
        d.polygon(pts, fill=GOLD)
        outline(d, pts, 16)
    return finish(im)


# ───────── B. 셔플 기어 (미니멀 라인) ─────────
def concept_b():
    im = Image.new("RGB", (S, S), NAVY)
    d = ImageDraw.Draw(im)
    c = S / 2
    g = gear(c, c, 760, 640, 9, rot=0.0, tooth=0.46)
    outline(d, g, 70, GOLD)
    d.ellipse([c - 470, c - 470, c + 470, c + 470], outline=GOLD, width=40)
    w = 118
    L, R = c - 560, c + 470

    def curve(y0, y1):
        pts = []
        for i in range(41):
            t = i / 40
            x = L + (R - L) * t
            s = t * t * (3 - 2 * t)  # 부드러운 S 곡선
            pts.append((x, y0 + (y1 - y0) * s))
        return pts

    def arrowhead(x, y, color):
        h = 190
        d.polygon([(x + h * 0.95, y), (x - h * 0.15, y - h * 0.78), (x - h * 0.15, y + h * 0.78)], fill=color)

    p1 = curve(c + 300, c - 300)
    p2 = curve(c - 300, c + 300)
    d.line(p2, fill=WHITE, width=w, joint="curve")
    # 교차 지점에서 위쪽 화살표가 남색 틈을 두고 지나가도록
    d.line(p1, fill=NAVY, width=w + 70, joint="curve")
    d.line(p1, fill=RED, width=w, joint="curve")
    for p, col in ((p1, RED), (p2, WHITE)):
        d.ellipse([p[0][0] - w / 2, p[0][1] - w / 2, p[0][0] + w / 2, p[0][1] + w / 2], fill=col)
    arrowhead(R, c - 300, RED)
    arrowhead(R, c + 300, WHITE)
    return finish(im)


# ───────── C. 공학 슬롯머신 (레트로 배지) ─────────
def bolt(d, cx, cy, s, fill):
    pts = [(0.12, -0.5), (-0.30, 0.06), (-0.02, 0.06), (-0.16, 0.5), (0.30, -0.10), (0.02, -0.10)]
    pts = [(cx + x * s, cy + y * s) for x, y in pts]
    d.polygon(pts, fill=fill)
    outline(d, pts, 22)


def atom(im, cx, cy, s):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for ang in (0, 60, 120):
        e = Image.new("RGBA", (int(s * 2.2), int(s * 2.2)), (0, 0, 0, 0))
        ed = ImageDraw.Draw(e)
        w, h = e.size
        ed.ellipse([w * 0.08, h * 0.36, w * 0.92, h * 0.64], outline=NAVY + (255,), width=26)
        e = e.rotate(ang, resample=Image.BICUBIC)
        layer.alpha_composite(e, (int(cx - w / 2), int(cy - h / 2)))
    ImageDraw.Draw(layer).ellipse([cx - s * 0.17, cy - s * 0.17, cx + s * 0.17, cy + s * 0.17], fill=RED + (255,))
    im.alpha_composite(layer)


def concept_c():
    im = Image.new("RGBA", (S, S), NAVY + (255,))
    d = ImageDraw.Draw(im)
    # 바탕 광선
    c = S / 2
    for i in range(16):
        a0, a1 = i * math.pi / 8, i * math.pi / 8 + math.pi / 16
        d.polygon([(c, c), (c + 2000 * math.cos(a0), c + 2000 * math.sin(a0)), (c + 2000 * math.cos(a1), c + 2000 * math.sin(a1))], fill=NAVY2)
    # 몸통
    bx0, by0, bx1, by1 = 250, 470, 1700, 1640
    d.rounded_rectangle([bx0 + 30, by0 + 40, bx1 + 30, by1 + 40], radius=140, fill=INK)
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=140, fill=RED, outline=INK, width=44)
    d.rounded_rectangle([bx0 + 40, by0 + 40, bx1 - 40, by0 + 170], radius=60, fill=RED_D)
    for i in range(7):
        x = bx0 + 170 + i * 185
        d.ellipse([x - 34, by0 + 72, x + 34, by0 + 140], fill=GOLD if i % 2 == 0 else CREAM)
    # 창
    wx0, wy0, wx1, wy1 = bx0 + 110, by0 + 260, bx1 - 110, by1 - 210
    d.rounded_rectangle([wx0, wy0, wx1, wy1], radius=60, fill=CREAM, outline=INK, width=36)
    cw = (wx1 - wx0) / 3
    for k in (1, 2):
        d.line([wx0 + cw * k, wy0 + 20, wx0 + cw * k, wy1 - 20], fill=INK, width=26)
    cy = (wy0 + wy1) / 2
    cs = [wx0 + cw * (k + 0.5) for k in range(3)]
    g = gear(cs[0], cy, 175, 140, 9, rot=0.2)
    d.polygon(g, fill=GOLD)
    outline(d, g, 22)
    d.ellipse([cs[0] - 60, cy - 60, cs[0] + 60, cy + 60], fill=CREAM, outline=INK, width=22)
    bolt(d, cs[1], cy, 380, GOLD)
    atom(im, cs[2], cy, 210)
    d = ImageDraw.Draw(im)
    # 가운데 줄
    d.line([wx0 - 60, cy, wx0 - 6, cy], fill=GOLD, width=30)
    d.line([wx1 + 6, cy, wx1 + 60, cy], fill=GOLD, width=30)
    # 손잡이
    d.line([bx1 + 10, 1060, 1850, 1060, 1850, 640], fill=INK, width=70, joint="curve")
    d.line([bx1 + 10, 1060, 1850, 1060, 1850, 640], fill=CREAM, width=34, joint="curve")
    d.ellipse([1850 - 115, 540 - 115, 1850 + 115, 540 + 115], fill=GOLD, outline=INK, width=36)
    # 아래 칸
    d.rounded_rectangle([bx0 + 330, by1 - 150, bx1 - 330, by1 - 70], radius=40, fill=INK)
    return finish(im.convert("RGB"))


# ───────── D. 회로 물음표 (네온 테크) ─────────
def concept_d():
    im = Image.new("RGB", (S, S), (14, 18, 34))
    d = ImageDraw.Draw(im)
    # 은은한 격자
    for i in range(0, S, 128):
        d.line([i, 0, i, S], fill=(24, 32, 56), width=4)
        d.line([0, i, S, i], fill=(24, 32, 56), width=4)
    u = S / 100
    P = lambda x, y: (x * u, y * u)  # noqa: E731
    q = [P(30, 36), P(30, 28), P(38, 20), P(62, 20), P(70, 28), P(70, 42), P(58, 54), P(50, 54), P(50, 66)]
    branches = [
        [P(70, 34), P(80, 34), P(86, 28)],
        [P(38, 20), P(38, 12)],
        [P(58, 54), P(66, 62), P(78, 62)],
        [P(30, 30), P(20, 30), P(14, 36)],
    ]
    pads_main = [P(30, 38), P(50, 80)]
    pads_branch = [P(86, 28), P(38, 12), P(78, 62), P(14, 36)]

    glow = Image.new("RGB", (S, S), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    W, Wb = 120, 44
    gd.line(q, fill=CYAN, width=W + 70, joint="curve")
    for b in branches:
        gd.line(b, fill=CYAN, width=Wb + 40, joint="curve")
    for x, y in pads_main:
        gd.ellipse([x - 120, y - 120, x + 120, y + 120], fill=CYAN)
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    im = Image.blend(im, Image.new("RGB", (S, S), (0, 0, 0)), 0)
    im = Image.composite(im, im, Image.new("L", (S, S), 255))
    im = Image.fromarray(__import__("numpy").clip(__import__("numpy").asarray(im, dtype="int32") + __import__("numpy").asarray(glow, dtype="int32") * 0.55, 0, 255).astype("uint8")) if _has_np() else _add(im, glow)
    d = ImageDraw.Draw(im)
    for b in branches:
        d.line(b, fill=(150, 240, 220), width=Wb, joint="curve")
    for x, y in pads_branch:
        d.ellipse([x - 52, y - 52, x + 52, y + 52], fill=(14, 18, 34), outline=(150, 240, 220), width=22)
    d.line(q, fill=CYAN, width=W, joint="curve")
    d.ellipse([q[0][0] - W / 2, q[0][1] - W / 2, q[0][0] + W / 2, q[0][1] + W / 2], fill=CYAN)
    d.ellipse([q[-1][0] - W / 2, q[-1][1] - W / 2, q[-1][0] + W / 2, q[-1][1] + W / 2], fill=CYAN)
    # 물음표 점 = 칩
    x, y = pads_main[1]
    d.rounded_rectangle([x - 110, y - 110, x + 110, y + 110], radius=34, fill=GOLD)
    for k in range(-1, 2):
        for side in (-1, 1):
            d.line([x + k * 60, y + side * 110, x + k * 60, y + side * 160], fill=GOLD, width=26)
            d.line([x + side * 110, y + k * 60, x + side * 160, y + k * 60], fill=GOLD, width=26)
    d.rounded_rectangle([x - 50, y - 50, x + 50, y + 50], radius=14, fill=(14, 18, 34))
    return finish(im)


def _has_np():
    try:
        import numpy  # noqa: F401
        return True
    except ImportError:
        return False


def _add(a, b):
    from PIL import ImageChops
    return ImageChops.add(a, b.point(lambda v: int(v * 0.55)))


def rounded(im, r=0.22):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=int(im.width * r), fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out


def sheet(items):
    tile, pad, lab = 520, 60, 150
    W = pad + len(items) * (tile + pad)
    H = pad + tile + lab + 40
    sh = Image.new("RGB", (W, H), (246, 242, 234))
    d = ImageDraw.Draw(sh)
    for i, (key, name, desc, im) in enumerate(items):
        x = pad + i * (tile + pad)
        ic = rounded(im).resize((tile, tile), Image.LANCZOS)
        sh.paste(ic, (x, pad), ic)
        d.text((x + tile / 2, pad + tile + 50), f"{key}. {name}", font=F(40, 800), fill=INK, anchor="mm")
        d.text((x + tile / 2, pad + tile + 105), desc, font=F(26, 500), fill=(100, 106, 120), anchor="mm")
    return sh


def main():
    os.makedirs(OUT, exist_ok=True)
    items = [
        ("A", "기어 주사위", "스티커 · 톱니바퀴 속 주사위", concept_a()),
        ("B", "셔플 기어", "미니멀 라인 · 랜덤 섞기 화살표", concept_b()),
        ("C", "공학 슬롯머신", "레트로 배지 · 톱니·번개·원자 릴", concept_c()),
        ("D", "회로 물음표", "네온 테크 · 회로로 그린 ?", concept_d()),
    ]
    for key, name, _, im in items:
        rounded(im).save(os.path.join(OUT, f"{key}-{name}.png"))
    sheet(items).save(os.path.join(OUT, "시안-모음.png"))
    print("saved", len(items))


if __name__ == "__main__":
    main()
