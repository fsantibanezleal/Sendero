"""Master the fetched recordings and write assets/music/*.m4a plus assets/music/catalog.json.

    python -m pipeline.music.master

Chain: decode to mono 44.1 kHz float, 50 Hz high-pass (2nd order Butterworth), 1.5 s fade in and 3 s fade out,
integrated loudness -16 LUFS (ITU-R BS.1770 through pyloudnorm), true peak at or under -1 dBTP (4x oversampled)
by gain reduction, AAC in .m4a at 128 kb/s. Loudness and true peak recorded in the catalog are measured on the
decoded m4a, so the encoder is inside the measurement. A raw file that is missing is reported and skipped.
"""
from __future__ import annotations

import json
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

from pipeline import common
from pipeline.music import dsp

SR = 44100
TARGET_LUFS = -16.0
LOUDNESS_TOLERANCE = 0.3
TRUE_PEAK_MAX = -1.0
BITRATE = "128k"
LICENSE = "CC BY 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
OUT = common.REPO_ROOT / "assets" / "music"
MANIFEST = common.REPO_ROOT / "pipeline/music/manifest.json"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def decode(path) -> np.ndarray:
    cmd = [FFMPEG, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    res = subprocess.run(cmd, capture_output=True, check=True)
    return np.frombuffer(res.stdout, dtype="<f4").astype(float)


def encode(x: np.ndarray, dest) -> None:
    tmp = dest.with_name(dest.name + ".part")
    cmd = [
        FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
        "-c:a", "aac", "-b:a", BITRATE, "-ar", str(SR), "-ac", "1",
        "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
        "-movflags", "+faststart", "-f", "mp4", str(tmp),
    ]
    subprocess.run(cmd, input=x.astype("<f4").tobytes(), capture_output=True, check=True)
    tmp.replace(dest)


def master_one(src, dest) -> dict:
    """Return the measurements of the decoded m4a. Retargets when the encoder moves loudness or the peak."""
    base = dsp.fades(dsp.highpass(decode(src), SR), SR, fade_in=1.5, fade_out=3.0)
    target, ceiling = TARGET_LUFS, TRUE_PEAK_MAX - 0.5
    for _ in range(6):
        encode(dsp.normalize(base, SR, target_lufs=target, ceiling_dbtp=ceiling), dest)
        final = decode(dest)
        lufs, tp = dsp.lufs(final, SR), dsp.true_peak_dbtp(final)
        if abs(lufs - TARGET_LUFS) <= LOUDNESS_TOLERANCE and tp <= TRUE_PEAK_MAX:
            return {"durationSec": len(final) / SR, "loudnessLufs": lufs, "truePeakDbtp": tp}
        target += TARGET_LUFS - lufs
        if tp > TRUE_PEAK_MAX:
            ceiling -= tp - TRUE_PEAK_MAX + 0.1
    raise RuntimeError(f"{dest.name}: could not reach {TARGET_LUFS} LUFS and {TRUE_PEAK_MAX} dBTP")


def alternate(tracks: list[dict]) -> list[dict]:
    """Order so vocal and instrumental tracks alternate where possible, keeping manifest order inside each kind."""
    pools = {False: [t for t in tracks if not t["instrumental"]], True: [t for t in tracks if t["instrumental"]]}
    want = tracks[0]["instrumental"] if tracks else False
    out = []
    while pools[False] or pools[True]:
        pool = pools[want] or pools[not want]
        out.append(pool.pop(0))
        want = not out[-1]["instrumental"]
    return out


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    raw = common.data_root() / "music" / "raw"
    OUT.mkdir(parents=True, exist_ok=True)
    tracks, missing = [], []
    for item in manifest["items"]:
        if not item["include"]:
            continue
        src = raw / f"{item['id']}.mp3"
        if not src.exists():
            print(f"MISSING {item['id']}: run pipeline.music.fetch first or check the network")
            missing.append(item["id"])
            continue
        dest = OUT / f"{item['id']}.m4a"
        m = master_one(src, dest)
        print(f"mastered {item['id']}: {m['loudnessLufs']:.2f} LUFS, {m['truePeakDbtp']:.2f} dBTP, {m['durationSec']:.1f} s")
        tracks.append({
            "id": item["id"],
            "file": dest.name,
            "title": item["title"],
            "performer": item["performer"],
            "year": item["year"],
            "composer": item["composer"],
            "durationSec": round(m["durationSec"], 1),
            "instrumental": item["instrumental"],
            "loudnessLufs": round(m["loudnessLufs"], 2),
            "truePeakDbtp": round(m["truePeakDbtp"], 2),
            "license": LICENSE,
            "licenseUrl": LICENSE_URL,
            "source": item["url"],
            "credit": f'"{item["title"]}" {item["performer"]} (incompetech.com), licensed under Creative Commons: By Attribution 4.0',
        })
    keep = {t["file"] for t in tracks}
    for stale in OUT.glob("*.m4a"):
        if stale.name not in keep and not missing:
            stale.unlink()
    common.write_json(OUT / "catalog.json", {"version": 1, "tracks": alternate(tracks)})
    if missing:
        print(f"skipped (raw file missing): {', '.join(missing)}")
        return 3
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except common.DataRootError as exc:
        print(f"FAILED: {exc}")
        sys.exit(1)
