"""Measurements and loudness: F0, periodicity, integrated loudness, true peak, normalization."""
from __future__ import annotations

import librosa
import numpy as np
import pyloudnorm
from scipy.signal import resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d

F0_MIN_HZ = 60.0
F0_MAX_HZ = 400.0


def median_f0(x: np.ndarray, sr: int) -> float:
    """Median F0 in Hz of the voiced frames (librosa.pyin, 60 to 400 Hz); 0.0 when nothing is voiced."""
    f0, voiced, _ = librosa.pyin(np.asarray(x, dtype=np.float32), fmin=F0_MIN_HZ, fmax=F0_MAX_HZ, sr=sr)
    v = f0[voiced & np.isfinite(f0)]
    return float(np.median(v)) if len(v) else 0.0


def periodicity(x: np.ndarray, sr: int) -> float:
    """Median over 40 ms frames above -40 dBFS RMS of the maximum normalized autocorrelation at lags 2.5 to 12.5 ms."""
    n = int(round(0.040 * sr))
    lo, hi = int(round(0.0025 * sr)), int(round(0.0125 * sr))
    vals = []
    for s in range(0, len(x) - n + 1, n // 2):
        fr = np.asarray(x[s : s + n], dtype=np.float64)
        fr = fr - fr.mean()
        e = float(np.dot(fr, fr))
        if e <= 0 or 10 * np.log10(e / n + 1e-30) <= -40.0:
            continue
        spec = np.fft.rfft(fr, 2 * n)
        ac = np.fft.irfft(spec * np.conj(spec))[: hi + 1] / e
        vals.append(float(np.max(ac[lo : hi + 1])))
    return float(np.median(vals)) if vals else 0.0


def integrated_lufs(x: np.ndarray, sr: int) -> float:
    return float(pyloudnorm.Meter(sr).integrated_loudness(np.asarray(x, dtype=np.float64)))


def true_peak_dbtp(x: np.ndarray, sr: int) -> float:
    """True peak in dBTP from a 4x oversampled signal (BS.1770 style)."""
    up = resample_poly(np.asarray(x, dtype=np.float64), 4, 1)
    return float(20 * np.log10(np.max(np.abs(up)) + 1e-12))


def _limit(x: np.ndarray, sr: int, ceiling_db: float) -> np.ndarray:
    """Smooth look-ahead peak limiter on the 4x oversampled peak envelope; keeps the true peak at the ceiling."""
    ceil = 10 ** (ceiling_db / 20)
    up = resample_poly(x, 4, 1)
    need = np.minimum(1.0, ceil / (np.abs(up) + 1e-12))
    w = int(0.004 * sr * 4)
    g = minimum_filter1d(need, size=2 * w + 1)
    g = uniform_filter1d(g, size=2 * w + 1)
    g = np.minimum(g, need)
    g = resample_poly(g, 1, 4)[: len(x)]
    g = np.pad(g, (0, len(x) - len(g)), constant_values=1.0)
    return x * g


def normalize_loudness(x: np.ndarray, sr: int, target_lufs: float = -20.0, ceiling_dbtp: float = -3.0,
                       margin_db: float = 0.3) -> np.ndarray:
    """Gain to the integrated loudness target, then a limiter if the true peak would exceed the ceiling."""
    x = np.asarray(x, dtype=np.float64)
    y = x * 10 ** ((target_lufs - integrated_lufs(x, sr)) / 20)
    ceiling = ceiling_dbtp - margin_db
    for _ in range(4):
        if true_peak_dbtp(y, sr) <= ceiling + 1e-6:
            break
        y = _limit(y, sr, ceiling)
        y = y * 10 ** ((target_lufs - integrated_lufs(y, sr)) / 20)
    return y
