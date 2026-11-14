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
