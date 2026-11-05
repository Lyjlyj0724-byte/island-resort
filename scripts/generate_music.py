#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the seamless 32 second island theme (public/music/island-theme.wav).

Everything here is original and procedural: a gentle music-box arpeggio over a
warm pad, in A minor pentatonic, at a calm 75 BPM.  No samples, no drums, no
vocals, no third-party melody -- only sine partials with exponential decay
envelopes, synthesised with the Python standard library (wave/math/struct/
random/array).  A fixed random seed keeps every run identical.

The loop maths
--------------
We compose 33.5 s of audio: 10 full bars (32.0 s) plus a 1.5 s natural
continuation.  The final 32.0 s loop is then built as::

    loop[i] = comp[i]                      for i >= FADE
    loop[i] = comp[i] * (i/F) + comp[N+i] * (1 - i/F)    for i < FADE

with N = 32.0 s and FADE = 1.5 s.  Because loop[0] == comp[N] and
loop[N-1] == comp[N-1], the last sample flows straight into the first one:
the loop seam is mathematically continuous and the 1.5 s cross-fade keeps the
musical material smooth as well.

Usage (from the repository root)::

    python scripts/generate_music.py
"""

from __future__ import annotations

import array
import math
import random
import sys
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "music" / "island-theme.wav"

SR = 22050
DURATION = 32.0
BPM = 75.0
BEAT = 60.0 / BPM            # 0.8 s
BAR = 4.0 * BEAT             # 3.2 s
BARS = 10                    # 10 bars == exactly 32.0 s
N = int(round(DURATION * SR))
FADE = int(round(1.5 * SR))
TOTAL = N + FADE
TAU = math.tau

# A minor pentatonic, semitone offsets from A3 (220 Hz)
PENTA = (0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24)


def freq(degree):
    return 220.0 * 2.0 ** (PENTA[degree] / 12.0)


def add(buf, start_s, samples, gain=1.0):
    """Mix a synthesised note into the master buffer."""
    i0 = int(round(start_s * SR))
    if i0 >= len(buf):
        return
    n = min(len(samples), len(buf) - i0)
    for i in range(n):
        buf[i0 + i] += samples[i] * gain


_box_cache = {}


def music_box(degree):
    """Bright-but-soft music-box voice: harmonic partials + exp decay."""
    key = degree
    if key in _box_cache:
        return _box_cache[key]
    f = freq(degree)
    dur = 1.9
    n = int(dur * SR)
    out = [0.0] * n
    w1 = TAU * f / SR
    w2 = TAU * (f * 2.004) / SR
    w3 = TAU * (f * 3.01) / SR
    w4 = TAU * (f * 4.98) / SR
    attack = max(2, int(0.004 * SR))
    for i in range(n):
        t = i / SR
        env = math.exp(-3.1 * t)
        att = 1.0 if i >= attack else i / attack
        out[i] = att * env * (math.sin(w1 * i) + 0.30 * math.sin(w2 * i)
                              + 0.10 * math.sin(w3 * i) + 0.045 * math.sin(w4 * i))
    _box_cache[key] = out
    return out


_pad_cache = {}


def pad_voice(f):
    """Warm, slow-attack pad voice (two slightly detuned sines + breathe)."""
    key = round(f, 2)
    if key in _pad_cache:
        return _pad_cache[key]
    dur = 6.9
    n = int(dur * SR)
    out = [0.0] * n
    w1 = TAU * f / SR
    w2 = TAU * (f * 1.0035) / SR
    attack, release = 1.5, 2.0
    for i in range(n):
        t = i / SR
        env = min(1.0, t / attack) * min(1.0, (dur - t) / release)
        if env <= 0.0:
            continue
        breathe = 1.0 + 0.05 * math.sin(TAU * 0.19 * t)
        out[i] = env * breathe * (0.62 * math.sin(w1 * i) + 0.38 * math.sin(w2 * i))
    _pad_cache[key] = out
    return out


def drone_voice():
    """Continuous low A pedal; 110 Hz completes a whole number of cycles in 32 s."""
    dur = TOTAL / SR
    n = TOTAL
    out = [0.0] * n
    w1 = TAU * 110.0 / SR
    w2 = TAU * 165.0 / SR          # soft fifth
    attack, release = 2.2, 2.2
    for i in range(n):
        t = i / SR
        env = min(1.0, t / attack) * min(1.0, (dur - t) / release)
        out[i] = env * (0.72 * math.sin(w1 * i) + 0.14 * math.sin(w2 * i))
    return out


# bar index -> list of (beat position, pentatonic degree, duration in beats)
MELODY = [
    [(0.0, 3, 1.6), (1.5, 5, 0.9), (2.5, 4, 0.9), (3.5, 3, 0.7)],
    [(0.0, 4, 1.3), (1.5, 5, 0.8), (2.5, 6, 1.3), (3.5, 5, 0.8)],
    [(0.0, 6, 1.5), (1.5, 7, 1.0), (2.5, 6, 0.9), (3.5, 5, 0.9)],
    [(0.0, 4, 1.2), (1.5, 3, 0.9), (2.5, 2, 1.0), (3.5, 1, 1.6)],
    [(0.0, 2, 1.5), (1.5, 4, 0.9), (2.5, 3, 0.9), (3.5, 2, 0.7)],
    [(0.0, 3, 1.2), (1.5, 4, 0.9), (2.5, 5, 1.0), (3.5, 4, 0.8)],
    [(0.0, 5, 1.5), (1.5, 6, 1.0), (2.5, 5, 0.9), (3.5, 4, 0.9)],
    [(0.0, 3, 1.3), (1.5, 2, 0.9), (2.5, 1, 1.1), (3.5, 0, 2.0)],
    # coda: two sparse bars that breathe out
    [(0.0, 2, 2.0), (2.0, 1, 2.2)],
    [(0.0, 0, 3.0)],
]

# one chord per two bars: Am | F | C | G | Am   (loop starts and ends on Am)
CHORDS = [
    (110.00, 164.81, 220.00),   # Am : A2 E3 A3
    (87.31, 130.81, 220.00),    # F  : F2 C3 A3
    (130.81, 164.81, 196.00),   # C  : C3 E3 G3
    (98.00, 146.83, 246.94),    # G  : G2 D3 B3
    (110.00, 164.81, 220.00),   # Am : A2 E3 A3
]


def compose():
    buf = [0.0] * TOTAL
    rng = random.Random(20261105)

    # continuous low pedal (also keeps the head/tail RMS close)
    drone = drone_voice()
    add(buf, 0.0, drone, 0.055)

    # pad chords (2 bars each; the extra Am tail continues past bar 10)
    for k, chord in enumerate(CHORDS):
        start = k * 2 * BAR
        for f in chord:
            add(buf, start, pad_voice(f), 0.050)
    # ambient continuation for the cross-fade tail (bars 11+)
    for f in CHORDS[4]:
        add(buf, 10 * BAR, pad_voice(f), 0.045)

    # music-box melody, phrased with a soft echo
    for bar, notes in enumerate(MELODY):
        for beat, degree, dur_beats in notes:
            t = bar * BAR + beat * BEAT
            gain = rng.uniform(0.175, 0.225) if bar < 8 else rng.uniform(0.12, 0.165)
            note = music_box(degree)
            add(buf, t, note, gain)
            add(buf, t + 0.90, note, gain * 0.24)
            add(buf, t + 1.80, note, gain * 0.10)

    # a last high shimmer in the continuation tail (heard through the cross-fade)
    add(buf, 32.10, music_box(5), 0.10)
    add(buf, 32.10, music_box(8), 0.05)
    return buf


def build_loop(buf):
    loop = buf[:N]
    for i in range(FADE):
        w = i / FADE
        loop[i] = buf[i] * w + buf[N + i] * (1.0 - w)
    return loop


def rms(samples):
    if not samples:
        return 0.0
    return math.sqrt(sum(s * s for s in samples) / len(samples))


def write_wav(loop, peak_target=0.80):
    peak = max(abs(v) for v in loop) or 1.0
    scale = (peak_target / peak) * 32767.0
    pcm = array.array("h", (max(-32768, min(32767, int(round(v * scale)))) for v in loop))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())
    return peak * peak_target / peak


def verify(peak_target=0.80):
    problems = []
    with wave.open(str(OUT), "rb") as wav:
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)
    samples = array.array("h")
    samples.frombytes(raw)
    duration = frames / float(rate)
    peak = max(abs(s) for s in samples) / 32767.0
    head = samples[:1000]
    tail = samples[-1000:]
    rms_head = rms(head) / 32767.0
    rms_tail = rms(tail) / 32767.0
    rel = abs(rms_head - rms_tail) / max(1e-9, max(rms_head, rms_tail))
    seam = abs(samples[0] - samples[-1]) / 32767.0
    if channels != 1:
        problems.append("channels=%d (expected 1)" % channels)
    if width != 2:
        problems.append("sample width=%d bytes (expected 2 / 16-bit)" % width)
    if rate != SR:
        problems.append("sample rate=%d (expected %d)" % (rate, SR))
    if abs(duration - DURATION) > 0.001:
        problems.append("duration=%.4f s (expected %.1f)" % (duration, DURATION))
    if peak > 0.85:
        problems.append("peak=%.3f exceeds 0.85" % peak)
    if rel > 0.50:
        problems.append("head/tail RMS differ by %.1f%%" % (rel * 100))
    print("verification")
    print("  file            : %s" % OUT.relative_to(ROOT).as_posix())
    print("  format          : PCM fmt=1, %d ch, %d Hz, %d-bit"
          % (channels, rate, width * 8))
    print("  frames / length : %d / %.3f s" % (frames, duration))
    print("  bytes           : %d (%.2f MiB)"
          % (OUT.stat().st_size, OUT.stat().st_size / (1024.0 * 1024.0)))
    print("  peak            : %.3f  (target <= 0.85)" % peak)
    print("  head RMS        : %.4f   tail RMS: %.4f   rel diff: %.1f%%"
          % (rms_head, rms_tail, rel * 100))
    print("  loop seam jump  : %.5f" % seam)
    if problems:
        print("\nPROBLEMS:")
        for p in problems:
            print("  - " + p)
        return False
    print("  all checks passed")
    return True


def main():
    t0 = time.perf_counter()
    buf = compose()
    loop = build_loop(buf)
    write_wav(loop)
    elapsed = time.perf_counter() - t0
    print("island-theme.wav: %d bars @ %.0f BPM, %.1f s loop (+%.1f s cross-fade)"
          % (BARS, BPM, DURATION, FADE / SR))
    print("written in %.1fs" % elapsed)
    return 0 if verify() else 1


if __name__ == "__main__":
    sys.exit(main())
