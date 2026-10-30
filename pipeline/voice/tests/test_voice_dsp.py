"""Tests of the whisper conversion, the distance chain, loudness and F0 measurement (written before the code)."""
import numpy as np
import pytest
from scipy.signal import lfilter, welch

from pipeline.voice import distance, measure, whisper

SR = 22050


def voiced_signal(seconds=1.5, f0=120.0):
    """A glottal pulse train through three formant resonators (500, 1500 and 2500 Hz)."""
    n = int(seconds * SR)
    x = np.zeros(n)
    x[:: int(round(SR / f0))] = 1.0
    for fc, bw in ((500, 80), (1500, 120), (2500, 160)):
        r = np.exp(-np.pi * bw / SR)
        th = 2 * np.pi * fc / SR
        x = lfilter([1.0], [1.0, -2 * r * np.cos(th), r * r], x)
    return x / np.max(np.abs(x)) * 0.5


def smoothed_log_spectrum(x, lo=300.0, hi=4000.0):
    f, p = welch(x, SR, nperseg=2048)
    k = np.ones(9) / 9
    ps = np.convolve(p, k, mode="same")
    sel = (f >= lo) & (f <= hi)
    return np.log10(ps[sel] + 1e-20)


def test_whisper_removes_pitch_keeps_envelope():
    x = voiced_signal()
    assert measure.periodicity(x, SR) > 0.5
    y = whisper.whisper_convert(x, SR, seed=1)
    assert len(y) == len(x)
    assert measure.periodicity(y, SR) < 0.3
    a, b = smoothed_log_spectrum(x), smoothed_log_spectrum(y)
    assert np.corrcoef(a, b)[0, 1] > 0.8


def test_whisper_is_reproducible_and_seed_dependent():
    x = voiced_signal(0.5)
    assert np.array_equal(whisper.whisper_convert(x, SR, seed=7), whisper.whisper_convert(x, SR, seed=7))
    assert not np.array_equal(whisper.whisper_convert(x, SR, seed=7), whisper.whisper_convert(x, SR, seed=8))


def test_whisper_silence_stays_finite():
    y = whisper.whisper_convert(np.zeros(SR // 2), SR, seed=3)
    assert np.all(np.isfinite(y)) and np.max(np.abs(y)) < 1e-6


def test_window_overlap_add_is_perfect():
    n = whisper.frame_length(SR)
    w = whisper.analysis_window(n)
    hop = n // 2
    acc = np.zeros(n * 6)
    for s in range(0, len(acc) - n + 1, hop):
        acc[s : s + n] += w * w
    assert np.allclose(acc[n : 4 * n], 1.0, atol=1e-9)


def test_distance_lowpasses_and_leaves_a_tail():
    rng = np.random.default_rng(0)
    x = rng.standard_normal(int(0.5 * SR)) * 0.1
    y = distance.distance_chain(x, SR, seed=2)

    def hf_energy(s):
        f, p = welch(s, SR, nperseg=2048)
        return float(np.sum(p[f > 6000]) * (f[1] - f[0]) * len(s))

    assert 10 * np.log10(hf_energy(y) / hf_energy(x)) <= -12.0
    assert len(y) > len(x) + int(0.4 * SR)  # lead silence plus a tail
    assert len(y) <= len(x) + int(0.4 * SR) + int(2.0 * SR) + SR // 10

    def rms(s):
        return np.sqrt(np.mean(s**2) + 1e-30)

    end = int(0.4 * SR) + len(x)
    early = rms(y[end + int(0.1 * SR) : end + int(0.3 * SR)])
    late = rms(y[end + int(0.8 * SR) : end + int(1.0 * SR)])
    assert 20 * np.log10(early / late) > 8.0
    assert np.max(np.abs(y[: int(0.35 * SR)])) < 1e-3  # silence before the voice


def test_room_impulse_response_shape():
    h = distance.room_impulse_response(SR, seed=5)
    assert len(h) >= int(1.4 * SR)
    assert np.isclose(np.sum(h**2), 1.0)
    assert np.array_equal(h, distance.room_impulse_response(SR, seed=5))


def test_loudness_target_and_true_peak():
    rng = np.random.default_rng(1)
    t = np.arange(3 * SR) / SR
    x = (rng.standard_normal(len(t)) * 0.05) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.5 * t))
    x[5000] = 0.9  # a spike that forces the limiter
    y = measure.normalize_loudness(x, SR, target_lufs=-20.0, ceiling_dbtp=-3.0)
    assert abs(measure.integrated_lufs(y, SR) - (-20.0)) <= 0.3
    assert measure.true_peak_dbtp(y, SR) <= -3.0


def test_f0_recovers_synthetic_tones():
    t = np.arange(SR) / SR
    for f in (200.0, 110.0):
        x = 0.3 * np.sin(2 * np.pi * f * t) + 0.15 * np.sin(2 * np.pi * 2 * f * t)
        got = measure.median_f0(x, SR)
        assert abs(got - f) / f < 0.03


def test_pick_voices_rule():
    table = {"a": 190.0, "b": 120.0, "c": 170.0, "d": 140.0}
    from pipeline.voice import select

    assert select.pick(table, ["a", "b", "c", "d"], "female") == "a"
    assert select.pick(table, ["b", "a", "c", "d"], "male") == "b"
    assert select.pick({"x": 160.0}, ["x"], "female") is None
    assert select.pick({"x": 160.0}, ["x"], "male") is None
