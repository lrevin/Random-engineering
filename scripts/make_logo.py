"""뽑공 로고·앱 아이콘 만들기 (Pillow) — 슬롯머신 한 릴 + 톱니바퀴.

사용법: python scripts/make_logo.py
결과:
  docs/images/logo.png          가로형 로고 (투명, 계획서·README용)
  docs/images/logo-white.png    흰 배경
  docs/images/logo-dark.png     어두운 배경용
  docs/images/icon.png          앱 아이콘 미리보기 (둥근 모서리)
  app/assets/icon.png           앱 아이콘 1024×1024
  app/assets/android-icon-foreground.png / -background.png / -monochrome.png  안드로이드 적응형 아이콘
  app/assets/splash-icon.png / splash-icon-dark.png  시작 화면 아이콘
  app/assets/favicon.png        웹 아이콘
  app/assets/logo.png / logo-dark.png  앱 첫 화면 로고 (마크 + 뽑공, 밝은/어두운 화면)
"""
import os

from PIL import Image, ImageDraw, ImageFilter

from make_logo_concepts2 import F, rounded
from make_logo_concepts3 import lever, reel, sparkle, symbol

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 2048

NAVY = (29, 39, 66)
NAVY_DEEP = (16, 22, 40)
RED = (224, 69, 58)
YELLOW = (247, 181, 0)
CREAM = (242, 230, 206)     # 아이콘 배경 = 앱 배경색
REEL = (255, 250, 240)
WHITE = (255, 255, 255)
CLEAR = (0, 0, 0, 0)


def mark(body=NAVY, window=NAVY_DEEP, mono=None, sparkles=True):
    """배경 없는 슬롯머신 마크 (S×S RGBA). mono=색 을 주면 한 가지 색 실루엣(창은 뚫림)."""
    im = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(im)
    bx = 960
    if mono:
        body = window = mono
    lever(d, bx + 450, 1080, bx + 580, 440, body, mono or RED, None if mono else (240, 120, 108), r=105)
    d.rounded_rectangle([bx - 450, 420, bx + 450, 1660], radius=190, fill=body)
    for i, col in enumerate((YELLOW, RED, YELLOW)):
        x = bx + (i - 1) * 110
        d.ellipse([x - 32, 498, x + 32, 562], fill=CLEAR if mono else col)
    d.rounded_rectangle([bx - 330, 630, bx + 330, 1480], radius=110, fill=CLEAR if mono else window)
    if mono:
        im.alpha_composite(symbol("gear", 420, mono), (bx - 210, 1055 - 210))
    else:
        r = reel(600, 790, [("atom", NAVY), ("gear", RED), ("chip", NAVY)], bg=REEL, shade=120,
                 sz_ratio=0.70, pitch_ratio=1.08, tint=(29, 39, 66))
        # 릴 창 모서리를 둥글게
        m = Image.new("L", r.size, 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, r.width - 1, r.height - 1], radius=80, fill=255)
        r.putalpha(m)
        im.alpha_composite(r, (bx - 300, 660))
        # 유리 반사
        glass = Image.new("RGBA", (S, S), CLEAR)
        ImageDraw.Draw(glass).polygon([(bx - 300, 700), (bx - 160, 660), (bx - 300, 1130)], fill=(255, 255, 255, 70))
        glass.putalpha(Image.composite(glass.split()[3], Image.new("L", (S, S), 0), mask_rect(bx - 300, 660, bx + 300, 1450, 80)))
        im.alpha_composite(glass)
        for sgn in (-1, 1):
            x = bx + sgn * 330
            d.polygon([(x, 1015), (x, 1095), (x - sgn * 46, 1055)], fill=YELLOW)
    d.rounded_rectangle([bx - 140, 1546, bx + 140, 1590], radius=22, fill=CLEAR if mono else window)
    if sparkles:
        sparkle(d, bx - 560, 520, 90, mono or YELLOW)
        sparkle(d, bx - 640, 760, 44, mono or RED)
    return im


def mask_rect(x0, y0, x1, y1, r):
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)
    return m


def centered(im, size, box):
    """마크를 잘라서 size×size 캔버스 가운데 box 크기로 넣음"""
    c = im.crop(im.getbbox())
    c.thumbnail((box, box), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), CLEAR)
    out.alpha_composite(c, ((size - c.width) // 2, (size - c.height) // 2))
    return out


def app_icon():
    bg = Image.new("RGBA", (S, S), CREAM + (255,))
    bg.alpha_composite(mark())
    return bg.resize((1024, 1024), Image.LANCZOS)


def wordmark(dark=False, subtitle=True):
    """마크 + 뽑공 (+ 부제)"""
    m = mark(body=(52, 66, 108) if dark else NAVY, sparkles=False)
    m = m.crop(m.getbbox())
    H = 900
    m = m.resize((int(m.width * H / m.height), H), Image.LANCZOS)
    W = m.width + 1500
    im = Image.new("RGBA", (W, H + (330 if subtitle else 0)), CLEAR)
    im.alpha_composite(m, (0, 0))
    d = ImageDraw.Draw(im)
    f = F(620, 900)
    x = m.width + 90
    d.text((x, H * 0.47), "뽑", font=f, fill=(250, 244, 230) if dark else NAVY, anchor="lm")
    w = d.textlength("뽑", font=f)
    d.text((x + w - 10, H * 0.47), "공", font=f, fill=RED, anchor="lm")
    sparkle(d, x + 2 * w + 60, H * 0.12, 80, YELLOW)
    if subtitle:
        d.text((W / 2, H + 120), "뽑는 공학 공부", font=F(130, 800), fill=(250, 244, 230) if dark else NAVY, anchor="mm")
        d.text((W / 2, H + 260), "R A N D O M   E N G I N E E R I N G", font=F(62, 700), fill=YELLOW if dark else RED, anchor="mm")
    return im.crop(im.getbbox())


def pad(im, p, bg=CLEAR):
    out = Image.new("RGBA", (im.width + 2 * p, im.height + 2 * p), bg)
    out.alpha_composite(im, (p, p))
    return out


def main():
    docs = os.path.join(ROOT, "docs", "images")
    assets = os.path.join(ROOT, "app", "assets")
    os.makedirs(docs, exist_ok=True)

    logo = pad(wordmark(), 80)
    logo.thumbnail((1600, 1600), Image.LANCZOS)
    logo.save(os.path.join(docs, "logo.png"))
    pad(logo, 0, WHITE + (255,)).convert("RGB").save(os.path.join(docs, "logo-white.png"))
    dark = pad(wordmark(dark=True), 80, NAVY + (255,))
    dark.thumbnail((1600, 1600), Image.LANCZOS)
    dark.convert("RGB").save(os.path.join(docs, "logo-dark.png"))

    icon = app_icon()
    icon.convert("RGB").save(os.path.join(assets, "icon.png"))
    rounded(icon).save(os.path.join(docs, "icon.png"))
    icon.resize((48, 48), Image.LANCZOS).save(os.path.join(assets, "favicon.png"))

    # 앱 첫 화면용 (부제 없이)
    w = wordmark(subtitle=False)
    w.thumbnail((1200, 1200), Image.LANCZOS)
    w.save(os.path.join(assets, "logo.png"))
    wd = wordmark(dark=True, subtitle=False)
    wd.thumbnail((1200, 1200), Image.LANCZOS)
    wd.save(os.path.join(assets, "logo-dark.png"))
    print("app logo.png", w.size)

    # 안드로이드 적응형 아이콘: 안전 영역(가운데 약 66%) 안쪽에 마크
    centered(mark(), 1024, 560).save(os.path.join(assets, "android-icon-foreground.png"))
    Image.new("RGBA", (1024, 1024), CREAM + (255,)).save(os.path.join(assets, "android-icon-background.png"))
    centered(mark(mono=WHITE + (255,)), 1024, 560).save(os.path.join(assets, "android-icon-monochrome.png"))

    centered(mark(), 1024, 1000).save(os.path.join(assets, "splash-icon.png"))
    centered(mark(body=(52, 66, 108), window=NAVY_DEEP), 1024, 1000).save(os.path.join(assets, "splash-icon-dark.png"))
    print("done")


if __name__ == "__main__":
    main()
