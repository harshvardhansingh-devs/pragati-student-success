"""Synthesise a 70 s ambient-electronic score synced to the promo timeline (no samples, no copyright)."""
import wave
from pathlib import Path

import numpy as np

SR, DUR = 44100, 70.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
BPM = 96
BEAT = 60 / BPM            # 0.625 s
BAR = 4 * BEAT             # 2.5 s


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414


def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 1.5
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def pad(midis, length):
    n = int(length * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for m in midis:
        f = hz(m)
        for det in (-0.0018, 0.0, 0.0021):  # slight detune = warmth
            s += np.sin(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28)) + 0.18 * np.sin(4 * np.pi * f * (1 + det) * t)
    s *= 1 + 0.08 * np.sin(2 * np.pi * 0.3 * t)  # slow shimmer
    return s / (len(midis) * 3) * env(n, 0.9, 1.1)


def pluck(m, length=0.9):
    n = int(length * SR); t = np.arange(n) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)) * np.exp(-t / 0.22) * env(n, 0.004, 0.05)


def bell(m, length=2.2):
    n = int(length * SR); t = np.arange(n) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.35)
            + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.15)) * env(n, 0.003, 0.2)


def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 70 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)


def smooth(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def impact(length=2.6):
    n = int(length * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(32 + 55 * np.exp(-t / 0.25)) / SR) * np.exp(-t / 0.9)
    air = smooth(rng.standard_normal(n), 24) * np.exp(-t / 0.5) * 0.5
    return boom + air


def riser(length):
    n = int(length * SR); t = np.arange(n) / SR
    noise = smooth(rng.standard_normal(n), 40) * (t / length) ** 2.2
    sweep = np.sin(2 * np.pi * np.cumsum(220 + 500 * (t / length) ** 2) / SR) * 0.15 * (t / length) ** 2
    return noise * 0.9 + sweep


# Progression (A minor feel): Am9 – Fmaj7 – Cmaj7 – G6, one chord per bar
CHORDS = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 64]]
ROOTS = [45, 41, 36, 43]

# --- pad through the whole piece (chords overlap for smooth changes)
t = 0.0; k = 0
while t < DUR:
    add(pad(CHORDS[k % 4], BAR + 1.2), t, gain=0.55 if t < 13 else 0.42)
    t += BAR; k += 1

# --- riser into the logo reveal, impacts on logo and end card
add(riser(2.2), 5.4, gain=0.35)
add(impact(), 7.6, gain=0.75)
add(impact(), 63.2, gain=0.6)
add(bell(81), 8.8, gain=0.22, pan=0.2)          # sparkle when the spark appears

# --- arpeggio from the logo onward (8th notes over chord tones, an octave up)
step = BEAT / 2
t = 8.0; i = 0
while t < 66.5:
    chord = CHORDS[int(t // BAR) % 4]
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    note = chord[pattern[i % 8] % len(chord)] + 12
    g = 0.11 if t < 13 else 0.15
    if 56 <= t < 63:
        g = 0.09
    add(pluck(note), t, gain=g, pan=0.35 if i % 2 else -0.35)
    t += step; i += 1

# --- soft kick + sub bass through features and stats (13–56 s)
t = 13.0
while t < 56.0:
    b = int(t // BEAT)
    if b % 2 == 0:
        add(kick(), t, gain=0.5)
    t += BEAT
t = 12.5
while t < 56.0:
    n = int(BAR * SR); tt = np.arange(n) / SR
    root = ROOTS[int(t // BAR) % 4]
    add(np.sin(2 * np.pi * hz(root) * tt) * env(n, 0.05, 0.6), t, gain=0.22)
    t += BAR

# --- a chime on each pillar word, ascending
for ts, m in zip([56.3, 56.9, 57.5, 58.1, 58.7], [81, 84, 88, 91, 93]):
    add(bell(m), ts, gain=0.28, pan=(m - 87) / 20)

# --- simple stereo reverb (FFT convolution with a decaying noise impulse)
def reverb(x, seconds=2.2, mix=0.28):
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t / (seconds / 4.5)); ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x * (1 - mix) + wet * mix


L, R = reverb(L), reverb(R)
mix = np.stack([L, R], axis=1)
fade = np.ones(N); fade[: SR] = np.linspace(0, 1, SR); fade[-3 * SR:] = np.linspace(1, 0, 3 * SR)
mix *= fade[:, None]
mix = np.tanh(mix * 1.1)                      # gentle glue / limiter
mix /= np.max(np.abs(mix)) / 0.89
out = Path(__file__).parent / "score.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
rms = np.sqrt(np.mean(mix ** 2))
print(f"wrote {out}  rms={20 * np.log10(rms):.1f} dBFS  peak=-1 dBFS")
