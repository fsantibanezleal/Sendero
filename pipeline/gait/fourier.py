"""Order-N Fourier series for one periodic gait curve over phase p in [0, 1)."""
from __future__ import annotations

import numpy as np


def _basis(p: np.ndarray, order: int) -> np.ndarray:
    cols = [np.ones_like(p)]
    for k in range(1, order + 1):
        cols.append(np.cos(2 * np.pi * k * p))
        cols.append(np.sin(2 * np.pi * k * p))
    return np.stack(cols, axis=1)


def fit(samples, order: int = 6) -> dict:
    """Least squares fit of y(p) = a0 + sum_k a_k cos(2 pi k p) + b_k sin(2 pi k p) on equally spaced samples
    p = 0, 1/n, ..., (n-1)/n. Returns a0, a, b and the RMS error of the fit in the unit of the samples."""
    y = np.asarray(samples, dtype=float)
    p = np.arange(len(y)) / len(y)
    design = _basis(p, order)
    coef, *_ = np.linalg.lstsq(design, y, rcond=None)
    rms = float(np.sqrt(np.mean((design @ coef - y) ** 2)))
    return {"a0": float(coef[0]), "a": coef[1::2].tolist(), "b": coef[2::2].tolist(), "rmsDeg": rms}


def evaluate(fit_dict: dict, p) -> np.ndarray:
    p = np.asarray(p, dtype=float)
    y = np.full_like(p, fit_dict["a0"])
    for k, (a, b) in enumerate(zip(fit_dict["a"], fit_dict["b"]), start=1):
        y = y + a * np.cos(2 * np.pi * k * p) + b * np.sin(2 * np.pi * k * p)
    return y
