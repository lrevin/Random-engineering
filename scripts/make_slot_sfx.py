# 사용법: python scripts/make_slot_sfx.py app/assets/sfx  (numpy 필요, make_sfx.py 다음에 실행)
"""슬롯머신 릴 회전음: 앱 애니메이션(2.3초, bezier(0.12,0.7,0.3,1))과 같은 감속 곡선으로
모터 웅웅 + 릴 칸 덜컥덜컥 + 멈출 때 철컥. 직접 합성 (저작권 없음)"""
import numpy as np, wave, sys, os
SR = 22050
out = sys.argv[1]
rng = np.random.default_rng(11)

def bez(p1x, p1y, p2x, p2y):
    ts = np.linspace(0, 1, 4001)
    bx = 3*(1-ts)**2*ts*p1x + 3*(1-ts)*ts**2*p2x + ts**3
    by = 3*(1-ts)**2*ts*p1y + 3*(1-ts)*ts**2*p2y + ts**3
    return lambda x: np.interp(x, bx, by)

DUR = 2.3
ease = bez(0.12, 0.7, 0.3, 1)
T = DUR + 0.55
n = int(SR * T)
t = np.arange(n) / SR
p = ease(np.clip(t / DUR, 0, 1))
speed = np.gradient(p, t)
speed[t > DUR] = 0
speed /= speed.max()
y = np.zeros(n)

# 1) 모터 · 릴 웅웅 소리: 속도에 따라 크기와 높이가 변하는 거친 저음
ph = 2*np.pi*np.cumsum(55 + 85*speed) / SR
hum = (np.sin(ph) + 0.5*np.sin(2*ph) + 0.25*np.sign(np.sin(3*ph))) * speed**1.2
noise = rng.standard_normal(n)
for _ in range(6): noise = np.convolve(noise, np.ones(5)/5, mode="same")
y += 0.35*hum + 0.5*noise*speed**1.5

# 2) 릴 칸이 지날 때마다 덜컥 (속도 비례: 처음 초당 ~30번 → 점점 느려짐)
click = lambda L: (rng.standard_normal(L) * np.exp(-np.arange(L)/(SR*0.004))
                   + 0.6*np.sin(2*np.pi*1800*np.arange(L)/SR)*np.exp(-np.arange(L)/(SR*0.006)))
rate = 30*speed
acc = 0.0
L = int(SR*0.03)
for i in range(n):
    acc += rate[i] / SR
    if acc >= 1:
        acc -= 1
        amp = 0.35 + 0.5*speed[i]
        j = min(n, i+L); y[i:j] += amp*click(L)[:j-i]

# 3) 멈출 때 "철-컥": 무거운 쿵 + 걸쇠 딸깍 + 짧은 떨림
def thump(at, f0, f1, d, a):
    k = int(SR*at); L = int(SR*d); tt = np.arange(L)/SR
    f = np.linspace(f0, f1, L)
    s = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-tt/(d/4))
    nn = rng.standard_normal(L) * np.exp(-tt/0.01) * 0.5
    y[k:k+L] += a*(s + nn)[:max(0, min(L, n-k))]
thump(DUR-0.02, 180, 70, 0.18, 1.0)
thump(DUR+0.09, 900, 600, 0.05, 0.45)   # 걸쇠
thump(DUR+0.16, 240, 120, 0.10, 0.35)   # 되튐

y /= np.max(np.abs(y)) + 1e-9
y *= 0.85
y[-int(SR*0.02):] *= np.linspace(1, 0, int(SR*0.02))
y[:int(SR*0.01)] *= np.linspace(0, 1, int(SR*0.01))
with wave.open(os.path.join(out, "slot_spin.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y*32767).astype(np.int16).tobytes())

# 레버: 래칫 드르륵 + 스프링 툭
n2 = int(SR*0.4); z = np.zeros(n2)
for k in range(7):
    i = int(SR*(0.01 + k*0.022)); j = min(n2, i+L); z[i:j] += (0.5 + 0.07*k)*click(L)[:j-i]
tt = np.arange(int(SR*0.25))/SR
spring = np.sin(2*np.pi*np.cumsum(np.linspace(140, 90, len(tt)))/SR)*np.exp(-tt/0.05)
i = int(SR*0.16); z[i:i+len(tt)] += 0.9*spring[:n2-i]
z /= np.max(np.abs(z)); z *= 0.8
with wave.open(os.path.join(out, "lever.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((z*32767).astype(np.int16).tobytes())
print("ok")
