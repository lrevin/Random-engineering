"""로고 3차 시안 4종: 슬롯머신 + 공학 기호 (톱니·번개·원자·칩).
사용법: python scripts/make_logo_concepts3.py  → docs/images/logo-concepts/v3/
"""
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from make_logo_concepts2 import F, S, blueprint_bg, gear_pts, rays, rounded, shadow, vgrad

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "images", "logo-concepts", "v3")

NAVY = (29, 39, 66)
RED = (224, 69, 58)
CREAM = (255, 252, 244)
YELLOW = (247, 181, 0)
CLEAR = (0, 0, 0, 0)


# ---------- 릴에 들어가는 공학 기호 ----------
def symbol(kind, sz, col):
    im = Image.new("RGBA", (sz, sz), CLEAR)
    d = ImageDraw.Draw(im)
    c = sz / 2
    if kind == "gear":
        pts = gear_pts(c, c, sz * 0.47, sz * 0.36, 8, rot=math.pi / 8, tooth=0.46)
        d.polygon(pts, fill=col)
        d.line(pts + [pts[0], pts[1]], fill=col, width=max(2, int(sz * 0.03)), joint="curve")
        r = sz * 0.14
        d.ellipse([c - r, c - r, c + r, c + r], fill=CLEAR)
    elif kind == "bolt":
        p = [(0.60, 0.03), (0.17, 0.57), (0.45, 0.57), (0.35, 0.97), (0.83, 0.40), (0.55, 0.40), (0.68, 0.03)]
        pts = [(x * sz, y * sz) for x, y in p]
        d.polygon(pts, fill=col)
        d.line(pts + [pts[0], pts[1]], fill=col, width=max(2, int(sz * 0.03)), joint="curve")
    elif kind == "atom":
        for ang in (0, 60, 120):
            t = Image.new("RGBA", (sz, sz), CLEAR)
            ImageDraw.Draw(t).ellipse([sz * 0.04, sz * 0.32, sz * 0.96, sz * 0.68], outline=col, width=int(sz * 0.065))
            im.alpha_composite(t.rotate(ang, resample=Image.BICUBIC))
        r = sz * 0.1
        d.ellipse([c - r, c - r, c + r, c + r], fill=col)
    elif kind == "chip":
        w = max(2, int(sz * 0.065))
        for k in (0.35, 0.5, 0.65):
            d.line([k * sz, sz * 0.1, k * sz, sz * 0.9], fill=col, width=w)
            d.line([sz * 0.1, k * sz, sz * 0.9, k * sz], fill=col, width=w)
        d.rounded_rectangle([sz * 0.22, sz * 0.22, sz * 0.78, sz * 0.78], radius=int(sz * 0.07), fill=col)
        d.rounded_rectangle([sz * 0.36, sz * 0.36, sz * 0.64, sz * 0.64], radius=int(sz * 0.04), fill=CLEAR)
        r = sz * 0.06
        d.ellipse([c - r, c - r, c + r, c + r], fill=col)
    return im


def vblur(im, n=9, dist=110):
    """세로 모션 블러 (돌아가는 릴). offset이 위아래로 감기므로 릴처럼 보인다."""
    out = im
    for i in range(1, n):
        out = Image.blend(out, ImageChops.offset(im, 0, int(dist * i / n)), 1 / (i + 1))
    return out


def reel(w, h, syms, bg=CREAM, spin=False, shade=190, sz_ratio=0.74, pitch_ratio=1.18, tint=(8, 12, 24)):
    """syms = [(위, 색), (가운데, 색), (아래, 색)] — 위·아래 기호는 반쯤 잘려 보인다."""
    sz = int(w * sz_ratio)
    pitch = int(sz * pitch_ratio)
    tall = Image.new("RGBA", (w, h + 2 * sz), bg + (255,))
    for i, (kind, col) in enumerate(syms):
        cy = sz + h // 2 + (i - 1) * pitch
        tall.alpha_composite(symbol(kind, sz, col), (w // 2 - sz // 2, cy - sz // 2))
    im = tall.crop((0, sz, w, sz + h))
    if spin:
        im = vblur(im)
    # 원통처럼 위아래를 어둡게
    a = Image.new("L", (1, h))
    for y in range(h):
        a.putpixel((0, y), int(shade * (abs(y - h / 2) / (h / 2)) ** 2.4))
    ov = Image.new("RGBA", (w, h), tint + (255,))
    ov.putalpha(a.resize((w, h)))
    im.alpha_composite(ov)
    return im


# ---------- 기계 부품 ----------
def rivet(d, x, y, r, base, hi):
    d.ellipse([x - r, y - r, x + r, y + r], fill=base)
    d.ellipse([x - r * 0.55, y - r * 0.65, x + r * 0.15, y + r * 0.05], fill=hi)


def lever(d, x_body, y_mid, x_rod, y_top, rod, ball, ball_hi, r=100, knuckle=None):
    d.rounded_rectangle([x_body - 10, y_mid - 85, x_body + 80, y_mid + 85], radius=24, fill=knuckle or rod)
    d.line([x_body + 60, y_mid, x_rod, y_mid], fill=rod, width=50)
    d.line([x_rod, y_mid, x_rod, y_top], fill=rod, width=50)
    d.ellipse([x_rod - 25, y_mid - 25, x_rod + 25, y_mid + 25], fill=rod)
    d.ellipse([x_rod - r, y_top - r, x_rod + r, y_top + r], fill=ball)
    if ball_hi:
        d.ellipse([x_rod - r * 0.6, y_top - r * 0.7, x_rod - r * 0.05, y_top - r * 0.2], fill=ball_hi)


def sparkle(d, x, y, r, col):
    d.polygon([(x, y - r), (x + r * 0.22, y - r * 0.22), (x + r, y), (x + r * 0.22, y + r * 0.22),
               (x, y + r), (x - r * 0.22, y + r * 0.22), (x - r, y), (x - r * 0.22, y - r * 0.22)], fill=col)


def mask_of(draw_fn):
    m = Image.new("L", (S, S), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def slot_machine(bg, p, syms3, spin_idx=None, bulbs=False):
    """3릴 슬롯머신. 오른쪽에 레버, 위에 톱니 간판."""
    bx = 950
    body = [bx - 590, 560, bx + 590, 1660]
    marq = [bx - 470, 330, bx + 470, 640]
    sil = mask_of(lambda m: (m.rounded_rectangle(body, radius=140, fill=255), m.rounded_rectangle(marq, radius=140, fill=255)))
    bg.alpha_composite(shadow(sil, (0, 46), 40, 170))
    d = ImageDraw.Draw(bg)
    lever(d, bx + 590, 1070, bx + 720, 430, p["rod"], p["ball"], p["ball_hi"], knuckle=p["knuckle"])

    layer = Image.new("RGBA", (S, S), CLEAR)
    layer.paste(vgrad((S, S), p["marq_top"], p["marq_bot"]), (0, 0), mask_of(lambda m: m.rounded_rectangle(marq, radius=140, fill=255)))
    layer.paste(vgrad((S, S), p["body_top"], p["body_bot"]), (0, 0), mask_of(lambda m: m.rounded_rectangle(body, radius=140, fill=255)))
    bg.alpha_composite(layer)
    d = ImageDraw.Draw(bg)

    if bulbs:  # 간판 테두리 전구
        glow = Image.new("RGBA", (S, S), CLEAR)
        gd = ImageDraw.Draw(glow)
        pts = [(bx + x, 372) for x in range(-360, 361, 120)] + [(bx - 430, 470), (bx + 430, 470)]
        for x, y in pts:
            gd.ellipse([x - 40, y - 40, x + 40, y + 40], fill=(255, 220, 110, 200))
        bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))
        d = ImageDraw.Draw(bg)
        for i, (x, y) in enumerate(pts):
            d.ellipse([x - 20, y - 20, x + 20, y + 20], fill=(255, 250, 220) if i % 2 else (255, 214, 90))
    bg.alpha_composite(symbol("gear", 250, p["marq_icon"]), (bx - 125, 465 - 125))

    # 릴 창
    d.rounded_rectangle([bx - 525, 725, bx + 525, 1335], radius=80, fill=p["frame"])
    w, h, gap = 307, 530, 24
    x0 = bx - 485
    for i, s in enumerate(syms3):
        r = reel(w, h, s, bg=p["reel_bg"], spin=(i == spin_idx))
        bg.alpha_composite(r, (x0 + i * (w + gap), 765))
    # 당첨선
    d.line([bx - 500, 1030, bx + 500, 1030], fill=p["payline"] + (150,), width=8)
    for sgn in (-1, 1):
        x = bx + sgn * 525
        d.polygon([(x, 990), (x, 1070), (x - sgn * 46, 1030)], fill=p["payline"])

    # 아래 패널 · 리벳
    d.rounded_rectangle([bx - 170, 1450, bx + 170, 1505], radius=27, fill=p["frame"])
    for sgn in (-1, 1):
        x = bx + sgn * 380
        d.ellipse([x - 58, 1420, x + 58, 1536], fill=p["button"])
        d.ellipse([x - 30, 1438, x + 10, 1470], fill=(255, 255, 255, 110))
    for x in (bx - 530, bx + 530):
        for y in (620, 1600):
            rivet(d, x, y, 22, p["rivet"], p["rivet_hi"])
    return bg


# ---------- 시안 ----------
def v1():  # 슬롯 블루프린트
    bg = blueprint_bg((24, 60, 120), (14, 36, 82), (40, 82, 150, 255), (70, 120, 190, 255))
    p = dict(body_top=(248, 250, 254), body_bot=(178, 190, 210), marq_top=(255, 206, 60), marq_bot=(236, 160, 10),
             marq_icon=(15, 30, 66, 255), frame=(15, 30, 66), reel_bg=CREAM, payline=RED, button=RED,
             rod=(150, 162, 186), knuckle=(110, 122, 148), ball=RED, ball_hi=(255, 150, 140),
             rivet=(130, 142, 166), rivet_hi=(235, 240, 248))
    syms = [[("atom", NAVY), ("bolt", YELLOW), ("chip", NAVY)],
            [("chip", NAVY), ("gear", RED), ("bolt", YELLOW)],
            [("gear", RED), ("atom", NAVY), ("bolt", YELLOW)]]
    return slot_machine(bg, p, syms, spin_idx=2).resize((1024, 1024), Image.LANCZOS)


def v2():  # 기어 슬롯 (뽑공 컬러)
    bg = blueprint_bg((32, 44, 76), (20, 27, 48), (44, 58, 96, 255), (64, 80, 124, 255))
    c, cy = S / 2, S / 2 + 20
    gm = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(gm)
    pts = gear_pts(c, cy, 800, 670, 12, rot=math.pi / 12)
    md.polygon(pts, fill=255)
    md.line(pts + [pts[0], pts[1]], fill=255, width=40, joint="curve")
    gm = gm.filter(ImageFilter.GaussianBlur(3))
    bg.alpha_composite(shadow(gm, (0, 40), 40, 170))
    gl = Image.new("RGBA", (S, S), CLEAR)
    gl.paste(vgrad((S, S), (255, 250, 238), (232, 216, 188)), (0, 0), gm)
    bg.alpha_composite(gl)
    d = ImageDraw.Draw(bg)
    win = [c - 545, cy - 300, c + 545, cy + 300]
    d.rounded_rectangle([win[0] - 34, win[1] - 34, win[2] + 34, win[3] + 34], radius=110, fill=(176, 45, 38))
    d.rounded_rectangle(win, radius=80, fill=NAVY)
    w, h, gap = 320, 540, 24
    x0 = int(c - (3 * w + 2 * gap) / 2)
    syms = [[("bolt", YELLOW), ("chip", NAVY), ("atom", NAVY)],
            [("atom", NAVY), ("gear", RED), ("chip", NAVY)],
            [("chip", NAVY), ("bolt", YELLOW), ("gear", RED)]]
    for i, s in enumerate(syms):
        bg.alpha_composite(reel(w, h, s), (x0 + i * (w + gap), int(cy - h / 2)))
    for sgn in (-1, 1):
        x = c + sgn * 545
        d.polygon([(x, cy - 40), (x, cy + 40), (x - sgn * 46, cy)], fill=RED)
    rays(d, c, cy, YELLOW, n=3, r0=860, r1=960, width=46, spread=50)
    for ang in (-150, -30, 150, 30):
        a = math.radians(ang)
        rivet(d, c + 585 * math.cos(a), cy + 585 * math.sin(a), 24, (214, 196, 164), (255, 255, 250))
    return bg.resize((1024, 1024), Image.LANCZOS)


def v3():  # 잭팟 골드 — 톱니 3개가 나란히
    bg = vgrad((S, S), (40, 30, 52), (12, 10, 20)).convert("RGBA")
    d = ImageDraw.Draw(bg)
    c = S / 2
    for r, a in ((980, 40), (760, 55)):
        d.ellipse([c - r, c - r, c + r, c + r], outline=(255, 200, 80, a), width=5)
    p = dict(body_top=(255, 214, 102), body_bot=(186, 122, 20), marq_top=(196, 40, 52), marq_bot=(130, 20, 34),
             marq_icon=(255, 214, 102, 255), frame=(24, 18, 30), reel_bg=CREAM, payline=(196, 40, 52),
             button=(196, 40, 52), rod=(214, 170, 70), knuckle=(150, 100, 20), ball=(196, 40, 52),
             ball_hi=(255, 130, 130), rivet=(150, 100, 20), rivet_hi=(255, 236, 170))
    syms = [[("bolt", (196, 40, 52)), ("gear", NAVY), ("atom", NAVY)],
            [("chip", (196, 40, 52)), ("gear", NAVY), ("bolt", (196, 40, 52))],
            [("atom", NAVY), ("gear", NAVY), ("chip", (196, 40, 52))]]
    slot_machine(bg, p, syms, bulbs=True)
    d = ImageDraw.Draw(bg)
    for x, y, r in ((260, 520, 60), (1820, 1260, 50), (300, 1540, 40), (1700, 1640, 64)):
        sparkle(d, x, y, r, (255, 220, 120))
    return bg.resize((1024, 1024), Image.LANCZOS)


def v4():  # 원 릴 미니멀 (플랫)
    bg = Image.new("RGBA", (S, S), (242, 230, 206, 255))
    d = ImageDraw.Draw(bg)
    bx = 960
    lever(d, bx + 450, 1080, bx + 580, 440, NAVY, RED, None, r=105)
    d.rounded_rectangle([bx - 450, 420, bx + 450, 1660], radius=190, fill=NAVY)
    for i, col in enumerate((YELLOW, RED, YELLOW)):
        x = bx + (i - 1) * 110
        d.ellipse([x - 32, 498, x + 32, 562], fill=col)
    d.rounded_rectangle([bx - 330, 630, bx + 330, 1480], radius=110, fill=(16, 22, 40))
    r = reel(600, 790, [("bolt", YELLOW), ("gear", RED), ("atom", NAVY)], bg=CREAM, shade=150)
    bg.alpha_composite(r, (bx - 300, 660))
    d.rounded_rectangle([bx - 140, 1546, bx + 140, 1590], radius=22, fill=(16, 22, 40))
    for sgn in (-1, 1):
        x = bx + sgn * 330
        d.polygon([(x, 1015), (x, 1095), (x - sgn * 44, 1055)], fill=YELLOW)
    sparkle(d, bx - 560, 520, 90, YELLOW)
    sparkle(d, bx - 640, 760, 44, RED)
    return bg.resize((1024, 1024), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    items = [("1", "슬롯 블루프린트", "설계도 위 은색 슬롯머신", v1()),
             ("2", "기어 슬롯", "톱니바퀴 속 릴 · 뽑공 컬러", v2()),
             ("3", "잭팟 골드", "톱니 3개 잭팟 · 전구 간판", v3()),
             ("4", "원 릴 미니멀", "릴 하나 · 작은 크기에 강함", v4())]
    tile, pad = 520, 64
    sh = Image.new("RGB", (pad + len(items) * (tile + pad), pad + tile + 180), (246, 242, 234))
    d = ImageDraw.Draw(sh)
    for i, (k, name, desc, im) in enumerate(items):
        r = rounded(im)
        r.save(os.path.join(OUT, f"{k}-{name}.png"))
        x = pad + i * (tile + pad)
        t = r.resize((tile, tile), Image.LANCZOS)
        sh.paste(t, (x, pad), t)
        d.text((x + tile / 2, pad + tile + 56), f"{k}. {name}", font=F(40, 800), fill=(17, 22, 38), anchor="mm")
        d.text((x + tile / 2, pad + tile + 110), desc, font=F(26, 500), fill=(100, 106, 120), anchor="mm")
    sh.save(os.path.join(OUT, "3차-시안-모음.png"))
    print("saved")


if __name__ == "__main__":
    main()
