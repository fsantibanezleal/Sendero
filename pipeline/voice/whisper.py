"""Normal speech to whisper: LPC analysis, noise excitation, formant shift (Cotescu et al. 2019, DOI 10.1109/LSP.2019.2961213).

Per frame the speech is the all-pole model x[n] = e[n] - sum_k a_k x[n-k] (Atal and Hanauer 1971). The voiced
excitation e[n] is replaced by white noise with the RMS of the frame's LPC residual, the pole angles are raised
and the pole radii are shrunk, and the all-pole filter 1 / A'(z) resynthesizes the frame.
"""
from __future__ import annotations

import librosa
import numpy as np
from scipy.signal import butter, lfilter, sosfilt

SAMPLE_RATE = 22050
PREEMPHASIS = 0.97
FRAME_SECONDS = 0.025
LPC_ORDER = 24
ANGLE_FACTOR = 1.08
RADIUS_FACTOR = 0.985
HIGHPASS_HZ = 250.0
_MAX_ANGLE = 0.999 * np.pi


def frame_length(sr: int) -> int:
    """Samples per 25 ms frame, forced even so a 50 percent hop is an integer."""
    n = int(round(FRAME_SECONDS * sr))
    return n + (n % 2)


def analysis_window(n: int) -> np.ndarray:
    """Periodic sqrt-Hann window: its square is a periodic Hann, which sums to 1 at 50 percent overlap."""
    return np.sqrt(0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n) / n))


def shift_poles(a: np.ndarray, angle_factor: float = ANGLE_FACTOR, radius_factor: float = RADIUS_FACTOR) -> np.ndarray:
    """Raise every pole angle by `angle_factor` (clipped below pi) and scale every radius by `radius_factor`."""
    roots = np.roots(a)
    r = np.minimum(np.abs(roots), 0.9999) * radius_factor
    th = np.angle(roots)
    th = np.sign(th) * np.minimum(np.abs(th) * angle_factor, _MAX_ANGLE)
    new = r * np.exp(1j * th)
    return np.real(np.poly(new))


def whisper_convert(x: np.ndarray, sr: int, seed: int) -> np.ndarray:
    """Convert a speech signal to a whisper of the same length; deterministic for a given seed."""
    x = np.asarray(x, dtype=np.float64)
    rng = np.random.default_rng(seed)
    emph = lfilter([1.0, -PREEMPHASIS], [1.0], x)
    n = frame_length(sr)
    hop = n // 2
    w = analysis_window(n)
    pad = n
    sig = np.concatenate([np.zeros(pad), emph, np.zeros(pad + n)])
    out = np.zeros_like(sig)
    for s in range(0, len(sig) - n + 1, hop):
        fr = sig[s : s + n] * w
        if np.sqrt(np.mean(fr**2)) < 1e-7:
            continue
        a = librosa.lpc(fr + 1e-9 * rng.standard_normal(n), order=LPC_ORDER)
        if not np.all(np.isfinite(a)):
            continue
        resid = lfilter(a, [1.0], fr)
        gain = np.sqrt(np.mean(resid**2))
        exc = rng.standard_normal(n) * gain
        syn = lfilter([1.0], shift_poles(a), exc)
        out[s : s + n] += syn * w
    y = out[pad : pad + len(x)]
    y = lfilter([1.0], [1.0, -PREEMPHASIS], y)
    sos = butter(2, HIGHPASS_HZ, btype="highpass", fs=sr, output="sos")
    return sosfilt(sos, y)


BREATH = 0.18


def add_breath(x: np.ndarray, sr: int, seed: int, amount: float = BREATH) -> np.ndarray:
    """The voice with a little of its own whisper under it, at `amount` of its level: breath, not noise."""
    w = whisper_convert(x, sr, seed)
    return x + amount * w * np.sqrt(np.mean(x**2) / max(1e-12, np.mean(w**2)))
