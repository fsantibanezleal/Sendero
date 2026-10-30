import numpy as np

from pipeline.gait import fourier


def test_fit_recovers_known_coefficients():
    p = np.arange(100) / 100.0
    a = [3.0, -1.5, 0.7, 0.2, -0.1, 0.05]
    b = [-2.0, 0.9, -0.3, 0.15, 0.02, -0.04]
    y = 12.5 + sum(
        a[k - 1] * np.cos(2 * np.pi * k * p) + b[k - 1] * np.sin(2 * np.pi * k * p) for k in range(1, 7)
    )
    fit = fourier.fit(y, order=6)
    assert abs(fit["a0"] - 12.5) < 1e-6
    assert np.allclose(fit["a"], a, atol=1e-6)
    assert np.allclose(fit["b"], b, atol=1e-6)
    assert fit["rmsDeg"] < 1e-6


def test_evaluate_matches_input_samples():
    p = np.arange(100) / 100.0
    y = 5 + 4 * np.cos(2 * np.pi * p) + 2 * np.sin(2 * np.pi * 3 * p)
    fit = fourier.fit(y, order=6)
    assert np.allclose(fourier.evaluate(fit, p), y, atol=1e-6)


def test_rms_reports_residual_for_unfittable_signal():
    y = np.zeros(100)
    y[10] = 10.0  # a spike no order-6 series can follow
    assert fourier.fit(y, order=6)["rmsDeg"] > 0.5
