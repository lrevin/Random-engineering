# 사용법: python scripts/make_boss_bgm.py app/assets/sfx  (numpy 필요)
"""오답 보스전 배경 음악 (직접 합성 → 저작권 문제 없음).
라 단조 느낌의 D 단조, 140 BPM, 16마디(약 27초)를 끊김 없이 반복되게 만듦:
필터 · 잔향을 FFT 원형 합성곱으로 걸어서 끝의 울림이 처음으로 자연스럽게 이어짐.
구성: 팀파니 · 킥 · 스네어 · 하이햇 / 8분음표 베이스 / 현악 패드 / 뒤 8마디 금관 선율."""
import numpy as np, wave, os, sys
SR = 22050
OUT = sys.argv[1]
rng = np.random.default_rng(11)
BPM = 140
BEAT = 60 / BPM
BARS = 16
N = int(round(SR * BEAT * 4 * BARS))
tt_all = np.arange(N) / SR

def note(n): return 440 * 2 ** ((n - 69) / 12)
def place(buf, start, x):
    """원형으로 더함 (끝을 넘으면 처음으로 이어짐 → 반복할 때 안 끊김)"""
    i = int(start * SR) % N
    idx = (np.arange(len(x)) + i) % N
    np.add.at(buf, idx, x)
def env(n, a, r):
    e = np.ones(n); na = max(1, int(SR * a)); e[:na] = np.linspace(0, 1, na)
    nr = min(n - na, int(SR * r)); e[n - nr:] *= np.linspace(1, 0, nr) if nr > 0 else 1
    return e
def saw(f, d, detune=(0,)):
    t = np.arange(int(SR * d)) / SR
    return sum(2 * ((f * (1 + c) * t + rng.random()) % 1) - 1 for c in detune) / len(detune)
def lowpass(x, cutoff, q=0.7):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    h = 1 / np.sqrt(1 + (f / cutoff) ** (4 * q)); return np.fft.irfft(X * h, len(x))
def highpass(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    h = 1 - 1 / np.sqrt(1 + (f / cutoff) ** 4); return np.fft.irfft(X * h, len(x))
def reverb(x, secs=1.6, wet=0.25):
    n = int(SR * secs); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * secs / 6))
    ir = lowpass(np.pad(ir, (0, N - n)), 4000)
    y = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(ir), N); y /= np.max(np.abs(y)) + 1e-9
    return x + y * wet * np.max(np.abs(x))

# 화성: 앞 8마디 Dm Bb C A ×2, 뒤 8마디 Dm Gm Bb A / Dm Gm A A
CH = {"Dm": [50, 53, 57], "Bb": [46, 50, 53], "C": [48, 52, 55], "A": [45, 49, 52], "Gm": [43, 46, 50]}
PROG = ["Dm", "Bb", "C", "A"] * 2 + ["Dm", "Gm", "Bb", "A", "Dm", "Gm", "A", "A"]
bar = BEAT * 4

drums, bass, pads, brass, timp = (np.zeros(N) for _ in range(5))
for b, ch in enumerate(PROG):
    s0 = b * bar; root = CH[ch][0]
    # 팀파니: 마디 첫 박 (낮게 울리며 음높이가 살짝 떨어짐)
    d = 0.9; t = np.arange(int(SR * d)) / SR
    f = note(root - 12) * (1 + 0.08 * np.exp(-t * 20))
    place(timp, s0, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) * (1.0 if b % 4 == 0 else 0.6))
    # 킥 · 스네어 · 하이햇
    for k in [0, 1.5, 2, 3.5] if b % 2 else [0, 2, 2.5]:
        d = 0.25; t = np.arange(int(SR * d)) / SR
        place(drums, s0 + k * BEAT, np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t * 18) + 45) / SR) * np.exp(-t * 14) * 1.1)
    for k in [1, 3]:
        d = 0.22; t = np.arange(int(SR * d)) / SR
        sn = highpass(np.pad(rng.standard_normal(len(t)), (0, N - len(t))), 1200)[:len(t)]
        place(drums, s0 + k * BEAT, (sn * 0.55 + np.sin(2 * np.pi * 190 * t) * 0.4) * np.exp(-t * 20))
    for k in np.arange(0, 4, 0.5):
        d = 0.05; t = np.arange(int(SR * d)) / SR
        place(drums, s0 + k * BEAT, rng.standard_normal(len(t)) * np.exp(-t * 90) * (0.16 if k % 1 else 0.1))
    # 4 · 8 · 12 · 16마디 끝: 탐탐 몰아치기
    if b % 4 == 3:
        for i, k in enumerate([3, 3.25, 3.5, 3.75]):
            d = 0.3; t = np.arange(int(SR * d)) / SR
            place(drums, s0 + k * BEAT, np.sin(2 * np.pi * np.cumsum(np.full(len(t), [180, 150, 125, 100][i]) * (1 + 0.2 * np.exp(-t * 25))) / SR) * np.exp(-t * 9) * 0.8)
    # 베이스: 8분음표로 근음-근음-옥타브 몰아침
    for k in range(8):
        n = root - 12 + (12 if k in (3, 6) else 0)
        d = BEAT / 2 * 0.92
        place(bass, s0 + k * BEAT / 2, saw(note(n), d, (-0.004, 0.004)) * env(int(SR * d), 0.005, 0.04))
    # 현악 패드: 화음을 한 마디 내내
    for n in CH[ch]:
        for o in (0, 12):
            place(pads, s0, saw(note(n + o), bar * 1.02, (-0.006, 0, 0.006)) * env(int(SR * bar * 1.02), 0.15, 0.25) * (0.5 if o else 0.8))

# 금관 선율 (뒤 8마디): 마디마다 (박, 음, 길이)
MEL = [[(0, 62, 1.5), (1.5, 65, 0.5), (2, 69, 2)], [(0, 67, 1), (1, 65, 1), (2, 62, 2)],
       [(0, 65, 1.5), (1.5, 67, 0.5), (2, 70, 2)], [(0, 69, 3), (3, 64, 1)],
       [(0, 74, 1.5), (1.5, 72, 0.5), (2, 69, 2)], [(0, 70, 1), (1, 69, 1), (2, 67, 2)],
       [(0, 69, 1), (1, 73, 1), (2, 76, 2)], [(0, 74, 3.5)]]
for i, ms in enumerate(MEL):
    s0 = (8 + i) * bar
    for k, n, l in ms:
        d = l * BEAT; t = np.arange(int(SR * d)) / SR
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.3)
        f = note(n) * vib; ph = np.cumsum(f) / SR
        tone = sum((2 * ((ph * h) % 1) - 1) / h for h in (1, 2, 3)) * 0.7 + np.tanh(2.5 * np.sin(2 * np.pi * ph)) * 0.4
        place(brass, s0 + k * BEAT, tone * env(len(t), 0.04, 0.12))
# 앞 8마디: 금관 대신 짧은 찌르기(스탭)로 긴장감
for b in range(8):
    for k in (0, 0.75):
        d = 0.18; t = np.arange(int(SR * d)) / SR
        for n in CH[PROG[b]]:
            place(brass, b * bar + (k + 2) * BEAT, saw(note(n + 12), d, (-0.004, 0.004)) * env(len(t), 0.01, 0.1) * 0.35)

mixd = (lowpass(drums, 6000) * 0.9 + lowpass(timp, 600) * 0.9 + lowpass(bass, 700) * 0.55
        + reverb(lowpass(pads, 1800), 2.2, 0.5) * 0.28 + reverb(lowpass(brass, 2600), 1.4, 0.35) * 0.42)
mixd = np.tanh(mixd / (np.max(np.abs(mixd)) + 1e-9) * 1.4)
mixd = mixd / np.max(np.abs(mixd)) * 0.8
os.makedirs(OUT, exist_ok=True)
with wave.open(os.path.join(OUT, "boss_bgm.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mixd * 32767).astype(np.int16).tobytes())
print("boss_bgm", round(N / SR, 2), "s")
