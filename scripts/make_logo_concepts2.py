"""로고 2차 시안 3종: 톱니바퀴 + 3D 주사위 (참고 이미지 기반).
사용법: python scripts/make_logo_concepts2.py  → docs/images/logo-concepts/v2/
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "images", "logo-concepts", "v2")
FONT = r"C:\Windows\Fonts\NotoSansKR-VF.ttf"
S = 2048


def F(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([w])
    except Exception:  # noqa: BLE001
        pass
    return f


def gear_pts(cx, cy, ro, ri, teeth, rot=0.0, tooth=0.42):
    pts, step = [], 2 * math.pi / teeth
    for i in range(teeth):
        a = rot + i * step
        for da, r in ((-0.5 * tooth - 0.10, ri), (-0.5 * tooth, ro), (0.5 * tooth, ro), (0.5 * tooth + 0.10, ri)):
            ang = a + da * step
            pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(size, top, bottom):
    g = Image.new("RGB", (1, size[1]))
    for y in range(size[1]):
        g.putpixel((0, y), lerp(top, bottom, y / max(1, size[1] - 1)))
    return g.resize(size)


def shadow(mask, offset, blur, opacity=150):
    sh = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    m = mask.point(lambda v: int(v * opacity / 255))
    sh.putalpha(m)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    out.alpha_composite(sh, offset)
    return out


def gear_layer(cx, cy, ro, ri, fill_top, fill_bottom, hole_r, hole_color, rim=None):
    """그라데이션 톱니바퀴 (RGBA)"""
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    pts = gear_pts(cx, cy, ro, ri, 10)
    md.polygon(pts, fill=255)
    md.line(pts + [pts[0], pts[1]], fill=255, width=40, joint="curve")  # 모서리를 둥글게
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    body = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    body.paste(vgrad((S, S), fill_top, fill_bottom), (0, 0), mask)
    d = ImageDraw.Draw(body)
    if rim:
        d.ellipse([cx - hole_r - 70, cy - hole_r - 70, cx + hole_r + 70, cy + hole_r + 70], fill=rim)
    d.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r], fill=hole_color)
    return body, mask


def die_face(size, base, edge, pips, pip_color, special=None):
    T = size
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, T - 1, T - 1], radius=int(T * 0.14), fill=base)
    r = T * 0.085
    for i, (fx, fy) in enumerate(pips):
        col = special if (special and i == 0) else pip_color
        d.ellipse([T * fx - r, T * fy - r, T * fx + r, T * fy + r], fill=col)
    return im


def paste_face(canvas, tex, p0, p1, p3):
    T = tex.width
    ax, ay = (p1[0] - p0[0]) / T, (p1[1] - p0[1]) / T
    bx, by = (p3[0] - p0[0]) / T, (p3[1] - p0[1]) / T
    det = ax * by - ay * bx
    ia, ib, ic, id_ = by / det, -bx / det, -ay / det, ax / det
    coeffs = (ia, ib, -(ia * p0[0] + ib * p0[1]), ic, id_, -(ic * p0[0] + id_ * p0[1]))
    canvas.alpha_composite(tex.transform(canvas.size, Image.AFFINE, coeffs, resample=Image.BICUBIC))


PIPS = {
    1: [(0.5, 0.5)],
    2: [(0.3, 0.3), (0.7, 0.7)],
    3: [(0.27, 0.27), (0.5, 0.5), (0.73, 0.73)],
    5: [(0.5, 0.5), (0.27, 0.27), (0.73, 0.27), (0.27, 0.73), (0.73, 0.73)],
}


def die(cx, cy, e, colors, pip_color, top_pips=2, special=None, edge=(0, 0, 0, 0)):
    """둥근 3D 주사위 (RGBA). colors = (윗면, 왼면, 오른면)"""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    k = math.cos(math.pi / 6)
    top, right, left = (cx, cy - e), (cx + e * k, cy - e / 2), (cx - e * k, cy - e / 2)
    mid, bl, br, bot = (cx, cy), (cx - e * k, cy + e / 2), (cx + e * k, cy + e / 2), (cx, cy + e)
    T = 700
    # 면 사이 틈을 메우는 바탕 실루엣
    sil = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sil)
    shrink = 0.9
    hexa = [(cx + (x - cx) * shrink, cy + (y - cy) * shrink) for x, y in (top, right, br, bot, bl, left)]
    sd.polygon(hexa, fill=colors[2])
    sd.line(hexa + [hexa[0], hexa[1]], fill=colors[2], width=int(e * 0.18), joint="curve")
    layer.alpha_composite(sil)
    paste_face(layer, die_face(T, colors[1], edge, PIPS[3], pip_color), left, mid, bl)
    paste_face(layer, die_face(T, colors[2], edge, PIPS[5], pip_color), mid, right, bot)
    paste_face(layer, die_face(T, colors[0], edge, PIPS[top_pips], pip_color, special), left, top, mid)
    return layer


def rays(d, cx, cy, color, n=5, r0=520, r1=640, width=46, spread=70):
    for i in range(n):
        a = math.radians(-90 + (i - (n - 1) / 2) * (spread / max(1, n - 1)) * 2 / 1.0 / 2)
        x0, y0 = cx + r0 * math.cos(a), cy + r0 * math.sin(a)
        x1, y1 = cx + r1 * math.cos(a), cy + r1 * math.sin(a)
        d.line([x0, y0, x1, y1], fill=color, width=width)
        for x, y in ((x0, y0), (x1, y1)):
            d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=color)


def blueprint_bg(c1, c2, grid, ring):
    im = vgrad((S, S), c1, c2).convert("RGBA")
    d = ImageDraw.Draw(im)
    for i in range(0, S, 64):
        d.line([i, 0, i, S], fill=grid, width=3)
        d.line([0, i, S, i], fill=grid, width=3)
    for i in range(0, S, 256):
        d.line([i, 0, i, S], fill=ring, width=4)
        d.line([0, i, S, i], fill=ring, width=4)
    c = S / 2
    for r in (980, 720):
        d.ellipse([c - r, c - r, c + r, c + r], outline=ring, width=6)
    d.line([0, c, S, c], fill=ring, width=6)
    d.line([c, 0, c, S], fill=ring, width=6)
    return im


def compose(bg, gear_args, die_args, ray_color, gear_shadow=True):
    c = S / 2
    gl, gm = gear_layer(c, c + 30, **gear_args)
    if gear_shadow:
        bg.alpha_composite(shadow(gm, (0, 40), 40, 170))
    bg.alpha_composite(gl)
    dl = die(c, c + 70, **die_args)
    bg.alpha_composite(shadow(dl.split()[3], (24, 44), 26, 160))
    bg.alpha_composite(dl)
    d = ImageDraw.Draw(bg)
    if ray_color:
        e = die_args["e"]
        rays(d, c, c + 70, ray_color, n=3, r0=e + 95, r1=e + 185, width=46, spread=70)
    return bg.resize((1024, 1024), Image.LANCZOS)


def v1():  # 블루프린트
    bg = blueprint_bg((24, 60, 120), (14, 36, 82), (40, 82, 150, 255), (70, 120, 190, 255))
    return compose(
        bg,
        dict(ro=860, ri=720, fill_top=(250, 252, 255), fill_bottom=(196, 206, 222), hole_r=560, hole_color=(15, 30, 66, 255), rim=(160, 172, 194, 255)),
        dict(e=420, colors=((255, 255, 255, 255), (232, 236, 244, 255), (205, 212, 226, 255)), pip_color=(20, 26, 40, 255), top_pips=2),
        (255, 196, 40),
    )


def v2():  # 뽑공 컬러
    bg = blueprint_bg((32, 44, 76), (20, 27, 48), (44, 58, 96, 255), (64, 80, 124, 255))
    return compose(
        bg,
        dict(ro=860, ri=720, fill_top=(255, 250, 238), fill_bottom=(236, 222, 196), hole_r=560, hole_color=(224, 69, 58, 255), rim=(176, 45, 38, 255)),
        dict(e=420, colors=((255, 253, 247, 255), (246, 238, 222, 255), (230, 216, 190, 255)), pip_color=(29, 39, 66, 255), top_pips=1, special=(224, 69, 58, 255)),
        (247, 181, 0),
    )


def v3():  # 다크 골드
    bg = vgrad((S, S), (34, 36, 44), (12, 13, 18)).convert("RGBA")
    d = ImageDraw.Draw(bg)
    c = S / 2
    for r, a in ((980, 40), (720, 55)):
        d.ellipse([c - r, c - r, c + r, c + r], outline=(255, 200, 80, a), width=5)
    return compose(
        bg,
        dict(ro=860, ri=720, fill_top=(255, 214, 102), fill_bottom=(196, 132, 24), hole_r=560, hole_color=(20, 21, 28, 255), rim=(150, 98, 18, 255)),
        dict(e=420, colors=((255, 255, 255, 255), (236, 236, 240, 255), (208, 210, 218, 255)), pip_color=(20, 21, 28, 255), top_pips=2),
        (255, 220, 120),
    )


def rounded(im, r=0.22):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=int(im.width * r), fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    items = [("1", "블루프린트", "참고 이미지 느낌 · 설계도 격자", v1()),
             ("2", "뽑공 컬러", "앱 색(남색·크림·빨강)에 맞춤", v2()),
             ("3", "다크 골드", "금색 톱니 · 고급스러운 느낌", v3())]
    tile, pad = 560, 70
    sh = Image.new("RGB", (pad + len(items) * (tile + pad), pad + tile + 190), (246, 242, 234))
    d = ImageDraw.Draw(sh)
    for i, (k, name, desc, im) in enumerate(items):
        r = rounded(im)
        r.save(os.path.join(OUT, f"{k}-{name}.png"))
        x = pad + i * (tile + pad)
        t = r.resize((tile, tile), Image.LANCZOS)
        sh.paste(t, (x, pad), t)
        d.text((x + tile / 2, pad + tile + 60), f"{k}. {name}", font=F(42, 800), fill=(17, 22, 38), anchor="mm")
        d.text((x + tile / 2, pad + tile + 118), desc, font=F(27, 500), fill=(100, 106, 120), anchor="mm")
    sh.save(os.path.join(OUT, "2차-시안-모음.png"))
    print("saved")


if __name__ == "__main__":
    main()
