"""Mastering DSP: high-pass, fades, ITU-R BS.1770 loudness, true peak, gain-reduction limiting."""
from __future__ import annotations

import numpy as np
import pyloudnorm
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

OVERSAMPLE = 4
LOOKAHEAD_SEC = 0.005
HIGHPASS_HZ = 50.0


def highpass(x: np.ndarray, sr: int, cutoff_hz: float = HIGHPASS_HZ) -> np.ndarray:
    """Second order Butterworth high-pass against rumble."""
    sos = signal.butter(2, cutoff_hz, btype="highpass", fs=sr, output="sos")
    return signal.sosfilt(sos, x)


def fades(x: np.ndarray, sr: int, fade_in: float = 1.5, fade_out: float = 3.0) -> np.ndarray:
    """Raised-cosine fade in and fade out; samples between them are untouched."""
    y = np.array(x, dtype=float, copy=True)
    n_in, n_out = int(round(fade_in * sr)), int(round(fade_out * sr))
    if n_in:
        y[:n_in] *= 0.5 * (1.0 - np.cos(np.pi * np.arange(n_in) / n_in))
    if n_out:
        y[-n_out:] *= 0.5 * (1.0 + np.cos(np.pi * np.arange(n_out) / (n_out - 1)))
    return y


def lufs(x: np.ndarray, sr: int) -> float:
    return float(pyloudnorm.Meter(sr).integrated_loudness(np.asarray(x, dtype=float)))


def true_peak_dbtp(x: np.ndarray) -> float:
    """True peak on a 4x oversampled signal, in dBTP."""
    over = signal.resample_poly(np.asarray(x, dtype=float), OVERSAMPLE, 1)
    peak = float(np.max(np.abs(over)))
    return float("-inf") if peak == 0.0 else 20.0 * np.log10(peak)


def limit(x: np.ndarray, sr: int, ceiling_dbtp: float) -> np.ndarray:
    """Lookahead gain reduction so the oversampled peak stays at or under the ceiling."""
    ceiling = 10.0 ** (ceiling_dbtp / 20.0)
    over = signal.resample_poly(x, OVERSAMPLE, 1)
    env = np.max(np.abs(over[: len(x) * OVERSAMPLE]).reshape(-1, OVERSAMPLE), axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(env, 1e-12))
    width = max(3, int(round(LOOKAHEAD_SEC * sr)))
    gain = uniform_filter1d(minimum_filter1d(need, size=width, mode="nearest"), size=width, mode="nearest")
    return x * np.minimum(gain, 1.0)


def normalize(
    x: np.ndarray,
    sr: int,
    target_lufs: float = -16.0,
    ceiling_dbtp: float = -1.5,
    tolerance_lu: float = 0.05,
    max_passes: int = 12,
) -> np.ndarray:
    """Gain to the integrated-loudness target, then limit by gain reduction when the true peak would exceed the
    ceiling; repeated until loudness is within tolerance and the true peak is at or under the ceiling."""
    y = np.asarray(x, dtype=float)
    for _ in range(max_passes):
        y = y * 10.0 ** ((target_lufs - lufs(y, sr)) / 20.0)
        if true_peak_dbtp(y) > ceiling_dbtp:
            y = limit(y, sr, ceiling_dbtp)
        if abs(lufs(y, sr) - target_lufs) <= tolerance_lu and true_peak_dbtp(y) <= ceiling_dbtp + 0.05:
            return y
    raise RuntimeError(
        f"normalization did not converge: {lufs(y, sr):.2f} LUFS, {true_peak_dbtp(y):.2f} dBTP"
    )
