"""The distance chain: low-pass, synthesized room, pre-delay, wet/dry, lead silence and a decaying tail."""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

LOWPASS_HZ = 4500.0
RT60_SECONDS = 1.4
TAIL_LOWPASS_HZ = 6000.0
PREDELAY_SECONDS = 0.025
# Wet 0.25: at 0.55 the room smeared the whispered consonants (Whisper small word error rate 0.81 against 0.18
# before the chain); at 0.25 with the same room and low-pass it was 0.19 (sweep of 2026-10-30, docs/voice.md).
WET = 0.25
DRY = 0.75
LEAD_SECONDS = 0.4
MAX_TAIL_SECONDS = 2.0
DECAY_FLOOR_DB = -60.0
_EARLY_MS = (8.0, 13.0, 19.0, 26.0, 33.0, 40.0)
_EARLY_GAINS = (0.5, 0.42, 0.35, 0.3, 0.25, 0.2)


# The close chain (2026-10-30): the owner found the whisper "so digital", and the naturalness score agreed (UTMOS 1.3
# whispered against 3.3 here, on 3.5 for the clean voice), so the voice now stays a voice, soft and near.
CLOSE_LOWPASS_HZ = 7000.0
CLOSE_WET = 0.12
CLOSE_ROOM_SECONDS = 0.7
CLOSE_DECAY = 4.0


def close_chain(x: np.ndarray, sr: int, seed: int, lowpass_hz: float = CLOSE_LOWPASS_HZ, wet_mix: float = CLOSE_WET) -> np.ndarray:
    """A soft voice in a small warm room: gentle low-pass, a short wet mix, lead silence."""
    x = np.asarray(x, dtype=np.float64)
    lp = sosfilt(butter(2, lowpass_hz, btype="lowpass", fs=sr, output="sos"), x)
    h = room_impulse_response(sr, seed)[: int(CLOSE_ROOM_SECONDS * sr)]
    h = h * np.exp(-np.arange(len(h)) / sr * CLOSE_DECAY)
    wet = fftconvolve(lp, h)
    y = np.zeros(len(wet))
    y[: len(lp)] += lp
    y += wet_mix * wet / max(1e-9, np.sqrt(np.sum(h**2)))
    return np.concatenate([np.zeros(int(LEAD_SECONDS * sr)), y])


def room_impulse_response(sr: int, seed: int) -> np.ndarray:
    """6 early reflections (8 to 40 ms, gains 0.5 to 0.2) plus a seeded Gaussian-noise tail with RT60 1.4 s; unit energy."""
    rng = np.random.default_rng(seed)
    n = int(RT60_SECONDS * 1.15 * sr)
    t = np.arange(n) / sr
    tail = rng.standard_normal(n) * 10 ** (DECAY_FLOOR_DB / 20 * t / RT60_SECONDS)
    tail = sosfilt(butter(2, TAIL_LOWPASS_HZ, btype="lowpass", fs=sr, output="sos"), tail)
    start = int(0.040 * sr)
    tail[:start] = 0.0
    tail *= 0.18 / (np.sqrt(np.mean(tail[start : start + int(0.05 * sr)] ** 2)) + 1e-12)
    h = tail
    for ms, g in zip(_EARLY_MS, _EARLY_GAINS):
        h[int(round(ms * sr / 1000))] += g
    return h / np.sqrt(np.sum(h**2))


def distance_chain(x: np.ndarray, sr: int, seed: int) -> np.ndarray:
    """Make a clip sound far away and behind: returns lead silence + voice + reverb tail (tail cut at -60 dB, max 2 s)."""
    x = np.asarray(x, dtype=np.float64)
    lp = sosfilt(butter(2, LOWPASS_HZ, btype="lowpass", fs=sr, output="sos"), x)
    h = room_impulse_response(sr, seed)
    wet = fftconvolve(lp, h)
    pre = int(round(PREDELAY_SECONDS * sr))
    total = len(wet) + pre
    mix = np.zeros(total)
    mix[: len(lp)] += DRY * lp
    mix[pre : pre + len(wet)] += WET * wet
    voice_end = len(x)
    # tail: keep up to MAX_TAIL_SECONDS after the voice, cut where the 20 ms RMS falls below -60 dB of the peak
    win = max(1, int(0.020 * sr))
    env = np.sqrt(np.convolve(mix**2, np.ones(win) / win, mode="same") + 1e-30)
    floor = np.max(env) * 10 ** (DECAY_FLOOR_DB / 20)
    above = np.nonzero(env[voice_end:] > floor)[0]
    tail = int(above[-1]) + 1 if len(above) else 0
    tail = min(tail, int(MAX_TAIL_SECONDS * sr))
    mix = mix[: voice_end + tail]
    fade = min(len(mix), int(0.05 * sr))
    mix[-fade:] *= np.linspace(1.0, 0.0, fade)
    return np.concatenate([np.zeros(int(LEAD_SECONDS * sr)), mix])
