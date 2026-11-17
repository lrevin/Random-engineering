# 사용법: python scripts/make_sfx.py app/assets/sfx  (numpy 필요)
"""뽑공 효과음 합성 (외부 파일 없이 직접 만든 소리 → 저작권 문제 없음)"""
import numpy as np, wave, os, sys
SR = 22050
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def t(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, r=None, curve=4.0):
    x = np.ones(n); na = max(1, int(SR * a)); x[:na] = np.linspace(0, 1, na)
    tail = np.linspace(1, 0, n - na) ** curve if r is None else np.exp(-np.arange(n - na) / (SR * r))
    x[na:] *= tail; return x
def tone(f, d, kind="sine", a=0.005, r=None, curve=3.0, vib=0.0):
    tt = t(d); f = np.broadcast_to(f, tt.shape) if np.ndim(f) else np.full(tt.shape, f)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if vib: ph += vib * np.sin(2 * np.pi * 6 * tt)
    if kind == "sine": w = np.sin(ph)
    elif kind == "tri": w = 2 / np.pi * np.arcsin(np.sin(ph))
    elif kind == "square": w = np.tanh(3 * np.sin(ph)) * 0.6
    elif kind == "bell": w = np.sin(ph) + 0.4 * np.sin(2.76 * ph) * np.exp(-tt * 12) + 0.2 * np.sin(5.4 * ph) * np.exp(-tt * 25)
    return w * env(len(tt), a, r, curve)
def noise(d, a=0.001, curve=6.0, lp=0.0):
    n = rng.standard_normal(int(SR * d))
    if lp:  # 간단한 저역 통과
        for _ in range(int(lp)): n = np.convolve(n, np.ones(4) / 4, mode="same")
    return n * env(len(n), a, None, curve)
def mix(*parts):
    """parts: (시작초, 신호)"""
    end = max(int(s * SR) + len(x) for s, x in parts); y = np.zeros(end)
    for s, x in parts: i = int(s * SR); y[i:i + len(x)] += x
    return y
def note(n): return 440 * 2 ** ((n - 69) / 12)  # MIDI → Hz
def save(name, y, gain=0.7):
    y = y / (np.max(np.abs(y)) + 1e-9) * gain
    fade = min(len(y), int(SR * 0.004)); y[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())

# 슬롯머신
save("lever", mix((0, noise(0.06, lp=3) * 0.6), (0, tone(np.linspace(140, 70, int(SR * .22)), .22, "sine", r=.06)),
                  *[(0.05 + i * 0.035, noise(0.012, lp=1) * 0.35) for i in range(4)]), 0.75)
save("reel", mix((0, noise(0.018, lp=2) * 0.8), (0, tone(2400, 0.02, "sine", curve=6) * 0.4)), 0.45)
save("reel_stop", mix((0, tone(np.linspace(220, 120, int(SR * .14)), .14, "sine", curve=4)), (0, noise(0.03, lp=2) * 0.5)), 0.7)
save("slot_win", mix(*[(i * 0.08, tone(note(n), 0.35, "tri", r=.12)) for i, n in enumerate([72, 76, 79, 84])],
                     (0.32, tone(note(88), 0.45, "bell", r=.15) * 0.6)), 0.7)
# 배틀
save("match", mix((0, tone(note(67), 0.14, "square", r=.05)), (0.12, tone(note(72), 0.14, "square", r=.05)),
                  (0.24, tone(note(79), 0.4, "tri", r=.15))), 0.65)
save("count", tone(880, 0.12, "sine", curve=3), 0.55)
save("go", mix((0, tone(1320, 0.3, "sine", r=.1)), (0, tone(1980, 0.3, "sine", r=.06) * 0.3)), 0.6)
save("victory", mix(*[(s, tone(note(n), d, "tri", r=.18)) for s, n, d in [(0, 67, .15), (.13, 72, .15), (.26, 76, .15), (.39, 79, .5)]],
                    (0.39, tone(note(84), 0.6, "bell", r=.25) * 0.5), (0.39, tone(note(72), 0.6, "sine", r=.3) * 0.5)), 0.7)
save("defeat", mix(*[(s, tone(note(n), d, "tri", r=.2)) for s, n, d in [(0, 67, .22), (.2, 63, .22), (.4, 60, .55)]]), 0.6)
# 퀴즈
save("correct", mix((0, tone(note(76), 0.18, "bell", r=.08)), (0.09, tone(note(81), 0.35, "bell", r=.14))), 0.6)
save("wrong", mix((0, tone(np.linspace(240, 150, int(SR * .32)), .32, "square", r=.12)),), 0.45)
save("tick", mix((0, noise(0.012, lp=1) * 0.6), (0, tone(3200, 0.015, "sine", curve=8) * 0.5)), 0.4)
# 보상
save("gear", mix((0, tone(note(83), 0.08, "bell", r=.04)), (0.07, tone(note(88), 0.3, "bell", r=.1))), 0.6)
save("chest", mix((0, noise(0.25, a=0.05, curve=1.5, lp=4) * 0.25), (0, tone(np.linspace(180, 260, int(SR * .25)), .25, "tri", r=.2) * 0.4),
                  *[(0.25 + i * 0.06, tone(note(n), 0.5, "bell", r=.18) * 0.7) for i, n in enumerate([79, 84, 88, 91])]), 0.7)
save("levelup", mix((0, tone(np.linspace(note(60), note(84), int(SR * .35)), .35, "tri", curve=1) * 0.5),
                    *[(0.3 + i * 0.09, tone(note(n), 0.4, "tri", r=.15)) for i, n in enumerate([72, 76, 79])],
                    (0.57, tone(note(84), 0.7, "bell", r=.3) * 0.7), (0.57, tone(note(76), 0.7, "sine", r=.3) * 0.4)), 0.7)
print(sorted(os.listdir(OUT)))

# 톱니바퀴(코인) 획득: 터져 나올 때 짤랑 → 하나 도착할 때마다 띵(점점 높아짐) → 다 모이면 반짝
def metal(f, d, r=0.09):
    """금속 동전 울림: 기음 + 어긋난 배음(빨리 사라짐) + 맨 앞 딸깍"""
    tt = t(d); y = np.zeros_like(tt)
    for k, amp, dec in [(1, 1.0, 1.0), (2.0, 0.35, 1.8), (2.76, 0.3, 3.0), (5.4, 0.12, 5.0)]:
        if f * k < SR * 0.45: y += amp * np.sin(2 * np.pi * f * k * tt) * np.exp(-tt / (r / dec))
    y[:int(SR * 0.004)] *= np.linspace(0, 1, int(SR * 0.004))
    return mix((0, y), (0, noise(0.006, lp=1) * 0.25))
COIN = [79, 81, 83, 86, 88, 91, 93, 95]  # 펜타토닉으로 한 칸씩 올라감
for i, n in enumerate(COIN):
    save(f"coin{i + 1}", mix((0, metal(note(n), 0.06, r=.03) * 0.7), (0.045, metal(note(n + 5), 0.3, r=.11))), 0.55)
save("coin_spill", mix((0, noise(0.22, a=0.02, curve=2.5, lp=6) * 0.18),
                       *[(s, metal(note(int(n)), 0.12, r=.035) * g) for s, n, g in
                         zip(rng.uniform(0, 0.2, 7), rng.choice([84, 86, 88, 91, 93], 7), rng.uniform(0.35, 0.7, 7))]), 0.5)
save("coin_done", mix(*[(i * 0.05, tone(note(n), 0.5, "bell", r=.16) * (0.9 - i * 0.12)) for i, n in enumerate([91, 95, 98, 103])],
                      (0, noise(0.35, a=0.03, curve=2, lp=0) * 0.04)), 0.55)

# 오답 보스전: 맞을 때 퍽 + 철컹(슬롯머신 몸통) · 틀렸을 때 악마 웃음 · 나타날 때 낮게 울림
def biquad_bp(x, f, q):
    """공명(포먼트) 하나: 2차 대역 통과"""
    w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q); a0 = 1 + al
    b0, b2, a1, a2 = al / a0, -al / a0, -2 * np.cos(w) / a0, (1 - al) / a0
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = b0 * v + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o; y[i] = o
    return y
def saw(f, d):
    tt = t(d); f = np.broadcast_to(f, tt.shape) if np.ndim(f) else np.full(tt.shape, f)
    ph = np.cumsum(f) / SR; return 2 * (ph % 1) - 1
def ha(f0, d, vowel=(750, 1150, 2500)):
    """'하' 한 음절: 거친 성대 소리(톱니파 + 한 옥타브 아래) → 모음 포먼트, 앞에 'ㅎ' 숨소리"""
    n = int(SR * d); tt = t(d)
    pitch = f0 * (1 + 0.06 * np.exp(-tt * 18)) * (1 - 0.12 * tt / d)  # 처음에 살짝 높았다가 내려감
    src = saw(pitch, d) + 0.7 * saw(pitch / 2, d) + 0.15 * rng.standard_normal(n)
    src = np.tanh(src * 1.6)
    voiced = sum(biquad_bp(src, f, q) * g for f, q, g in zip(vowel, (6, 8, 10), (1.0, 0.7, 0.25)))
    e = np.minimum(1, tt / 0.025) * np.exp(-np.maximum(0, tt - 0.03) / (d * 0.45))
    breath = biquad_bp(rng.standard_normal(int(SR * 0.05)), 1400, 1.2) * np.linspace(0.6, 0, int(SR * 0.05))
    return mix((0, breath * 0.5), (0.02, voiced * e))
def echo(y, gaps=((0.11, 0.35), (0.23, 0.18), (0.37, 0.08))):
    return mix((0, y), *[(g, y * a) for g, a in gaps])
def hi(f0, d, vowel=(380, 2200, 3000)):
    """귀여운 '히' 한 음절: 높고 맑은 목소리(삼각파 + 사인), 끝이 살짝 올라감, 앞에 짧은 'ㅎ'"""
    n = int(SR * d); tt = t(d)
    pitch = f0 * (1 + 0.18 * (tt / d) ** 2) * (1 + 0.025 * np.sin(2 * np.pi * 9 * tt))
    ph = 2 * np.pi * np.cumsum(pitch) / SR
    src = 2 / np.pi * np.arcsin(np.sin(ph)) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    voiced = sum(biquad_bp(src, f, q) * g for f, q, g in zip(vowel, (4, 6, 8), (1.0, 0.8, 0.3))) + src * 0.25
    e = np.minimum(1, tt / 0.012) * np.exp(-np.maximum(0, tt - 0.02) / (d * 0.5))
    breath = biquad_bp(rng.standard_normal(int(SR * 0.025)), 3000, 1.5) * np.linspace(0.4, 0, int(SR * 0.025))
    return mix((0, breath * 0.35), (0.012, voiced * e))
# 히히히힛: 통통 튀는 높은 웃음 (무섭지 않게, 메아리 없이 짧게)
laugh = mix(*[(i * 0.105, hi(f, 0.095)) for i, f in enumerate([560, 640, 600, 690, 650])],
            (0.56, hi(760, 0.2, (420, 2400, 3200)) * 1.05))
save("boss_laugh", mix((0, laugh), (0.06, laugh * 0.12)), 0.6)
save("boss_hit", mix((0, tone(np.linspace(150, 42, int(SR * .26)), .26, "sine", r=.07) * 1.0),
                     (0, biquad_bp(rng.standard_normal(int(SR * .09)), 1800, 0.9) * env(int(SR * .09), 0.001, None, 5) * 0.9),
                     (0.012, metal(330, 0.32, r=.1) * 0.45), (0.012, metal(523, 0.25, r=.06) * 0.25),
                     (0.05, noise(0.05, lp=2) * 0.3)), 0.8)
save("boss_appear", echo(mix((0, tone(note(33), 1.2, "square", a=0.15, r=.5) * 0.6), (0, tone(note(39), 1.2, "square", a=0.2, r=.5) * 0.45),
                             (0, noise(1.0, a=0.3, curve=2, lp=8) * 0.35), (0.35, tone(note(57), 0.8, "tri", a=0.05, r=.25, vib=0.8) * 0.3),
                             (0.35, tone(note(63), 0.8, "tri", a=0.05, r=.25, vib=0.8) * 0.25)), ((0.18, 0.3), (0.36, 0.12))), 0.7)
print("boss ok")
