"""뽑공 로고·앱 아이콘 만들기 (Pillow).

사용법: python scripts/make_logo.py
결과:
  docs/images/logo.png          가로형 로고 (계획서·README용)
  docs/images/logo-dark.png     어두운 배경용
  app/assets/icon.png           앱 아이콘 1024×1024
  app/assets/android-icon-foreground.png / -background.png / -monochrome.png  안드로이드 적응형 아이콘
  app/assets/splash-icon.png    시작 화면 아이콘
  app/assets/favicon.png        웹 아이콘
  app/assets/logo.png           앱 첫 화면 로고 (부제 없음)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = r"C:\Windows\Fonts\NotoSansKR-VF.ttf"

INK = (17, 22, 38)          # 외곽선
NAVY = (29, 39, 66)
RED = (224, 69, 58)
RED_DARK = (176, 45, 38)
CREAM = (255, 248, 233)
WHITE = (255, 255, 255)
GOLD = (247, 181, 0)


def font(size, weight=900):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:  # noqa: BLE001
        pass
    return f


def gear_points(cx, cy, r_out, r_in, teeth, rot=0.0):
    """톱니바퀴 외곽 다각형"""
    pts = []
    step = 2 * math.pi / teeth
    for i in range(teeth):
        a = rot + i * step
        for da, r in ((-0.30, r_in), (-0.18, r_out), (0.18, r_out), (0.30, r_in)):
            ang = a + da * step * 1.6
            pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


def _face(S, bg, kind, stroke):
    """주사위 한 면 (정사각형 텍스처)"""
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.16), fill=bg)
    c = S / 2
    if kind == "gear":
        gp = gear_points(c, c, S * 0.40, S * 0.31, 10, rot=0.15)
        d.polygon(gp, fill=GOLD)
        d.line(gp + [gp[0]], fill=INK, width=int(stroke * 0.9), joint="curve")
        d.ellipse([c - S * 0.23, c - S * 0.23, c + S * 0.23, c + S * 0.23], fill=GOLD, outline=INK, width=int(stroke * 0.9))
        d.ellipse([c - S * 0.10, c - S * 0.10, c + S * 0.10, c + S * 0.10], fill=CREAM, outline=INK, width=int(stroke * 0.9))
    else:
        r = S * 0.085
        spots = {
            "two": [(0.28, 0.28), (0.72, 0.72)],
            "three": [(0.26, 0.26), (0.5, 0.5), (0.74, 0.74)],
        }[kind]
        for fx, fy in spots:
            d.ellipse([S * fx - r, S * fy - r, S * fx + r, S * fy + r], fill=NAVY)
    return im


def _paste_face(canvas, tex, p0, p1, p3):
    """정사각형 텍스처를 평행사변형(p0=왼위, p1=오른위, p3=왼아래)에 붙이기"""
    S = tex.width
    ax, ay = (p1[0] - p0[0]) / S, (p1[1] - p0[1]) / S
    bx, by = (p3[0] - p0[0]) / S, (p3[1] - p0[1]) / S
    det = ax * by - ay * bx
    ia, ib, ic, id_ = by / det, -bx / det, -ay / det, ax / det
    # 출력(x,y) → 입력(u,v):  u = ia*(x-x0) + ib*(y-y0),  v = ic*(x-x0) + id*(y-y0)
    coeffs = (ia, ib, -(ia * p0[0] + ib * p0[1]), ic, id_, -(ic * p0[0] + id_ * p0[1]))
    warped = tex.transform(canvas.size, Image.AFFINE, coeffs, resample=Image.BICUBIC)
    canvas.alpha_composite(warped)


def capsule(size, stroke):
    """랜덤 뽑기 주사위 + 톱니바퀴(공학) 아이콘 (정사각형 RGBA)"""
    S = size
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx, cy = S / 2, S / 2
    e = S * 0.40          # 모서리 길이
    k = math.cos(math.pi / 6)
    top = (cx, cy - e)
    right = (cx + e * k, cy - e / 2)
    left = (cx - e * k, cy - e / 2)
    mid = (cx, cy)
    bl = (cx - e * k, cy + e / 2)
    br = (cx + e * k, cy + e / 2)
    bot = (cx, cy + e)

    # 그림자
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    off = stroke * 0.9
    ImageDraw.Draw(sh).polygon([(x + off, y + off) for x, y in (top, right, br, bot, bl, left)], fill=INK)
    im.alpha_composite(sh)

    T = 600
    _paste_face(im, _face(T, RED, "gear", stroke * T / S * 1.4), left, top, mid)          # 윗면
    _paste_face(im, _face(T, CREAM, "three", stroke), left, mid, bl)                       # 왼쪽 면
    _paste_face(im, _face(T, (243, 226, 196), "two", stroke), mid, right, bot)             # 오른쪽 면

    d = ImageDraw.Draw(im)
    w = stroke
    d.line([top, right, br, bot, bl, left, top], fill=INK, width=w, joint="curve")
    d.line([left, mid, right], fill=INK, width=int(w * 0.8), joint="curve")
    d.line([mid, bot], fill=INK, width=int(w * 0.8))
    for p in (top, right, br, bot, bl, left):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=INK)
    return im


def outlined_text(text, size, fill, stroke, shadow=True):
    f = font(size)
    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    l, t, r, b = tmp.textbbox((0, 0), text, font=f, stroke_width=stroke)
    w, h = r - l + stroke * 2, b - t + stroke * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ox, oy = -l + stroke, -t + stroke
    if shadow:
        d.text((ox + stroke * 0.5, oy + stroke * 0.7), text, font=f, fill=INK, stroke_width=stroke, stroke_fill=INK)
    d.text((ox, oy), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=INK)
    return im


def sparkle(d, cx, cy, r, color, outline, w):
    pts = []
    for i in range(8):
        a = i * math.pi / 4 - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.38
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=color)
    d.line(pts + [pts[0]], fill=outline, width=w, joint="curve")


def wide_logo(dark=False, subtitle=True):
    W, H = 2600, 1200
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    stroke = 26

    cap = capsule(720, 26)
    im.alpha_composite(cap, (60, 90))

    ppob = outlined_text("뽑", 560, WHITE, stroke)
    gong = outlined_text("공", 560, RED, stroke)
    x = 820
    im.alpha_composite(ppob, (x, 150))
    im.alpha_composite(gong, (x + ppob.width - 40, 150))

    d = ImageDraw.Draw(im)
    sparkle(d, 760, 190, 70, GOLD, INK, 12)
    sparkle(d, 2440, 260, 52, GOLD, INK, 10)
    sparkle(d, 2330, 120, 30, RED, INK, 8)

    if not subtitle:
        return im.crop(im.getbbox())
    sub_color = CREAM if dark else NAVY
    f = font(118, 800)
    d.text((W / 2 + 140, 960), "뽑는 공학 공부", font=f, fill=sub_color, anchor="mm")
    f2 = font(56, 700)
    d.text((W / 2 + 140, 1080), "R A N D O M   E N G I N E E R I N G", font=f2, fill=RED if not dark else GOLD, anchor="mm")
    return im.crop(im.getbbox())


def save_flat(im, path, bg):
    out = Image.new("RGBA", im.size, bg)
    out.alpha_composite(im)
    out.convert("RGB").save(path)


def app_icon():
    S = 1024
    bg = Image.new("RGBA", (S, S), NAVY + (255,))
    d = ImageDraw.Draw(bg)
    # 은은한 격자 (모눈 공책 느낌)
    for i in range(0, S, 64):
        d.line([(i, 0), (i, S)], fill=(40, 52, 86), width=2)
        d.line([(0, i), (S, i)], fill=(40, 52, 86), width=2)
    cap = capsule(900, 30)
    bg.alpha_composite(cap, ((S - cap.width) // 2, (S - cap.height) // 2))
    sparkle(d, 820, 210, 62, GOLD, INK, 10)
    sparkle(d, 210, 820, 40, RED, INK, 8)
    return bg


def main():
    os.makedirs(os.path.join(ROOT, "docs", "images"), exist_ok=True)
    assets = os.path.join(ROOT, "app", "assets")

    logo = wide_logo()
    pad = Image.new("RGBA", (logo.width + 160, logo.height + 160), (0, 0, 0, 0))
    pad.alpha_composite(logo, (80, 80))
    pad.save(os.path.join(ROOT, "docs", "images", "logo.png"))
    save_flat(pad, os.path.join(ROOT, "docs", "images", "logo-white.png"), WHITE + (255,))
    dark = wide_logo(dark=True)
    padd = Image.new("RGBA", (dark.width + 160, dark.height + 160), NAVY + (255,))
    padd.alpha_composite(dark, (80, 80))
    padd.convert("RGB").save(os.path.join(ROOT, "docs", "images", "logo-dark.png"))

    # 앱 첫 화면용 (부제 없이)
    mark = wide_logo(subtitle=False)
    mark.thumbnail((1200, 1200), Image.LANCZOS)
    mark.save(os.path.join(assets, "logo.png"))

    icon = app_icon()
    icon.convert("RGB").save(os.path.join(assets, "icon.png"))
    icon.resize((48, 48), Image.LANCZOS).save(os.path.join(assets, "favicon.png"))

    # 안드로이드 적응형 아이콘: 전경(캡슐, 안전 영역 안쪽), 배경(남색), 단색
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    cap = capsule(700, 26)
    fg.alpha_composite(cap, ((1024 - cap.width) // 2, (1024 - cap.height) // 2))
    fg.save(os.path.join(assets, "android-icon-foreground.png"))
    Image.new("RGBA", (1024, 1024), NAVY + (255,)).save(os.path.join(assets, "android-icon-background.png"))
    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    alpha = fg.split()[3]
    mono.paste((255, 255, 255, 255), mask=alpha)
    mono.save(os.path.join(assets, "android-icon-monochrome.png"))

    splash = capsule(900, 30)
    splash.save(os.path.join(assets, "splash-icon.png"))
    print("logo", pad.size, "icon", icon.size)


if __name__ == "__main__":
    main()
