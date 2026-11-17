"""프로필 캐릭터 그림 만들기 — 200×200 SVG를 만들어 앱 모듈(app/src/components/avatar-art.ts)로 씀.

사용법: python scripts/make_avatars.py [미리보기.html]
공통 스타일: 머리가 큰 귀여운 비율 · 왼쪽 위에서 오는 부드러운 입체 음영 · 하이라이트 2개 큰 눈 · 볼터치 ·
같은 색 계열의 진한 외곽선. 모든 캐릭터는 동그라미를 비슷하게 꽉 채우고 가운데에 옴.
유료(av-*)는 배경 연출 · 빛 · 반짝이를 더 넣음.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "src", "components", "avatar-art.ts")

INK = "#2b1d3a"


def grad_defs():
    """모든 그림이 같이 쓰는 그라데이션 (눈 · 볼)"""
    return (
        '<linearGradient id="eye" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#1c1330"/><stop offset="0.65" stop-color="#2e2152"/><stop offset="1" stop-color="#5a4a9a"/></linearGradient>'
    )


def rg(id_, stops, cx=0.38, cy=0.32, r=0.75):
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>'


def lg(id_, stops, x1=0, y1=0, x2=0, y2=1):
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def eye(x, y, s=1.0):
    """반짝이는 큰 눈: 진한 눈동자 + 큰 하이라이트 + 작은 하이라이트"""
    return (
        f'<ellipse cx="{x}" cy="{y}" rx="{8.6*s:.1f}" ry="{10.4*s:.1f}" fill="url(#eye)"/>'
        f'<ellipse cx="{x-2.8*s:.1f}" cy="{y-4.2*s:.1f}" rx="{3.5*s:.1f}" ry="{4.1*s:.1f}" fill="#fff"/>'
        f'<circle cx="{x+3.2*s:.1f}" cy="{y+4.4*s:.1f}" r="{1.7*s:.1f}" fill="#fff" opacity="0.9"/>'
    )


def eyes(cx, y, gap, s=1.0):
    return eye(cx - gap, y, s) + eye(cx + gap, y, s)


def blush(cx, y, gap, rx=8, ry=4.6, color="#ff8aa6", op=0.55):
    return (f'<ellipse cx="{cx-gap}" cy="{y}" rx="{rx}" ry="{ry}" fill="{color}" opacity="{op}"/>'
            f'<ellipse cx="{cx+gap}" cy="{y}" rx="{rx}" ry="{ry}" fill="{color}" opacity="{op}"/>')


def smile(cx, y, w=7, color=INK):
    return f'<path d="M{cx-w} {y} Q{cx-w/2} {y+5} {cx} {y} Q{cx+w/2} {y+5} {cx+w} {y}" stroke="{color}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'


def sparkle(x, y, r, color="#fff", op=1.0):
    return (f'<path d="M{x} {y-r} Q{x+r*0.16} {y-r*0.16} {x+r} {y} Q{x+r*0.16} {y+r*0.16} {x} {y+r} '
            f'Q{x-r*0.16} {y+r*0.16} {x-r} {y} Q{x-r*0.16} {y-r*0.16} {x} {y-r}Z" fill="{color}" opacity="{op}"/>')


def svg(defs, body):
    return f'<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs>{grad_defs()}{defs}</defs>{body}</svg>'


def bg(id_, inner, outer):
    return rg(id_, [(0, inner), (1, outer)], cx=0.5, cy=0.42, r=0.7), f'<rect width="200" height="200" fill="url(#{id_})"/>'


A = {}

# ───────────────────────── 무료 ─────────────────────────
# 슬롯봇: 앱 로고 슬롯머신에 얼굴
d, b = bg("bg", "#fff6dc", "#ffdf9c")
A["slotbot"] = svg(
    d + lg("body", [(0, "#3a4a7c"), (1, "#1d2742")]) + lg("win", [(0, "#ffffff"), (1, "#f1e8d6")]) + rg("ball", [(0, "#ff8d80"), (1, "#d6372b")]),
    b + '<ellipse cx="100" cy="182" rx="56" ry="9" fill="#c99a3a" opacity="0.35"/>'
    '<path d="M150 112 L166 84" stroke="#1d2742" stroke-width="9" stroke-linecap="round"/>'
    '<circle cx="168" cy="78" r="13" fill="url(#ball)" stroke="#a92a20" stroke-width="2.5"/><circle cx="163" cy="73" r="4" fill="#fff" opacity="0.8"/>'
    '<rect x="38" y="40" width="114" height="136" rx="30" fill="url(#body)" stroke="#121935" stroke-width="3"/>'
    '<rect x="44" y="44" width="40" height="8" rx="4" fill="#fff" opacity="0.18"/>'
    '<circle cx="74" cy="58" r="6" fill="#f7b500"/><circle cx="95" cy="58" r="6" fill="#e0453a"/><circle cx="116" cy="58" r="6" fill="#f7b500"/>'
    '<rect x="52" y="72" width="86" height="70" rx="20" fill="url(#win)" stroke="#121935" stroke-width="2.5"/>'
    + eyes(95, 102, 18, 1.15) + blush(95, 120, 30) + smile(95, 120, 7) +
    '<rect x="74" y="154" width="42" height="9" rx="4.5" fill="#0d1328"/>'
    + sparkle(30, 46, 9, "#f7b500") + sparkle(178, 140, 6, "#fff")
)

# 톱니: 해님 같은 톱니바퀴
d, b = bg("bg", "#eef7ff", "#bfe0ff")
teeth = "".join(f'<rect x="88" y="22" width="24" height="30" rx="7" fill="url(#gear)" stroke="#c98a00" stroke-width="2.5" transform="rotate({k*45} 100 104)"/>' for k in range(8))
A["gear"] = svg(
    d + rg("gear", [(0, "#ffe27a"), (0.6, "#f7b500"), (1, "#d99400")]) + rg("face", [(0, "#fff3b8"), (1, "#ffd24d")]),
    b + '<ellipse cx="100" cy="186" rx="50" ry="8" fill="#5b8cc0" opacity="0.3"/>' + teeth +
    '<circle cx="100" cy="104" r="60" fill="url(#gear)" stroke="#c98a00" stroke-width="3"/>'
    '<circle cx="100" cy="104" r="46" fill="url(#face)"/>'
    '<path d="M64 84 Q78 62 104 60" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.6"/>'
    + eyes(100, 100, 17, 1.05) + blush(100, 118, 28) + smile(100, 118, 7)
)

# 공부 고양이: 동그란 안경을 쓴 치즈냥
d, b = bg("bg", "#effbf2", "#bfe9cb")
A["cat"] = svg(
    d + rg("fur", [(0, "#ffc58a"), (0.7, "#f39a47"), (1, "#d9772a")]) + rg("muz", [(0, "#ffffff"), (1, "#ffeedd")]),
    b + '<ellipse cx="100" cy="186" rx="54" ry="8" fill="#4a9a63" opacity="0.3"/>'
    '<path d="M42 92 Q36 40 54 30 Q74 44 84 64 Z" fill="url(#fur)" stroke="#b8621f" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M158 92 Q164 40 146 30 Q126 44 116 64 Z" fill="url(#fur)" stroke="#b8621f" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M52 76 Q50 50 57 42 Q68 52 72 64 Z" fill="#ffc2c9"/><path d="M148 76 Q150 50 143 42 Q132 52 128 64 Z" fill="#ffc2c9"/>'
    '<ellipse cx="100" cy="112" rx="66" ry="58" fill="url(#fur)" stroke="#b8621f" stroke-width="3"/>'
    '<path d="M100 56 L100 72 M84 58 L88 72 M116 58 L112 72" stroke="#d9772a" stroke-width="5" stroke-linecap="round"/>'
    '<ellipse cx="100" cy="136" rx="30" ry="21" fill="url(#muz)"/>'
    + eyes(100, 108, 25, 1.05) +
    '<circle cx="75" cy="108" r="19" fill="#ffffff" fill-opacity="0.18" stroke="#3b2a1e" stroke-width="3.5"/>'
    '<circle cx="125" cy="108" r="19" fill="#ffffff" fill-opacity="0.18" stroke="#3b2a1e" stroke-width="3.5"/>'
    '<path d="M94 108 L106 108" stroke="#3b2a1e" stroke-width="3.5"/>'
    '<path d="M95 128 L105 128 L100 134 Z" fill="#ff7a92"/>' + smile(100, 136, 6) + blush(100, 130, 42) +
    '<path d="M34 128 L58 132 M34 140 L58 138 M166 128 L142 132 M166 140 L142 138" stroke="#b8621f" stroke-width="2.4" stroke-linecap="round"/>'
)

# 부엉이 박사: 학사모 쓴 부엉이
d, b = bg("bg", "#f4f0ff", "#d4c8ff")
A["owl"] = svg(
    d + rg("feat", [(0, "#c89366"), (0.7, "#9a6638"), (1, "#7a4c26")]) + rg("belly", [(0, "#fff8ec"), (1, "#f0dcc0")]) + lg("cap", [(0, "#3a4a7c"), (1, "#141c36")]),
    b + '<ellipse cx="100" cy="188" rx="50" ry="8" fill="#6a5ac0" opacity="0.3"/>'
    '<ellipse cx="100" cy="122" rx="64" ry="66" fill="url(#feat)" stroke="#5e3a1c" stroke-width="3"/>'
    '<ellipse cx="100" cy="146" rx="38" ry="38" fill="url(#belly)"/>'
    '<path d="M80 142 Q90 150 100 142 Q110 150 120 142 M84 158 Q92 165 100 158 Q108 165 116 158" stroke="#d9b98a" stroke-width="3" fill="none" stroke-linecap="round"/>'
    '<circle cx="76" cy="112" r="24" fill="#fffaf0" stroke="#5e3a1c" stroke-width="3"/><circle cx="124" cy="112" r="24" fill="#fffaf0" stroke="#5e3a1c" stroke-width="3"/>'
    + eye(76, 112, 1.2) + eye(124, 112, 1.2) +
    '<path d="M92 128 L108 128 L100 142 Z" fill="#f7b500" stroke="#c98a00" stroke-width="2" stroke-linejoin="round"/>'
    + blush(100, 136, 44, 7, 4) +
    '<path d="M36 52 L100 26 L164 52 L100 78 Z" fill="url(#cap)" stroke="#0b1022" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M70 62 L70 80 Q100 92 130 80 L130 62" fill="#1d2742" stroke="#0b1022" stroke-width="2.5"/>'
    '<path d="M100 52 L150 62 L150 92" stroke="#f7b500" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
    '<path d="M144 92 L156 92 L152 106 L148 106 Z" fill="#f7b500"/>'
)

# 여우
d, b = bg("bg", "#fff1e6", "#ffcdb0")
A["fox"] = svg(
    d + rg("fur", [(0, "#ffa65c"), (0.7, "#f2762a"), (1, "#d2581a")]) + rg("wh", [(0, "#ffffff"), (1, "#fff0e0")]),
    b + '<ellipse cx="100" cy="186" rx="52" ry="8" fill="#c7703a" opacity="0.3"/>'
    '<path d="M34 98 Q30 34 50 22 Q76 44 86 70 Z" fill="url(#fur)" stroke="#b2481a" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M166 98 Q170 34 150 22 Q124 44 114 70 Z" fill="url(#fur)" stroke="#b2481a" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M46 80 Q46 46 54 38 Q66 52 72 66 Z" fill="#3b2a3a"/><path d="M154 80 Q154 46 146 38 Q134 52 128 66 Z" fill="#3b2a3a"/>'
    '<path d="M28 100 Q100 40 172 100 Q168 152 100 178 Q32 152 28 100 Z" fill="url(#fur)" stroke="#b2481a" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M30 104 Q62 118 100 178 Q46 160 30 104 Z" fill="url(#wh)"/><path d="M170 104 Q138 118 100 178 Q154 160 170 104 Z" fill="url(#wh)"/>'
    + eyes(100, 112, 26, 1.05) + blush(100, 132, 40) +
    '<ellipse cx="100" cy="150" rx="8" ry="6" fill="#2b1d3a"/><ellipse cx="97" cy="148" rx="2.5" ry="1.6" fill="#fff" opacity="0.7"/>'
    + smile(100, 158, 6)
)

# 펭귄: 빨간 목도리
d, b = bg("bg", "#eef8ff", "#bfe2ff")
A["penguin"] = svg(
    d + rg("blk", [(0, "#46557e"), (1, "#141b33")]) + rg("wht", [(0, "#ffffff"), (1, "#e6eef8")]) + lg("scarf", [(0, "#ff6b5e"), (1, "#c9332a")]),
    b + '<ellipse cx="100" cy="188" rx="50" ry="8" fill="#3d6fa8" opacity="0.3"/>'
    '<ellipse cx="44" cy="140" rx="13" ry="30" fill="url(#blk)" transform="rotate(18 44 140)"/><ellipse cx="156" cy="140" rx="13" ry="30" fill="url(#blk)" transform="rotate(-18 156 140)"/>'
    '<ellipse cx="100" cy="112" rx="64" ry="72" fill="url(#blk)" stroke="#0b1022" stroke-width="3"/>'
    '<path d="M100 76 Q66 60 56 92 Q50 128 70 150 Q100 170 130 150 Q150 128 144 92 Q134 60 100 76Z" fill="url(#wht)"/>'
    + eyes(100, 102, 22, 1.05) +
    '<ellipse cx="100" cy="120" rx="11" ry="7" fill="#f7b500" stroke="#c98a00" stroke-width="2"/>'
    + blush(100, 120, 34) +
    '<path d="M44 150 Q100 172 156 150 L156 164 Q100 186 44 164 Z" fill="url(#scarf)" stroke="#a52a22" stroke-width="2.5"/>'
    '<path d="M124 162 L130 196 L146 192 L140 160 Z" fill="url(#scarf)" stroke="#a52a22" stroke-width="2.5"/>'
)

# 로봇
d, b = bg("bg", "#eafcf7", "#b7ecdf")
A["robot"] = svg(
    d + lg("metal", [(0, "#f4f6fb"), (0.6, "#cfd5e2"), (1, "#a3abbe")]) + lg("scr", [(0, "#2a3866"), (1, "#121a38")]) + rg("led", [(0, "#d4fff5"), (0.5, "#5ee8cc"), (1, "#22b39a")]),
    b + '<ellipse cx="100" cy="188" rx="50" ry="8" fill="#3a9a85" opacity="0.3"/>'
    '<path d="M100 40 L100 22" stroke="#8d95a8" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="18" r="9" fill="#ff5a4a" stroke="#c23a2c" stroke-width="2"/><circle cx="97" cy="15" r="3" fill="#fff" opacity="0.8"/>'
    '<rect x="22" y="86" width="18" height="38" rx="8" fill="url(#metal)" stroke="#7d869b" stroke-width="2.5"/><rect x="160" y="86" width="18" height="38" rx="8" fill="url(#metal)" stroke="#7d869b" stroke-width="2.5"/>'
    '<rect x="34" y="40" width="132" height="116" rx="38" fill="url(#metal)" stroke="#7d869b" stroke-width="3"/>'
    '<rect x="50" y="58" width="100" height="78" rx="26" fill="url(#scr)"/>'
    '<ellipse cx="80" cy="94" rx="12" ry="14" fill="url(#led)"/><ellipse cx="120" cy="94" rx="12" ry="14" fill="url(#led)"/>'
    '<ellipse cx="76" cy="89" rx="4" ry="5" fill="#fff" opacity="0.85"/><ellipse cx="116" cy="89" rx="4" ry="5" fill="#fff" opacity="0.85"/>'
    '<path d="M86 118 Q100 128 114 118" stroke="#5ee8cc" stroke-width="4" fill="none" stroke-linecap="round"/>'
    + blush(100, 116, 38, 7, 4, "#ff8aa6", 0.6) +
    '<path d="M44 52 Q60 44 82 44" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.7"/>'
    '<rect x="72" y="158" width="56" height="26" rx="10" fill="url(#metal)" stroke="#7d869b" stroke-width="2.5"/><circle cx="100" cy="171" r="6" fill="#f7b500"/>'
)

# 헤드폰 곰
d, b = bg("bg", "#fff6e8", "#ffdcae")
A["bear"] = svg(
    d + rg("fur", [(0, "#c98d5a"), (0.7, "#a2683a"), (1, "#7f4e28")]) + rg("muz", [(0, "#fbe6cc"), (1, "#e8c49c")]) + lg("phone", [(0, "#ff6b5e"), (1, "#c9332a")]),
    b + '<ellipse cx="100" cy="188" rx="52" ry="8" fill="#b07a3a" opacity="0.3"/>'
    '<circle cx="52" cy="58" r="22" fill="url(#fur)" stroke="#5e3a1c" stroke-width="3"/><circle cx="148" cy="58" r="22" fill="url(#fur)" stroke="#5e3a1c" stroke-width="3"/>'
    '<circle cx="52" cy="58" r="11" fill="#e8b98a"/><circle cx="148" cy="58" r="11" fill="#e8b98a"/>'
    '<circle cx="100" cy="114" r="64" fill="url(#fur)" stroke="#5e3a1c" stroke-width="3"/>'
    '<ellipse cx="100" cy="136" rx="28" ry="21" fill="url(#muz)"/>'
    + eyes(100, 106, 24, 1.05) +
    '<ellipse cx="100" cy="126" rx="10" ry="7" fill="#2b1d3a"/><ellipse cx="97" cy="124" rx="3" ry="1.8" fill="#fff" opacity="0.7"/>'
    + smile(100, 138, 6) + blush(100, 128, 40) +
    '<path d="M30 112 Q30 44 100 42 Q170 44 170 112" stroke="url(#phone)" stroke-width="11" fill="none" stroke-linecap="round"/>'
    '<rect x="16" y="96" width="28" height="44" rx="12" fill="url(#phone)" stroke="#a52a22" stroke-width="2.5"/><rect x="156" y="96" width="28" height="44" rx="12" fill="url(#phone)" stroke="#a52a22" stroke-width="2.5"/>'
    '<rect x="21" y="102" width="8" height="18" rx="4" fill="#fff" opacity="0.35"/><rect x="161" y="102" width="8" height="18" rx="4" fill="#fff" opacity="0.35"/>'
)

# 개구리: 연잎 위의 초록 개구리
d, b = bg("bg", "#fff2f6", "#ffc9db")
A["frog"] = svg(
    d + rg("skin", [(0, "#c9f59a"), (0.6, "#7fd14f"), (1, "#4fa52c")], cx=0.36, cy=0.28, r=0.8)
    + rg("belly", [(0, "#fbffe6"), (1, "#e3f5b8")]) + rg("pad", [(0, "#8fe07a"), (1, "#3f9a4a")], cx=0.4, cy=0.3, r=0.8),
    b + '<ellipse cx="100" cy="176" rx="84" ry="22" fill="url(#pad)" stroke="#2f7a3a" stroke-width="3"/>'
    '<path d="M100 176 L150 160 L160 178 Z" fill="#ffc9db"/>'
    '<path d="M70 172 Q60 166 52 170 M130 182 Q144 184 150 178" stroke="#2f7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    '<g transform="translate(160 150)"><ellipse cx="0" cy="-7" rx="5" ry="8" fill="#ff8fb5"/><ellipse cx="-7" cy="0" rx="8" ry="5" fill="#ff8fb5"/><ellipse cx="7" cy="0" rx="8" ry="5" fill="#ff8fb5"/><circle r="4" fill="#ffe08a"/></g>'
    # 뒷다리
    '<ellipse cx="40" cy="156" rx="20" ry="13" fill="url(#skin)" stroke="#3a8a24" stroke-width="3"/><ellipse cx="160" cy="156" rx="20" ry="13" fill="url(#skin)" stroke="#3a8a24" stroke-width="3"/>'
    # 눈 언덕
    '<circle cx="64" cy="72" r="28" fill="url(#skin)" stroke="#3a8a24" stroke-width="3"/><circle cx="136" cy="72" r="28" fill="url(#skin)" stroke="#3a8a24" stroke-width="3"/>'
    # 몸
    '<ellipse cx="100" cy="120" rx="76" ry="52" fill="url(#skin)" stroke="#3a8a24" stroke-width="3"/>'
    '<circle cx="64" cy="72" r="24" fill="url(#skin)"/><circle cx="136" cy="72" r="24" fill="url(#skin)"/>'
    '<circle cx="64" cy="72" r="18" fill="#fff"/><circle cx="136" cy="72" r="18" fill="#fff"/>'
    + eye(64, 74, 1.15) + eye(136, 74, 1.15) +
    '<ellipse cx="100" cy="148" rx="46" ry="22" fill="url(#belly)"/>'
    '<path d="M50 44 Q58 36 70 38" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.6"/>'
    '<circle cx="92" cy="104" r="2.6" fill="#3a8a24"/><circle cx="108" cy="104" r="2.6" fill="#3a8a24"/>'
    '<path d="M62 118 Q100 146 138 118" stroke="#2b1d3a" stroke-width="3" fill="none" stroke-linecap="round"/>'
    '<path d="M92 126 Q100 140 108 126 Q100 130 92 126 Z" fill="#ff7a92"/>'
    + blush(100, 116, 54, 9, 5.5) +
    # 앞발
    '<path d="M66 166 Q62 152 72 146 Q82 150 80 166 Z M134 166 Q138 152 128 146 Q118 150 120 166 Z" fill="url(#skin)" stroke="#3a8a24" stroke-width="2.5" stroke-linejoin="round"/>'
    + sparkle(28, 40, 8, "#fff") + sparkle(176, 108, 6, "#fff")
)

# ───────────────────────── 유료 (배경 연출 · 빛 · 반짝이) ─────────────────────────
# 우주 고양이
A["av-astro"] = svg(
    rg("space", [(0, "#6a4fd6"), (0.55, "#2c1a6b"), (1, "#110a30")], cx=0.5, cy=0.38, r=0.75)
    + rg("neb", [(0, "#ff7ac0"), (1, "#ff7ac0")]) + rg("planet", [(0, "#ffd9a8"), (0.6, "#ff8a7a"), (1, "#a84a9a")])
    + lg("suit", [(0, "#ffffff"), (1, "#c8d0e6")]) + rg("glass", [(0, "#3a3f8f"), (1, "#121433")], cx=0.4, cy=0.35, r=0.8)
    + rg("fur", [(0, "#ffc58a"), (0.7, "#f39a47"), (1, "#d9772a")]) + rg("halo", [(0, "#9aa8ff"), (1, "#9aa8ff")]),
    '<rect width="200" height="200" fill="url(#space)"/>'
    '<ellipse cx="150" cy="60" rx="60" ry="40" fill="#ff7ac0" opacity="0.18"/><ellipse cx="44" cy="150" rx="50" ry="36" fill="#7ac8ff" opacity="0.14"/>'
    + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity="{o}"/>' for x, y, r, o in
              [(24, 30, 1.6, .9), (60, 18, 1.1, .7), (176, 30, 1.4, .9), (186, 96, 1.2, .7), (16, 96, 1, .6), (34, 64, 1.2, .8), (170, 150, 1.3, .8), (140, 22, 1, .6)])
    + '<circle cx="34" cy="168" r="20" fill="url(#planet)"/><ellipse cx="34" cy="170" rx="34" ry="7" fill="none" stroke="#ffe0c0" stroke-width="3" opacity="0.85" transform="rotate(-16 34 170)"/>'
    + sparkle(172, 54, 9, "#ffe08a") + sparkle(26, 44, 6, "#fff")
    + '<path d="M40 200 Q42 154 100 150 Q158 154 160 200 Z" fill="url(#suit)" stroke="#9aa3c2" stroke-width="3"/>'
    '<rect x="84" y="166" width="32" height="20" rx="5" fill="#e3e8f4" stroke="#9aa3c2" stroke-width="2"/><circle cx="94" cy="176" r="4" fill="#ff5a6a"/><circle cx="106" cy="176" r="4" fill="#4ad69a"/>'
    '<path d="M146 52 L160 30" stroke="#c9cfdc" stroke-width="5" stroke-linecap="round"/><circle cx="162" cy="26" r="8" fill="#ffd65c"/><circle cx="162" cy="26" r="14" fill="#ffd65c" opacity="0.25"/>'
    '<circle cx="100" cy="96" r="70" fill="url(#suit)" stroke="#9aa3c2" stroke-width="3"/>'
    '<circle cx="100" cy="100" r="56" fill="url(#glass)"/>'
    # 헬멧 속 고양이
    '<path d="M58 96 Q54 58 68 50 Q84 62 90 78 Z" fill="url(#fur)" stroke="#b8621f" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M142 96 Q146 58 132 50 Q116 62 110 78 Z" fill="url(#fur)" stroke="#b8621f" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M66 86 Q64 66 70 60 Q78 68 82 78 Z" fill="#ffc2c9"/><path d="M134 86 Q136 66 130 60 Q122 68 118 78 Z" fill="#ffc2c9"/>'
    '<ellipse cx="100" cy="112" rx="46" ry="38" fill="url(#fur)" stroke="#b8621f" stroke-width="2.5"/>'
    '<path d="M100 76 L100 88 M88 78 L91 88 M112 78 L109 88" stroke="#d9772a" stroke-width="4" stroke-linecap="round"/>'
    '<ellipse cx="100" cy="130" rx="20" ry="13" fill="#fff4e6"/>'
    + eyes(100, 108, 18, 0.95) +
    '<path d="M96 124 L104 124 L100 129 Z" fill="#ff7a92"/>' + smile(100, 130, 5) + blush(100, 124, 30, 6, 3.6)
    + '<path d="M56 78 Q70 50 104 46" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/>'
    '<circle cx="140" cy="132" r="5" fill="#fff" opacity="0.35"/>'
)

# 아기 용
A["av-dragon"] = svg(
    rg("bgd", [(0, "#fff4e2"), (0.6, "#ffd2b0"), (1, "#ff9e86")], cx=0.5, cy=0.4, r=0.75)
    + rg("skin", [(0, "#d6fbeb"), (0.55, "#6fdcb4"), (1, "#2fa985")]) + rg("belly", [(0, "#fffbe6"), (1, "#ffe3a0")])
    + lg("wing", [(0, "#d7b8ff"), (1, "#8a5ce8")], 0, 0, 1, 1) + lg("horn", [(0, "#fff6d6"), (1, "#f2c45a")]),
    '<rect width="200" height="200" fill="url(#bgd)"/>'
    '<circle cx="100" cy="100" r="80" fill="#fff" opacity="0.25"/>'
    + sparkle(30, 40, 9, "#ffb347") + sparkle(172, 50, 7, "#ff8fb1") + sparkle(176, 160, 6, "#fff")
    + '<path d="M58 112 Q12 70 14 128 Q28 118 34 134 Q44 120 52 132 Q56 122 66 126 Z" fill="url(#wing)" stroke="#6a40c8" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M142 112 Q188 70 186 128 Q172 118 166 134 Q156 120 148 132 Q144 122 134 126 Z" fill="url(#wing)" stroke="#6a40c8" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M54 200 Q56 150 100 146 Q144 150 146 200 Z" fill="url(#skin)" stroke="#23866a" stroke-width="3"/>'
    '<ellipse cx="100" cy="186" rx="26" ry="26" fill="url(#belly)"/><path d="M80 176 H120 M78 188 H122" stroke="#ecc56a" stroke-width="3" stroke-linecap="round"/>'
    '<path d="M70 50 Q60 18 78 26 Q84 36 84 48 Z" fill="url(#horn)" stroke="#c99a2a" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M130 50 Q140 18 122 26 Q116 36 116 48 Z" fill="url(#horn)" stroke="#c99a2a" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M90 40 L100 24 L110 40 Z" fill="#ff8a8a" stroke="#d9605e" stroke-width="2" stroke-linejoin="round"/>'
    '<ellipse cx="100" cy="98" rx="62" ry="56" fill="url(#skin)" stroke="#23866a" stroke-width="3"/>'
    '<path d="M44 92 Q36 74 46 66 Q52 80 58 84 Z" fill="#b48cff" stroke="#6a40c8" stroke-width="2"/><path d="M156 92 Q164 74 154 66 Q148 80 142 84 Z" fill="#b48cff" stroke="#6a40c8" stroke-width="2"/>'
    '<ellipse cx="80" cy="66" rx="18" ry="9" fill="#fff" opacity="0.4" transform="rotate(-20 80 66)"/>'
    '<ellipse cx="100" cy="124" rx="34" ry="22" fill="#e8fff4"/>'
    '<circle cx="90" cy="118" r="2.6" fill="#2a8a6c"/><circle cx="110" cy="118" r="2.6" fill="#2a8a6c"/>'
    + eyes(100, 92, 24, 1.15) + blush(100, 116, 40, 8, 5) +
    '<path d="M88 132 Q100 142 112 132" stroke="#2b1d3a" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
    '<path d="M104 135 L108 135 L106 141 Z" fill="#fff"/>'
)

# 플라스크 슬라임
A["av-slime"] = svg(
    rg("bgs", [(0, "#f2fbff"), (0.6, "#c7e6ff"), (1, "#8fbdf2")], cx=0.5, cy=0.42, r=0.75)
    + rg("glow", [(0, "#c49bff"), (1, "#c49bff")]) + rg("liq", [(0, "#e7d2ff"), (0.45, "#a26cff"), (1, "#5a23d6")], cx=0.4, cy=0.3, r=0.85)
    + lg("glass", [(0, "#ffffff"), (1, "#e3f0fb")]),
    '<rect width="200" height="200" fill="url(#bgs)"/>'
    '<circle cx="100" cy="130" r="74" fill="#b07bff" opacity="0.22"/><circle cx="100" cy="130" r="54" fill="#b07bff" opacity="0.2"/>'
    + sparkle(30, 56, 9, "#fff") + sparkle(172, 44, 7, "#ffd65c") + sparkle(170, 156, 6, "#fff")
    + '<circle cx="116" cy="34" r="7" fill="#c9a8ff" opacity="0.85"/><circle cx="96" cy="18" r="5" fill="#c9a8ff" opacity="0.7"/><circle cx="126" cy="12" r="3.5" fill="#c9a8ff" opacity="0.6"/>'
    '<path d="M80 52 L80 74 Q34 104 36 140 Q38 186 100 186 Q162 186 164 140 Q166 104 120 74 L120 52 Z" fill="url(#glass)" fill-opacity="0.7" stroke="#7da3c8" stroke-width="4" stroke-linejoin="round"/>'
    '<path d="M44 118 Q70 106 100 116 Q130 126 156 114 Q162 128 160 142 Q156 180 100 180 Q44 180 40 142 Q38 128 44 118 Z" fill="url(#liq)"/>'
    '<path d="M48 120 Q72 110 100 119 Q128 128 152 117" stroke="#efe2ff" stroke-width="3" fill="none" opacity="0.8"/>'
    + eyes(100, 144, 20, 1.1) + blush(100, 160, 32, 8, 5, "#ff9ad0", 0.65) +
    '<path d="M92 160 Q100 168 108 160" stroke="#2b1d3a" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
    '<circle cx="62" cy="134" r="5" fill="#fff" opacity="0.6"/><circle cx="140" cy="164" r="4" fill="#fff" opacity="0.55"/><circle cx="134" cy="134" r="3" fill="#fff" opacity="0.6"/>'
    '<rect x="74" y="40" width="52" height="16" rx="8" fill="#e8f2fa" stroke="#7da3c8" stroke-width="3"/>'
    '<path d="M52 118 Q48 146 62 166" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.75"/>'
    '<rect x="86" y="58" width="6" height="18" rx="3" fill="#fff" opacity="0.75"/>'
)

# 토끼 엔지니어
A["av-bunny"] = svg(
    rg("bgb", [(0, "#fffbe6"), (0.6, "#ffe8a3"), (1, "#ffc95c")], cx=0.5, cy=0.42, r=0.75)
    + rg("fur", [(0, "#ffffff"), (0.75, "#f6f0f7"), (1, "#e2d6e6")]) + lg("hat", [(0, "#ffe57a"), (0.55, "#ffbf1f"), (1, "#e89a00")])
    + lg("over", [(0, "#5aa6ff"), (1, "#2a6fd0")]) + lg("tool", [(0, "#eef1f6"), (1, "#9aa3b6")], 0, 0, 1, 0),
    '<rect width="200" height="200" fill="url(#bgb)"/>'
    '<path d="M0 170 L200 150 L200 162 L0 182 Z" fill="#2b1d3a" opacity="0.08"/>'
    + sparkle(26, 48, 8, "#fff") + sparkle(176, 40, 6, "#ff9a3c")
    + '<ellipse cx="72" cy="46" rx="16" ry="42" fill="url(#fur)" stroke="#bfaec8" stroke-width="2.5" transform="rotate(-14 72 46)"/>'
    '<ellipse cx="72" cy="50" rx="7" ry="30" fill="#ffb7c8" transform="rotate(-14 72 50)"/>'
    '<ellipse cx="128" cy="46" rx="16" ry="42" fill="url(#fur)" stroke="#bfaec8" stroke-width="2.5" transform="rotate(14 128 46)"/>'
    '<ellipse cx="128" cy="50" rx="7" ry="30" fill="#ffb7c8" transform="rotate(14 128 50)"/>'
    '<path d="M56 200 Q58 158 100 154 Q142 158 144 200 Z" fill="url(#over)" stroke="#1f56a8" stroke-width="3"/>'
    '<rect x="84" y="170" width="32" height="22" rx="5" fill="#2a6fd0" stroke="#1f56a8" stroke-width="2"/>'
    '<circle cx="100" cy="116" r="54" fill="url(#fur)" stroke="#bfaec8" stroke-width="3"/>'
    '<path d="M46 102 Q46 52 100 52 Q154 52 154 102 Z" fill="url(#hat)" stroke="#c98200" stroke-width="3"/>'
    '<rect x="38" y="96" width="124" height="14" rx="7" fill="#f2a500" stroke="#c98200" stroke-width="2.5"/>'
    '<rect x="92" y="54" width="16" height="44" rx="5" fill="#fff3b0" opacity="0.9"/>'
    '<path d="M62 86 Q68 66 86 60" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.7"/>'
    + eyes(100, 128, 21, 1.0) + blush(100, 144, 34) +
    '<path d="M96 140 L104 140 L100 145 Z" fill="#ff8aa6"/>'
    '<path d="M100 145 Q96 151 90 149 M100 145 Q104 151 110 149" stroke="#2b1d3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    '<g transform="rotate(-36 164 158)"><rect x="158" y="136" width="12" height="54" rx="6" fill="url(#tool)" stroke="#7d869b" stroke-width="2"/>'
    '<circle cx="164" cy="134" r="14" fill="url(#tool)" stroke="#7d869b" stroke-width="2"/><rect x="159" y="116" width="10" height="16" rx="2" fill="#ffe8a3"/></g>'
)

# 판다 개발자
A["av-panda"] = svg(
    rg("bgp", [(0, "#effff6"), (0.6, "#bff0d6"), (1, "#7fd6ae")], cx=0.5, cy=0.42, r=0.75)
    + rg("fur", [(0, "#ffffff"), (0.8, "#f2f3f7"), (1, "#d9dce6")]) + rg("blk", [(0, "#4a4a5e"), (1, "#16161f")])
    + lg("set", [(0, "#62b0ff"), (1, "#2a6fd0")]) + rg("screen", [(0, "#7ffff0"), (1, "#7ffff0")], cx=0.5, cy=1, r=1),
    '<rect width="200" height="200" fill="url(#bgp)"/>'
    + "".join(f'<rect x="{x}" y="{y}" width="{w}" height="5" rx="2.5" fill="#2f8f5b" opacity="0.18"/>' for x, y, w in [(14, 26, 30), (14, 36, 44), (14, 46, 22), (150, 22, 34), (158, 32, 26)])
    + '<text x="160" y="62" font-size="16" font-weight="700" fill="#2f8f5b" opacity="0.3">&lt;/&gt;</text>'
    + '<circle cx="54" cy="56" r="22" fill="url(#blk)"/><circle cx="146" cy="56" r="22" fill="url(#blk)"/>'
    '<ellipse cx="100" cy="110" rx="66" ry="60" fill="url(#fur)" stroke="#b8bccb" stroke-width="3"/>'
    '<ellipse cx="76" cy="108" rx="17" ry="22" fill="url(#blk)" transform="rotate(-28 76 108)"/><ellipse cx="124" cy="108" rx="17" ry="22" fill="url(#blk)" transform="rotate(28 124 108)"/>'
    + eyes(100, 108, 22, 0.95) +
    '<ellipse cx="100" cy="132" rx="9" ry="6" fill="#16161f"/><ellipse cx="97" cy="130" rx="2.6" ry="1.5" fill="#fff" opacity="0.7"/>'
    + smile(100, 140, 6) + blush(100, 130, 42) +
    '<path d="M28 112 Q28 40 100 38 Q172 40 172 112" stroke="url(#set)" stroke-width="10" fill="none" stroke-linecap="round"/>'
    '<rect x="16" y="96" width="26" height="40" rx="11" fill="url(#set)" stroke="#1f56a8" stroke-width="2.5"/><rect x="158" y="96" width="26" height="40" rx="11" fill="url(#set)" stroke="#1f56a8" stroke-width="2.5"/>'
    '<path d="M30 132 Q38 160 70 160" stroke="#1f56a8" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="72" cy="160" r="6" fill="#2a6fd0"/>'
    '<ellipse cx="100" cy="190" rx="70" ry="24" fill="#7ffff0" opacity="0.25"/>'
    '<path d="M44 200 L56 168 H144 L156 200 Z" fill="#2b3550" stroke="#141a2c" stroke-width="2.5"/>'
    '<path d="M92 186 L86 180 L92 174 M108 174 L114 180 L108 186" stroke="#5ee8cc" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
)

# 불꽃새
A["av-phoenix"] = svg(
    rg("bgf", [(0, "#ffb86b"), (0.35, "#c2406a"), (0.75, "#4a1858"), (1, "#22092e")], cx=0.5, cy=0.6, r=0.8)
    + rg("body", [(0, "#ffe07a"), (0.55, "#ffa23a"), (1, "#f0561f")]) + lg("flame", [(0, "#fff2a0"), (0.5, "#ffb83a"), (1, "#ff4a2a")])
    + lg("wing", [(0, "#ffe070"), (1, "#ff3d22")], 0, 0, 1, 1) + rg("face", [(0, "#fffaf0"), (1, "#ffe2b0")]),
    '<rect width="200" height="200" fill="url(#bgf)"/>'
    '<circle cx="100" cy="112" r="78" fill="#ffcf6b" opacity="0.22"/><circle cx="100" cy="112" r="62" fill="#ffe08a" opacity="0.2"/>'
    + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff4b0" opacity="{o}"/>' for x, y, r, o in [(24, 70, 3, .8), (176, 84, 2.6, .8), (34, 150, 2.2, .7), (168, 158, 3, .7), (150, 30, 2, .7), (46, 28, 2.4, .7)])
    + sparkle(28, 40, 8, "#fff") + sparkle(174, 52, 6, "#fff")
    + '<path d="M78 162 Q66 196 82 200 Q86 184 92 176 Z" fill="url(#flame)"/><path d="M122 162 Q134 196 118 200 Q114 184 108 176 Z" fill="url(#flame)"/>'
    '<path d="M92 166 Q90 194 100 200 Q110 194 108 166 Z" fill="url(#flame)"/>'
    '<path d="M56 118 Q10 84 14 140 Q28 128 34 146 Q44 130 52 144 Q56 132 68 136 Z" fill="url(#wing)" stroke="#c9341a" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M144 118 Q190 84 186 140 Q172 128 166 146 Q156 130 148 144 Q144 132 132 136 Z" fill="url(#wing)" stroke="#c9341a" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M100 18 Q84 40 96 56 Q110 40 100 18 Z" fill="url(#flame)"/><path d="M78 30 Q72 50 88 60 Q88 44 78 30 Z" fill="url(#flame)"/><path d="M122 30 Q128 50 112 60 Q112 44 122 30 Z" fill="url(#flame)"/>'
    '<circle cx="100" cy="114" r="56" fill="url(#body)" stroke="#d2481a" stroke-width="3"/>'
    '<ellipse cx="80" cy="84" rx="16" ry="8" fill="#fff" opacity="0.4" transform="rotate(-24 80 84)"/>'
    '<ellipse cx="100" cy="124" rx="36" ry="30" fill="url(#face)"/>'
    + eyes(100, 116, 18, 1.05) +
    '<path d="M92 132 L108 132 L100 144 Z" fill="#ffc21a" stroke="#d99400" stroke-width="2" stroke-linejoin="round"/>'
    + blush(100, 134, 28, 7, 4)
)

# 꿈꾸는 고래: 빛줄기가 내려오는 바닷속, 물을 뿜는 아기 고래
A["av-whale"] = svg(
    lg("sea", [(0, "#8fe6ff"), (0.5, "#3a9be6"), (1, "#163f8f")])
    + rg("skin", [(0, "#b6e6ff"), (0.55, "#5aaef0"), (1, "#2a6fcf")], cx=0.36, cy=0.3, r=0.8)
    + lg("belly", [(0, "#f4fbff"), (1, "#cfe8ff")]) + lg("spout", [(0, "#ffffff"), (1, "#bfeaff")]),
    '<rect width="200" height="200" fill="url(#sea)"/>'
    '<path d="M40 0 L70 0 L30 200 L0 200 Z M110 0 L132 0 L120 200 L84 200 Z M168 0 L190 0 L200 120 L200 200 L176 200 Z" fill="#fff" opacity="0.1"/>'
    + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" fill-opacity="0.18" stroke="#fff" stroke-width="1.6" stroke-opacity="0.7"/>' for x, y, r in
              [(22, 150, 6), (34, 128, 3.5), (178, 170, 5), (186, 146, 3), (24, 64, 4), (170, 60, 3)])
    + '<path d="M0 190 Q30 176 60 188 Q100 200 140 186 Q172 176 200 188 V200 H0 Z" fill="#0f2f6e" opacity="0.45"/>'
    '<path d="M18 200 Q20 178 30 172 Q34 186 32 200 Z M178 200 Q176 182 186 174 Q192 188 188 200 Z" fill="#3fc79a" opacity="0.8"/>'
    + sparkle(30, 34, 8, "#fff") + sparkle(176, 98, 6, "#ffe08a")
    # 물줄기
    + '<path d="M100 66 L100 32 M100 34 Q90 14 70 22 M100 34 Q110 14 130 22" stroke="#7cc6ff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    '<path d="M100 66 L100 32 M100 34 Q90 14 70 22 M100 34 Q110 14 130 22" stroke="url(#spout)" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    '<circle cx="64" cy="32" r="4.5" fill="#e8f8ff"/><circle cx="136" cy="32" r="4.5" fill="#e8f8ff"/><circle cx="82" cy="10" r="3.5" fill="#e8f8ff"/><circle cx="118" cy="10" r="3.5" fill="#e8f8ff"/><circle cx="100" cy="16" r="3" fill="#e8f8ff"/>'
    # 꼬리 (몸 뒤 오른쪽 위로)
    '<path d="M164 76 Q150 68 140 50 Q156 50 165 62 Q170 50 180 44 Q180 66 164 76 Z" fill="url(#skin)" stroke="#1d58ac" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M144 126 Q168 108 160 74 L170 72 Q180 106 156 138 Z" fill="url(#skin)" stroke="#1d58ac" stroke-width="3" stroke-linejoin="round"/>'
    # 몸
    '<path d="M24 128 Q22 64 100 62 Q170 62 172 126 Q172 176 100 178 Q26 178 24 128 Z" fill="url(#skin)" stroke="#1d58ac" stroke-width="3"/>'
    '<path d="M32 138 Q60 150 100 150 Q140 150 166 138 Q160 174 100 174 Q40 174 32 138 Z" fill="url(#belly)"/>'
    '<path d="M62 156 Q100 164 138 156 M72 166 Q100 172 128 166" stroke="#a9d2f5" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    '<path d="M40 150 Q26 166 34 178 Q48 172 54 158 Z" fill="url(#skin)" stroke="#1d58ac" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M48 96 Q58 72 90 68" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.6"/>'
    '<circle cx="132" cy="80" r="3" fill="#fff" opacity="0.6"/><circle cx="142" cy="88" r="2" fill="#fff" opacity="0.5"/>'
    + eyes(96, 112, 26, 1.1) + blush(96, 132, 40, 8.5, 5) + smile(96, 132, 8)
)

# 공부 햄스터: 펼친 책 위에서 해바라기씨를 꼭 쥔 햄스터
A["av-hamster"] = svg(
    rg("bgh", [(0, "#fff8ef"), (0.6, "#ffdccb"), (1, "#ffb59c")], cx=0.5, cy=0.42, r=0.75)
    + rg("fur", [(0, "#ffe1b5"), (0.6, "#f5ad62"), (1, "#d98636")], cx=0.38, cy=0.28, r=0.8) + rg("face", [(0, "#ffffff"), (1, "#fff0de")])
    + lg("page", [(0, "#ffffff"), (1, "#efe6d6")]) + lg("cover", [(0, "#5a8cff"), (1, "#2f5fd0")]) + lg("seed", [(0, "#5a4a5a"), (1, "#2b1d2e")], 0, 0, 1, 0),
    '<rect width="200" height="200" fill="url(#bgh)"/>'
    '<circle cx="100" cy="104" r="84" fill="#fff" opacity="0.28"/>'
    + "".join(f'<g transform="rotate({a} {x} {y})"><ellipse cx="{x}" cy="{y}" rx="4" ry="7" fill="#4a3a4a" opacity="0.5"/><path d="M{x} {y-6} L{x} {y+6}" stroke="#fff" stroke-width="1.4" opacity="0.6"/></g>' for x, y, a in
             [(22, 70, -30), (180, 84, 24), (170, 32, -12), (30, 30, 18)])
    + sparkle(160, 52, 8, "#fff") + sparkle(36, 112, 6, "#ffd65c") + sparkle(174, 132, 5, "#fff")
    # 책
    + '<path d="M14 176 Q56 160 100 172 Q144 160 186 176 L186 200 L14 200 Z" fill="url(#cover)" stroke="#1f46a8" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M22 170 Q60 154 100 166 L100 196 Q60 184 22 196 Z" fill="url(#page)" stroke="#c9bca6" stroke-width="2"/>'
    '<path d="M178 170 Q140 154 100 166 L100 196 Q140 184 178 196 Z" fill="url(#page)" stroke="#c9bca6" stroke-width="2"/>'
    '<path d="M34 176 Q60 168 88 174 M34 184 Q60 176 88 182 M112 174 Q140 168 166 176 M112 182 Q140 176 166 184" stroke="#d8cdb8" stroke-width="2" fill="none" stroke-linecap="round"/>'
    # 귀
    '<circle cx="52" cy="58" r="19" fill="url(#fur)" stroke="#b86a24" stroke-width="3"/><circle cx="148" cy="58" r="19" fill="url(#fur)" stroke="#b86a24" stroke-width="3"/>'
    '<circle cx="53" cy="60" r="10" fill="#ffb7c3"/><circle cx="147" cy="60" r="10" fill="#ffb7c3"/>'
    # 몸 · 얼굴
    '<path d="M30 120 Q28 56 100 54 Q172 56 170 120 Q172 172 100 174 Q28 172 30 120 Z" fill="url(#fur)" stroke="#b86a24" stroke-width="3"/>'
    '<path d="M100 74 Q60 78 48 116 Q46 160 100 168 Q154 160 152 116 Q140 78 100 74 Z" fill="url(#face)"/>'
    '<path d="M100 56 L100 74 M88 58 L92 72 M112 58 L108 72" stroke="#d98636" stroke-width="4.5" stroke-linecap="round"/>'
    '<path d="M54 90 Q66 68 92 64" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.55"/>'
    + eyes(100, 108, 26, 1.05) + blush(100, 130, 38, 12, 8, "#ff8aa6", 0.6) +
    '<ellipse cx="100" cy="124" rx="6" ry="4.4" fill="#ff7a92"/><ellipse cx="98.5" cy="122.6" rx="2" ry="1.2" fill="#fff" opacity="0.8"/>'
    '<path d="M92 130 Q96 135 100 130 Q104 135 108 130" stroke="#2b1d3a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    '<rect x="96.4" y="131" width="7.2" height="6" rx="1.6" fill="#fff" stroke="#c9bca6" stroke-width="1"/><path d="M100 131 V137" stroke="#c9bca6" stroke-width="1"/>'
    # 해바라기씨 + 두 손
    '<g transform="rotate(-8 100 160)"><ellipse cx="100" cy="160" rx="10" ry="15" fill="url(#seed)" stroke="#1d1420" stroke-width="2"/>'
    '<path d="M100 147 L100 173 M95 150 L95 170 M105 150 L105 170" stroke="#fff" stroke-width="1.6" opacity="0.75"/></g>'
    '<ellipse cx="86" cy="164" rx="9" ry="7.5" fill="#ffd2c4" stroke="#d99a80" stroke-width="2"/><ellipse cx="114" cy="164" rx="9" ry="7.5" fill="#ffd2c4" stroke="#d99a80" stroke-width="2"/>'
)

# 별빛 유니콘: 밤하늘 · 무지개 갈기 · 빛나는 황금 뿔
MANE = ["#ff9ac8", "#ffc27a", "#ffe98a", "#9ff0c8", "#8fd0ff", "#b79cff"]
A["av-unicorn"] = svg(
    rg("night", [(0, "#8a76e8"), (0.55, "#3b2b8f"), (1, "#160f45")], cx=0.5, cy=0.35, r=0.8)
    + rg("coat", [(0, "#ffffff"), (0.7, "#f6f1ff"), (1, "#dcd0f2")], cx=0.38, cy=0.3, r=0.8)
    + lg("horn", [(0, "#fff7cf"), (0.5, "#ffd45a"), (1, "#e8a21f")], 0, 0, 1, 0) + '<radialGradient id="hglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff3a8" stop-opacity="0.8"/><stop offset="1" stop-color="#fff3a8" stop-opacity="0"/></radialGradient>'
    + rg("snout", [(0, "#fff4fb"), (1, "#f4d6ec")]),
    '<rect width="200" height="200" fill="url(#night)"/>'
    + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity="{o}"/>' for x, y, r, o in
              [(20, 26, 1.6, .9), (52, 12, 1.1, .7), (180, 22, 1.4, .9), (188, 72, 1.1, .7), (14, 78, 1.2, .8), (172, 120, 1.3, .7), (24, 130, 1, .6), (150, 10, 1, .7)])
    + '<circle cx="164" cy="40" r="15" fill="#fff1b8"/><circle cx="172" cy="34" r="13" fill="#2f2382"/>'
    + sparkle(36, 50, 8, "#ffe98a") + sparkle(176, 92, 6, "#fff") + sparkle(22, 160, 5, "#c9b8ff")
    # 목 · 몸
    + '<path d="M58 200 Q60 150 100 144 Q140 150 142 200 Z" fill="url(#coat)" stroke="#9f8cc8" stroke-width="3"/>'
    # 뒤쪽 갈기 (왼쪽으로 흘러내림)
    + "".join(f'<path d="M{64-i*3} {66+i*16} Q{30-i*2} {78+i*16} {34-i} {104+i*16} Q48 {98+i*16} 58 {96+i*14} Z" fill="{c}" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.6"/>' for i, c in enumerate(MANE))
    # 귀
    + '<path d="M62 78 Q56 44 70 34 Q84 52 86 70 Z" fill="url(#coat)" stroke="#9f8cc8" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M138 78 Q144 44 130 34 Q116 52 114 70 Z" fill="url(#coat)" stroke="#9f8cc8" stroke-width="3" stroke-linejoin="round"/>'
    '<path d="M68 70 Q66 50 72 44 Q80 56 80 66 Z" fill="#ffc6df"/><path d="M132 70 Q134 50 128 44 Q120 56 120 66 Z" fill="#ffc6df"/>'
    # 뿔 (빛 + 나선)
    '<circle cx="100" cy="32" r="34" fill="url(#hglow)"/>'
    '<path d="M88 70 L100 10 L112 70 Z" fill="url(#horn)" stroke="#c98a10" stroke-width="2.5" stroke-linejoin="round"/>'
    '<path d="M90 60 L110 54 M92 48 L108 43 M95 36 L106 32 M97 25 L103 22" stroke="#c98a10" stroke-width="2" stroke-linecap="round"/>'
    # 머리
    '<path d="M44 112 Q44 64 100 64 Q156 64 156 112 Q156 150 132 160 Q100 172 68 160 Q44 150 44 112 Z" fill="url(#coat)" stroke="#9f8cc8" stroke-width="3"/>'
    '<ellipse cx="100" cy="146" rx="36" ry="22" fill="url(#snout)"/>'
    '<ellipse cx="88" cy="146" rx="3.4" ry="2.4" fill="#c98aac"/><ellipse cx="112" cy="146" rx="3.4" ry="2.4" fill="#c98aac"/>'
    # 앞머리 무지개 갈기
    '<path d="M76 74 Q80 56 98 60 Q92 70 96 82 Q86 76 76 74 Z" fill="#ff9ac8" stroke="#fff" stroke-width="1.5" stroke-opacity="0.6"/>'
    '<path d="M96 82 Q94 62 112 62 Q120 64 124 74 Q112 72 108 86 Q104 80 96 82 Z" fill="#b79cff" stroke="#fff" stroke-width="1.5" stroke-opacity="0.6"/>'
    '<path d="M108 86 Q112 74 126 76 Q132 80 132 90 Q122 84 108 86 Z" fill="#8fd0ff" stroke="#fff" stroke-width="1.5" stroke-opacity="0.6"/>'
    '<path d="M56 96 Q66 76 84 72" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/>'
    + eyes(100, 114, 24, 1.05) +
    '<path d="M68 104 L62 99 M70 101 L66 94 M132 104 L138 99 M130 101 L134 94" stroke="#4a3a7a" stroke-width="2.4" stroke-linecap="round"/>'
    + blush(100, 132, 40, 8, 5, "#ff8ac0", 0.6) + smile(100, 156, 6)
    + sparkle(150, 136, 5, "#fff", 0.9)
)

ORDER_FREE = ["slotbot", "gear", "cat", "owl", "fox", "penguin", "robot", "bear", "frog"]
ORDER_PAID = ["av-astro", "av-dragon", "av-slime", "av-bunny", "av-panda", "av-phoenix", "av-whale", "av-hamster", "av-unicorn"]


def scoped(key, xml):
    """그라데이션 이름에 캐릭터 이름을 붙여, 한 화면에 여러 그림이 있어도 색이 섞이지 않게"""
    import re
    p = re.sub(r"[^a-z0-9]", "", key)
    xml = re.sub(r'id="([\w-]+)"', lambda m: f'id="{p}-{m.group(1)}"', xml)
    return re.sub(r"url\(#([\w-]+)\)", lambda m: f"url(#{p}-{m.group(1)})", xml)


def main():
    for k in list(A):
        A[k] = scoped(k, A[k])
    # JSON 문자열로 써서 따옴표 · 줄바꿈 걱정 없이
    import json
    body = ["// 자동 생성: python scripts/make_avatars.py — 직접 고치지 말고 스크립트를 고쳐서 다시 만드세요.",
            "/** 프로필 캐릭터 그림 (200×200 SVG 문자열). components/ProfileLook.tsx의 Avatar가 SvgXml로 그림 */",
            "export const AVATAR_XML: Record<string, string> = {"]
    for k in ORDER_FREE + ORDER_PAID:
        body.append(f"  {json.dumps(k)}: {json.dumps(A[k], ensure_ascii=False)},")
    body.append("};")
    open(OUT, "w", encoding="utf-8").write("\n".join(body) + "\n")
    print("wrote", OUT)
    if len(sys.argv) > 1:
        cells = "".join(
            f'<div class="c"><div class="a">{A[k]}</div><div>{k}</div></div>' for k in ORDER_FREE + ORDER_PAID)
        html = ('<html><body style="margin:0;background:#f2e6ce;font:14px sans-serif">'
                '<style>.g{display:grid;grid-template-columns:repeat(7,150px);gap:14px;padding:16px}.c{text-align:center}'
                '.a{width:130px;height:130px;border-radius:50%;overflow:hidden;margin:0 auto 6px;box-shadow:0 0 0 3px #fffaf0}.a svg{width:130px;height:130px}</style>'
                f'<div class="g">{cells}</div></body></html>')
        open(sys.argv[1], "w", encoding="utf-8").write(html)
        print("preview", sys.argv[1])


if __name__ == "__main__":
    main()
