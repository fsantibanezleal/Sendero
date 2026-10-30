import numpy as np

from pipeline.music import dsp

SR = 44100


def tone(seconds=12.0, freq=1000.0, amp=0.05):
    t = np.arange(int(SR * seconds)) / SR
    return amp * np.sin(2 * np.pi * freq * t)


def test_normalize_lands_on_target_loudness_and_peak():
    y = dsp.normalize(tone(), SR, target_lufs=-16.0, ceiling_dbtp=-1.5)
    assert abs(dsp.lufs(y, SR) - (-16.0)) < 0.3
    assert dsp.true_peak_dbtp(y) <= -1.0


def test_normalize_limits_a_spiky_signal():
    rng = np.random.default_rng(1)
    y = tone(amp=0.03)
    idx = rng.integers(0, len(y), 40)
    y[idx] += 0.6  # clicks that would break the ceiling at -16 LUFS
    out = dsp.normalize(y, SR, target_lufs=-16.0, ceiling_dbtp=-1.5)
    assert dsp.true_peak_dbtp(out) <= -1.0
    assert abs(dsp.lufs(out, SR) - (-16.0)) < 1.0


def test_true_peak_reads_intersample_peaks():
    # a sine at fs/4 with a 45 degree phase has sample peaks 3 dB under its true peak
    t = np.arange(4096)
    y = 0.5 * np.sin(2 * np.pi * (SR / 4) * t / SR + np.pi / 4) * np.sqrt(2)
    sample_peak = 20 * np.log10(np.max(np.abs(y)))
    assert dsp.true_peak_dbtp(y) > sample_peak + 0.5


def test_highpass_removes_rumble_keeps_1khz():
    low = dsp.highpass(tone(freq=10.0, amp=0.5), SR)
    mid = dsp.highpass(tone(freq=1000.0, amp=0.5), SR)
    assert np.std(low[SR:]) < 0.1 * np.std(tone(freq=10.0, amp=0.5))
    assert abs(np.std(mid[SR:]) / np.std(tone(freq=1000.0, amp=0.5)) - 1) < 0.01


def test_fades_shape():
    y = dsp.fades(np.ones(SR * 10), SR, fade_in=1.5, fade_out=3.0)
    assert y[0] == 0.0 and y[-1] == 0.0
    assert y[int(SR * 1.5) + 10] == 1.0 and y[-int(SR * 3.0) - 10] == 1.0
    assert 0.0 < y[int(SR * 0.75)] < 1.0
