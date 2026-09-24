"""Synthesizes the 48 s soundtrack for the launch film -> build/soundtrack.wav

Everything is generated from scratch (no samples): 120 BPM, A minor,
i-VI-III-VII progression. Hits, whooshes and UI sounds are placed on the
same timestamps the visuals use in index.html.

    python3 music.py
"""
import os
import wave

import numpy as np
from scipy import signal

SR = 44100
DUR = 48.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)
SEND_L = np.zeros(N)  # reverb send
SEND_R = np.zeros(N)


def t_arr(d):
    return np.arange(int(d * SR)) / SR


def add(sig, at, gain=1.0, pan=0.0, send=0.0):
    """Mix mono or (L, R) signal at time `at` seconds."""
    i = int(at * SR)
    if i >= N:
        return
    if isinstance(sig, tuple):
        sl, sr_ = sig
    else:
        sl = sr_ = sig
    n = min(len(sl), N - i)
    gl = gain * np.sqrt(0.5 * (1 - pan))
    gr = gain * np.sqrt(0.5 * (1 + pan))
    L[i:i + n] += sl[:n] * gl
    R[i:i + n] += sr_[:n] * gr
    if send:
        SEND_L[i:i + n] += sl[:n] * gl * send
        SEND_R[i:i + n] += sr_[:n] * gr * send


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def note(n):
    """MIDI note -> Hz"""
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f, t, phase=0.0):
    return 2 * ((f * t + phase) % 1.0) - 1


# ---------------------------------------------------------------- instruments
def kick(d=0.45, punch=1.0):
    t = t_arr(d)
    f = 45 + 110 * np.exp(-t * 28) * punch
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 180) * 0.25
    return np.tanh((body + click) * 1.6)


def clap():
    t = t_arr(0.35)
    nz = bp(rng.standard_normal(len(t)), 900, 5000)
    env = np.zeros(len(t))
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        env[i:] += np.exp(-(t[i:] - off) * (90 if k < 2 else 16))
    return nz * env * 0.8


def hat(d=0.05, open_=False):
    t = t_arr(0.3 if open_ else d)
    nz = hp(rng.standard_normal(len(t)), 7000)
    return nz * np.exp(-t * (9 if open_ else 70)) * 0.5


def sub_boom(d=2.2, f0=70, f1=32):
    t = t_arr(d)
    f = f1 + (f0 - f1) * np.exp(-t * 4)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 1.6)


def crash(d=2.5):
    t = t_arr(d)
    nz = hp(rng.standard_normal(len(t)), 3000)
    return nz * np.exp(-t * 2.2) * 0.45


def impact(big=1.0):
    t = t_arr(2.5)
    k = np.zeros(len(t))
    kk = kick(0.6, 1.4)
    k[:len(kk)] += kk
    boom = sub_boom(2.5)
    noise = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 6) * 0.6
    return np.tanh((k * 0.9 + boom * 0.9 * big + noise) * 1.2)


def whoosh(d=0.6, rise=True):
    """Filtered noise sweep; peak at the end if rise else at the start."""
    n = int(d * SR)
    t = np.arange(n) / n
    nz = rng.standard_normal(n)
    shape = t ** 2.2 if rise else (1 - t) ** 2.2
    fc = 300 + 7000 * shape
    # time-varying one-pole lowpass (vectorised in blocks)
    out = np.zeros(n)
    y = 0.0
    blk = 256
    for s in range(0, n, blk):
        a = np.exp(-2 * np.pi * fc[s] / SR)
        seg = nz[s:s + blk]
        zi = np.array([y * a])
        o, _ = signal.lfilter([1 - a], [1, -a], seg, zi=zi)
        out[s:s + blk] = o
        y = o[-1]
    env = shape * (1 - (t ** 12 if rise else 0))
    if rise:
        env *= np.minimum(1, (1 - t) * 40)
    return hp(out, 150) * env * 1.4


def riser(d=2.0):
    t = t_arr(d)
    p = t / d
    nz = whoosh(d, True) * 0.7
    f = 200 * 2 ** (p * 3)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * p ** 2 * 0.12
    return nz + tone


def pluck(f, d=0.35):
    t = t_arr(d)
    x = 0.6 * saw(f, t) + 0.4 * np.sign(np.sin(2 * np.pi * f * t))
    x = lp(x, 2600)
    return x * np.exp(-t * 11) * 0.22


def pad_chord(notes, d, cutoff=1500, attack=0.25):
    t = t_arr(d)
    sl = np.zeros(len(t))
    sr_ = np.zeros(len(t))
    for n in notes:
        for k, det in enumerate([-0.12, -0.05, 0.0, 0.05, 0.12]):
            f = note(n + det)
            v = saw(f, t, rng.random())
            if k % 2:
                sl += v
            else:
                sr_ += v
    env = np.minimum(1, t / attack) * np.minimum(1, (d - t) / 0.3)
    k = 0.045
    return lp(sl, cutoff) * env * k, lp(sr_, cutoff) * env * k


def bass_note(f, d):
    t = t_arr(d)
    x = 0.7 * np.sin(2 * np.pi * f * t) + 0.3 * lp(saw(f, t), 600)
    env = np.minimum(1, t / 0.005) * np.exp(-t * 3) * np.minimum(1, (d - t) / 0.02)
    return x * env * 0.55


def braam(root):
    t = t_arr(1.4)
    x = np.zeros(len(t))
    for n in (root, root + 7, root + 12, root + 15):
        x += saw(note(n), t, rng.random()) + saw(note(n + 0.08), t, rng.random())
    x = np.tanh(lp(x, 900) * 0.8)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    return x * env * 0.35


def key_click():
    t = t_arr(0.03)
    return bp(rng.standard_normal(len(t)), 2000, 8000) * np.exp(-t * 260) * 0.35


def ui_click():
    t = t_arr(0.25)
    blip = np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 40) * 0.3
    blip += np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 25) * 0.18
    return blip


# ------------------------------------------------------------------ harmony
# A minor: Am F C G  (bar = 2 s)
CHORDS = [
    (57, [57, 60, 64, 71]),  # Am(add9-ish voicing: A C E B)
    (53, [53, 57, 60, 64]),  # Fmaj7
    (48, [55, 60, 64, 67]),  # C
    (55, [55, 59, 62, 69]),  # G(add9)
]


def chord_at(time):
    return CHORDS[int(time // 2) % 4]


# ------------------------------------------------------------------ arrangement
# Intro (0-4): pad swell, heartbeat kicks accelerating, riser into 4.0
for bar in range(2):
    root, notes = chord_at(bar * 2)
    add(pad_chord(notes, 2.05, cutoff=500 + bar * 500, attack=0.8), bar * 2, 0.9, send=0.5)
for tk, g in [(0, .55), (1.0, .5), (2.0, .6), (2.5, .5), (3.0, .6), (3.25, .5), (3.5, .6), (3.625, .45), (3.75, .6), (3.875, .5)]:
    add(kick(0.35, 0.6), tk, g)
add(riser(2.0), 2.0, 0.55, send=0.3)
# word ticks in the hook
for tk in [0.25, 0.37, 0.49, 0.61, 2.0, 2.1, 2.2, 2.3]:
    add(key_click(), tk, 0.5, pan=rng.uniform(-.3, .3), send=0.2)
add(whoosh(0.5, True), 3.55, 0.6, send=0.3)

# 4.0 drop + 4.5 logo impact
add(sub_boom(1.5, 90, 40), 4.0, 0.35)
add(whoosh(0.5, True), 4.0, 0.45, pan=-.4)
add(whoosh(0.5, True), 4.0, 0.45, pan=.4)
add(impact(1.0), 4.5, 1.0, send=0.35)
add(crash(3.0), 4.5, 0.55, send=0.5)

# 4.5-8: pad + arp, kicks on bar lines, build at 7-8
for bar in range(2, 4):
    root, notes = chord_at(bar * 2)
    add(pad_chord(notes, 2.05, cutoff=1400), bar * 2, 0.85, send=0.6)
arp_pattern = [0, 2, 1, 3, 2, 1, 3, 2]
for i in range(int((8 - 4.5) / 0.25)):
    tt = 4.5 + i * 0.25
    root, notes = chord_at(tt)
    add(pluck(note(notes[arp_pattern[i % 8]] + 12)), tt, 0.5, pan=(-.4 if i % 2 else .4), send=0.45)
add(kick(), 6.0, 0.6)
for i in range(8):  # snare/clap roll 7-8
    add(clap(), 7.0 + i * 0.125, 0.18 + i * 0.05, send=0.2)
add(riser(1.0), 7.0, 0.5, send=0.2)
add(whoosh(0.4, True), 7.6, 0.5)

# 8-38.5: main groove
GROOVE_END = 38.5
for bar in range(4, 20):
    t0 = bar * 2
    if t0 >= GROOVE_END:
        break
    root, notes = chord_at(t0)
    add(pad_chord(notes, 2.05, cutoff=1800), t0, 0.7, send=0.5)
    for b in range(4):
        tb = t0 + b * BEAT
        if tb >= GROOVE_END:
            break
        add(kick(), tb, 0.85)
        if b in (1, 3):
            add(clap(), tb, 0.55, send=0.25)
        add(hat(), tb + 0.25, 0.4, pan=.25)
        add(hat(0.03), tb + 0.125, 0.18, pan=-.25)
        add(hat(0.03), tb + 0.375, 0.18, pan=-.25)
        # bass: 8ths, offbeat pumping
        add(bass_note(note(root - 24 + (12 if root < 50 else 0)), 0.22), tb + 0.25, 0.9)
        add(bass_note(note(root - 24 + (12 if root < 50 else 0)), 0.2), tb, 0.4)
    # arp
    for i in range(8):
        tt = t0 + i * 0.25
        if tt >= GROOVE_END:
            break
        add(pluck(note(notes[arp_pattern[i]] + 12)), tt, 0.38, pan=(-.45 if i % 2 else .45), send=0.4)
    if bar % 4 == 0:
        add(crash(2.0), t0, 0.3, send=0.4)

# sidechain-ish ducking: duck everything but kick handled crudely by envelope below

# transitions (whip pans)
for tw in [13.65, 18.65, 23.55, 34.65]:
    add(whoosh(0.4, True), tw, 0.75, pan=0, send=0.3)
    add(whoosh(0.45, False), tw + 0.4, 0.35, send=0.3)
# montage cuts 24..29
for i in range(6):
    tc = 24 + i
    add(whoosh(0.28, True), tc - 0.26, 0.55, pan=(.5 if i % 2 == 0 else -.5), send=0.2)
    add(kick(0.3, 1.2), tc, 0.5)
    add(pluck(note(81 + [0, 3, 7, 10, 12, 15][i])), tc, 0.35, send=0.6)
add(whoosh(0.35, True), 29.7, 0.6, send=0.3)
add(impact(0.5), 30.0, 0.4, send=0.2)

# typing: AI prompt 15.5-16.9, code 30.8-33.0
for t0, t1 in [(15.5, 16.9), (30.8, 33.0)]:
    tt = t0
    while tt < t1:
        add(key_click(), tt, 0.28, pan=rng.uniform(-.3, .3))
        tt += rng.uniform(0.045, 0.11)
add(ui_click(), 17.05, 0.5, send=0.4)   # SQL appears
add(ui_click(), 33.15, 0.5, send=0.4)   # response card
# chips / provider pops
for tt in [12.2, 12.36, 12.52]:
    add(pluck(note(88)), tt, 0.22, send=0.5)
for i in range(12):
    add(key_click(), 20.3 + i * 0.07, 0.3, pan=np.sin(i) * .6, send=0.3)

# 37.5-39: build, stop at 38.5
add(riser(1.5), 37.2, 0.6, send=0.3)
for i in range(8):
    add(clap(), 37.5 + i * 0.125, 0.15 + i * 0.05, send=0.15)
add(whoosh(0.35, True), 38.7, 0.5)

# 39,40,41: braams
for tb, root in [(39.0, 45), (40.0, 41), (41.0, 43)]:
    add(braam(root), tb, 0.9, send=0.5)
    add(kick(0.6, 1.4), tb, 0.8)
    add(sub_boom(1.0, 80, 35), tb, 0.4)
add(riser(0.9), 41.1, 0.55, send=0.3)

# 42: finale
add(impact(1.2), 42.0, 1.0, send=0.4)
add(crash(4.0), 42.0, 0.6, send=0.6)
add(pad_chord([57, 60, 64, 71, 76], 5.8, cutoff=2200, attack=0.05), 42.0, 0.95, send=0.8)
add(bass_note(note(33), 3.0), 42.0, 0.9)
for i in range(16):
    tt = 42.5 + i * 0.25
    add(pluck(note([69, 72, 76, 79, 83, 79, 76, 72][i % 8] + 12)), tt, 0.3 * (1 - i / 18), pan=(-.5 if i % 2 else .5), send=0.6)
for tb in [43.0, 44.0]:
    add(kick(0.4, 0.8), tb, 0.45)
add(whoosh(0.8, True), 44.2, 0.2)
add(ui_click(), 45.0, 0.9, send=0.5)
add(pluck(note(93)), 45.0, 0.35, send=0.8)
add(pluck(note(100)), 45.12, 0.25, send=0.8)

# ------------------------------------------------------------------ mix
# sidechain pump: duck the non-kick bed on every groove beat
duck = np.ones(N)
tt = np.arange(N) / SR
for b in np.arange(8.0, GROOVE_END, BEAT):
    i0 = int(b * SR)
    seg = tt[i0:i0 + int(0.3 * SR)] - b
    duck[i0:i0 + len(seg)] = np.minimum(duck[i0:i0 + len(seg)], 1 - 0.35 * np.exp(-seg * 14))

# reverb: synthetic stereo IR
ir_t = t_arr(2.6)
irL = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.4)
irR = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.4)
irL = lp(irL, 6000)
irR = lp(irR, 6000)
revL = signal.fftconvolve(SEND_L, irL)[:N] * 0.035
revR = signal.fftconvolve(SEND_R, irR)[:N] * 0.035

outL = L * duck + revL
outR = R * duck + revR
# gentle glue: soft clip, then normalize
mx = np.percentile(np.abs(np.concatenate([outL, outR])), 99.97)
outL = np.tanh(outL / mx * 1.25)
outR = np.tanh(outR / mx * 1.25)
fade_in = np.minimum(1, tt / 0.05)
fade_out = np.clip((DUR - tt) / 1.4, 0, 1) ** 1.5
outL *= fade_in * fade_out * 0.89
outR *= fade_in * fade_out * 0.89

os.makedirs('build', exist_ok=True)
pcm = np.stack([outL, outR], axis=1)
pcm = (np.clip(pcm, -1, 1) * 32767).astype(np.int16)
with wave.open('build/soundtrack.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote build/soundtrack.wav', pcm.shape[0] / SR, 's')
