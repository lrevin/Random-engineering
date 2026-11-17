"""테마별 앱 아이콘 · 시작 화면 그림 만들기 — 지금 앱 아이콘(미니 슬롯머신)의 색만 테마 색으로 바꿈.

사용법: python scripts/make_theme_icons.py
원본 그림: app/assets/theme-icons/_source/ (처음 실행 때 지금 아이콘에서 잘라 둔 미니 슬롯머신)
슬롯머신 몸통(창)을 가운데에 두고 레버는 오른쪽으로 나가게, 어느 모양으로 잘려도 안 잘리는 크기로 배치.
기본(클래식) 아이콘 · 시작 화면(app/assets/icon.png · android-icon-* · splash-icon*)도 같은 기준으로 다시 씀.
색은 app/src/themes.ts에서 읽음 (테마를 고치거나 늘리면 다시 실행).
결과: app/assets/theme-icons/<테마 id>/
  foreground.png  안드로이드 적응형 아이콘 앞면 (432 = 108dp × xxxhdpi, 안전 영역 안쪽에 마크)
  background.png  적응형 아이콘 뒷면 (432, 테마 바탕 그라데이션)
  legacy.png      옛 안드로이드용 · 미리보기용 통짜 아이콘 (192)
  splash.png      시작 화면 가운데 그림 (768, 투명 바탕, 가운데 원 안에 들어오게)
  meta.json       시작 화면 바탕색
클래식은 기존 app/assets 아이콘을 그대로 씀.
"""
import json
import os
import re
from itertools import combinations

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "assets", "theme-icons")
ASSETS = os.path.join(ROOT, "app", "assets")
# 원본 마크 보관 (처음 실행 때 지금 아이콘에서 잘라 둠 → 기본 아이콘을 다시 만들어도 원본은 그대로)
SOURCE_DIR = os.path.join(OUT, "_source")

# 원본 아이콘에 쓰인 색 → 테마 팔레트의 어느 색으로 바꿀지
SOURCE = {
    "body": (29, 39, 66),      # 남색 몸통
    "window": (255, 250, 240),  # 크림 창
    "red": (224, 69, 58),       # 가운데 막대 · 레버 공 · 가운데 불빛
    "yellow": (247, 181, 0),    # 양쪽 막대 · 양쪽 불빛
    "dark": (14, 20, 36),       # 받침 홈
}


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def read_themes():
    """themes.ts에서 테마별 색을 읽음: const <id>: Palette = { ... };"""
    src = open(os.path.join(ROOT, "app", "src", "themes.ts"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"const (\w+): Palette = \{(.*?)\n\};", src, re.S):
        tid, body = m.group(1), m.group(2)
        val = lambda k: re.search(rf"\b{k}: \"(#[0-9a-fA-F]{{6}})\"", body).group(1)
        grad = re.search(r"bg: \"linear-gradient\(([^\"]+)\)\"", body)
        stops = re.findall(r"#[0-9a-fA-F]{6}", grad.group(1)) if grad else [val("bg")]
        out[tid] = {
            "mode": re.search(r'mode: "(\w+)"', body).group(1),
            "bg": val("bg"), "slot": val("slot"), "slotEdge": val("slotEdge"), "navy": val("navy"),
            "accent": val("accent"), "gold": val("gold"), "slotWindow": val("slotWindow"), "stops": stops,
        }
    return out


def targets(t):
    """밝은 테마: 진한 몸통 + 밝은 창 / 어두운 테마: 밝은 몸통 + 어두운 창 (바탕과 대비)"""
    if t["mode"] == "dark":
        body = hexrgb(t["navy"])
        return {"body": body, "window": hexrgb(t["slotWindow"]), "red": hexrgb(t["accent"]),
                "yellow": hexrgb(t["gold"]), "dark": tuple(int(c * 0.55) for c in body)}
    return {"body": hexrgb(t["slot"]), "window": hexrgb(t["slotWindow"]), "red": hexrgb(t["accent"]),
            "yellow": hexrgb(t["gold"]), "dark": hexrgb(t["slotEdge"])}


def recolor(img, mapping):
    """각 픽셀을 원본 색 두 개의 섞임(경계의 부드러운 부분)으로 보고, 같은 비율로 새 색을 섞음"""
    a = np.asarray(img.convert("RGBA")).astype(float)
    rgb, alpha = a[..., :3], a[..., 3:]
    keys = list(SOURCE)
    src = np.array([SOURCE[k] for k in keys], float)
    dst = np.array([mapping[k] for k in keys], float)
    best_err = np.full(rgb.shape[:2], np.inf)
    out = np.zeros_like(rgb)
    for i, j in combinations(range(len(keys)), 2):
        d = src[j] - src[i]
        tt = np.clip(((rgb - src[i]) @ d) / (d @ d), 0, 1)[..., None]
        err = np.linalg.norm(rgb - (src[i] + tt * d), axis=-1)
        pick = err < best_err
        best_err[pick] = err[pick]
        out[pick] = (dst[i] + tt * (dst[j] - dst[i]))[pick]
    return Image.fromarray(np.concatenate([out, alpha], -1).clip(0, 255).astype(np.uint8), "RGBA")


def sources():
    """원본 마크(색 · 단색 · 어두운 시작 화면용)를 _source 에 한 번 잘라 두고 읽음"""
    os.makedirs(SOURCE_DIR, exist_ok=True)
    pairs = {"mark.png": "splash-icon.png", "mark-dark.png": "splash-icon-dark.png", "mark-mono.png": "android-icon-monochrome.png"}
    for name, orig in pairs.items():
        path = os.path.join(SOURCE_DIR, name)
        if not os.path.exists(path):
            im = Image.open(os.path.join(ASSETS, orig)).convert("RGBA")
            im.crop(im.getbbox()).save(path)
    return {k: Image.open(os.path.join(SOURCE_DIR, k)).convert("RGBA") for k in pairs}


def window_center_x(mark):
    """슬롯머신 몸통의 가운데 = 크림색 창의 가운데 (레버는 빼고 가운데를 잡기 위해)"""
    a = np.asarray(mark).astype(int)
    cream = (np.abs(a[..., :3] - np.array(SOURCE["window"])).sum(-1) < 30) & (a[..., 3] > 200)
    xs = np.where(cream.any(0))[0]
    return (xs[0] + xs[-1]) / 2


def place(mark, size, frac, cx, shape="circle"):
    """몸통 가운데(cx, 세로는 그림 가운데)를 캔버스 가운데에 두고,
    모든 부분이 가운데에서 frac×size 안(circle: 원, square: 정사각형)에 들어오도록 크기를 정함 → 레버가 오른쪽으로 나가도 잘리지 않음"""
    alpha = np.asarray(mark.split()[3]) > 8
    ys, xs = np.nonzero(alpha)
    cy = (ys.min() + ys.max()) / 2
    dx, dy = xs - cx, ys - cy
    reach = np.sqrt(dx ** 2 + dy ** 2).max() if shape == "circle" else np.maximum(np.abs(dx), np.abs(dy)).max()
    k = frac * size / reach
    m = mark.resize((max(1, round(mark.width * k)), max(1, round(mark.height * k))), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(m, (round(size / 2 - cx * k), round(size / 2 - cy * k)))
    return out


# 크기 기준 (가운데에서 끝까지 거리 / 캔버스): 안드로이드 아이콘 안전 영역 원 반지름 0.305 · 시작 화면 원 반지름 0.333 안쪽
FG_FRAC = 0.27       # 적응형 아이콘 앞면 (원 · 둥근 사각형 어느 모양으로 잘려도 안 잘림)
SPLASH_FRAC = 0.25   # 시작 화면
SQUARE_FRAC = 0.33   # 통짜 아이콘(아이폰 · 옛 안드로이드 · 미리보기)


def gradient(size, stops):
    """위→아래로 살짝 기운 그라데이션"""
    cols = np.array([hexrgb(s) for s in stops], dtype=float)
    yy, xx = np.mgrid[0:size, 0:size] / (size - 1)
    t = np.clip(yy * 0.8 + xx * 0.2, 0, 1)
    pos = np.linspace(0, 1, len(cols))
    img = np.stack([np.interp(t, pos, cols[:, c]) for c in range(3)], axis=-1)
    return Image.fromarray(img.astype(np.uint8), "RGB").convert("RGBA")


def classic(src):
    """기본(클래식) 아이콘도 같은 기준으로 다시 배치해 app/assets 에 씀 (app.json이 쓰는 파일)"""
    base, cx = src["mark.png"], window_center_x(src["mark.png"])
    place(base, 1024, FG_FRAC, cx).save(os.path.join(ASSETS, "android-icon-foreground.png"))
    place(src["mark-mono.png"], 1024, FG_FRAC, cx).save(os.path.join(ASSETS, "android-icon-monochrome.png"))
    place(base, 1024, SPLASH_FRAC, cx).save(os.path.join(ASSETS, "splash-icon.png"))
    place(src["mark-dark.png"], 1024, SPLASH_FRAC, cx).save(os.path.join(ASSETS, "splash-icon-dark.png"))
    icon = Image.new("RGBA", (1024, 1024), (242, 230, 206, 255))
    icon.alpha_composite(place(base, 1024, SQUARE_FRAC, cx, "square"))
    icon.convert("RGB").save(os.path.join(ASSETS, "icon.png"))
    icon.resize((48, 48), Image.LANCZOS).save(os.path.join(ASSETS, "favicon.png"))
    print("classic ok")


def main():
    src = sources()
    base = src["mark.png"]
    cx = window_center_x(base)
    classic(src)
    themes = {k: v for k, v in read_themes().items() if not k.startswith("classic")}
    for tid, t in themes.items():
        d = os.path.join(OUT, tid)
        os.makedirs(d, exist_ok=True)
        m = recolor(base, targets(t))
        place(m, 1024, FG_FRAC, cx).resize((432, 432), Image.LANCZOS).save(os.path.join(d, "foreground.png"))
        bg = gradient(1024, t["stops"])
        bg.convert("RGB").resize((432, 432), Image.LANCZOS).save(os.path.join(d, "background.png"))
        legacy = bg.copy()
        legacy.alpha_composite(place(m, 1024, SQUARE_FRAC, cx, "square"))
        mask = Image.new("L", (1024, 1024), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, 1023, 1023], radius=220, fill=255)
        legacy.putalpha(mask)
        legacy.resize((192, 192), Image.LANCZOS).save(os.path.join(d, "legacy.png"))
        # 안드로이드 12+ 시작 화면은 그림을 가운데 원(지름 2/3)으로 자르므로 원 안에 들어오게
        place(m, 1024, SPLASH_FRAC, cx).resize((768, 768), Image.LANCZOS).save(os.path.join(d, "splash.png"))
        json.dump({"splashBg": t["bg"], "mode": t["mode"]}, open(os.path.join(d, "meta.json"), "w"))
        print(tid, "ok")


if __name__ == "__main__":
    main()
