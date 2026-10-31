"""Orchestrator: synthesize, select voices by measured F0, soften, loudness, encode, write the catalog.

Run from the repository root:  pipeline/voice/.venv/Scripts/python.exe -m pipeline.voice.render
Environment: SENDERO_MODELS_ROOT (models root), SENDERO_SCRATCH (scratch folder, required: a folder in the device's temp root, never the system temp).
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import soundfile as sf

from pipeline.voice import distance, measure, select, synth, whisper

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "assets" / "voice"
MESSAGES = json.loads((HERE / "messages.json").read_text(encoding="utf-8"))
SPOKEN = json.loads((HERE / "spoken.json").read_text(encoding="utf-8"))
VOICE_GENDER = {
    "mujer": "female", "hombre": "male", "mujer-2": "female", "hombre-2": "male", "mujer-3": "female",
    "hombre-3": "male", "hombre-4": "male", "hombre-5": "male",
}
# Second voices, for variety between visits (the owner, 2026-10-31). Chosen by hand among the candidates whose measured
# F0 meets the same rule; the first voices are still chosen by the rule.
EXTRA_VOICES = {
    "mujer-2": "kokoro-ef_dora", "hombre-2": "kokoro-em_santa", "mujer-3": "es_ES-sharvard-medium-1",
    "hombre-3": "es_ES-davefx-medium", "hombre-4": "es_ES-sharvard-medium-0",
    "hombre-5": "es_ES-carlfm-x_low",
}
# The tone of each added voice: (breath, low-pass Hz, room), so that each has its own warmth, air and space.
VOICE_TONE = {
    "mujer-3": (0.24, 6500.0, 0.16), "hombre-3": (0.10, 5000.0, 0.14),
    "hombre-4": (0.26, 7000.0, 0.10), "hombre-5": (0.16, 5800.0, 0.20),
}
TARGET_LUFS = -20.0
TRUE_PEAK_CEILING = -3.0
LUFS_TOLERANCE = 0.3
SR = synth.SAMPLE_RATE
OUT_SR = 44100
MIN_DURATION, MAX_DURATION = 1.0, 6.0
SELECTION_PATH = HERE / "selection.json"


def scratch_dir() -> Path:
    value = os.environ.get("SENDERO_SCRATCH")
    if not value:
        raise SystemExit("Set SENDERO_SCRATCH to a folder in your temp root, for example <temp root>/sendero-voice.")
    p = Path(value)
    p.mkdir(parents=True, exist_ok=True)
    return p


def clip_seed(voice_id: str, message_id: str) -> int:
    return int.from_bytes(hashlib.sha256(f"{voice_id}:{message_id}".encode()).digest()[:4], "big")


def encode_m4a(x: np.ndarray, sr: int, dest: Path, scratch: Path) -> None:
    """Mono AAC .m4a, 44.1 kHz, 96 kb/s, with the ffmpeg of imageio-ffmpeg; no metadata so runs are byte-stable."""
    wav = scratch / "enc.wav"
    sf.write(wav, x, sr, subtype="FLOAT")
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", str(OUT_SR),
                    "-c:a", "aac", "-b:a", "96k", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
                    str(dest)], check=True)


def decode_m4a(path: Path, scratch: Path) -> tuple[np.ndarray, int]:
    wav = scratch / "dec.wav"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(path), "-ac", "1", "-c:a", "pcm_f32le",
                    str(wav)], check=True)
    x, sr = sf.read(wav, dtype="float64")
    return x, sr


def spoken_text(candidate_id: str, message: dict) -> str:
    """What the voice says for a message: the override for this model if any, else the message as a sentence
    (first letter upper case, final period). The words are the message's; spoken.json explains each override."""
    override = SPOKEN["overrides"].get(candidate_id, {}).get(message["id"])
    if override is not None:
        return override
    t = message["text"].strip()
    t = t[:1].upper() + t[1:]
    return t if t.endswith((".", "!", "?")) else t + "."


def neutral_speech(c: synth.Candidate, message: dict, scratch: Path) -> tuple[np.ndarray, int]:
    """Neutral synthesis of one message, cached as float32 WAV in the scratch folder (the engines are slow to load).

    Always read back through the file so a cached and an uncached run give identical audio."""
    text = spoken_text(c.id, message)
    key = hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]
    path = scratch / "neutral" / c.id / f"{message['id']}-{key}.wav"  # a new spoken text never reuses an old file
    if not path.exists():
        x, sr = synth.synthesize(c, text)
        path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(path, x, sr, subtype="FLOAT")
    x, sr = sf.read(path, dtype="float64")
    return x, sr


def measure_candidates(scratch: Path) -> dict:
    """Synthesize m01 with every candidate; return {id: measurements}. An unreachable candidate is reported and skipped."""
    m01 = next(m for m in MESSAGES if m["id"] == "m01")
    table = {}
    for c in synth.CANDIDATES:
        try:
            x, sr = neutral_speech(c, m01, scratch)
        except Exception as e:
            print(f"candidate {c.id} unavailable: {e}", file=sys.stderr)
            continue
        table[c.id] = {"medianF0Hz": round(measure.median_f0(x, sr), 3), "neutralPeriodicity": round(measure.periodicity(x, sr), 3)}
        print(f"candidate {c.id}: F0 {table[c.id]['medianF0Hz']} Hz")
    return table


def choose_voices(table: dict) -> dict:
    order = [c.id for c in synth.CANDIDATES]
    f0 = {k: v["medianF0Hz"] for k, v in table.items()}
    chosen = {}
    for vid, gender in VOICE_GENDER.items():
        pick = select.pick(f0, order, gender)
        if pick is None:
            raise SystemExit(f"BLOCKED: no candidate qualifies for {vid} ({gender}); measured F0: {json.dumps(f0, sort_keys=True)}")
        chosen[vid] = pick
    return chosen


def render_clip(candidate: synth.Candidate, voice_id: str, message: dict, scratch: Path) -> dict:
    neutral, sr = neutral_speech(candidate, message, scratch)
    seed = clip_seed(voice_id, message["id"])
    breath, lowpass, wet = VOICE_TONE.get(voice_id, (whisper.BREATH, distance.CLOSE_LOWPASS_HZ, distance.CLOSE_WET))
    far = distance.close_chain(whisper.add_breath(neutral, sr, seed, breath), sr, seed, lowpass, wet)
    dest = OUT / voice_id / f"{message['id']}.m4a"
    margin = 0.3  # headroom for the AAC encoder; the ceiling and the target are checked on the decoded file
    final = measure.normalize_loudness(far, sr, TARGET_LUFS, TRUE_PEAK_CEILING, margin_db=margin)
    for _ in range(6):
        encode_m4a(final, sr, dest, scratch)
        dec, dsr = decode_m4a(dest, scratch)
        error = measure.integrated_lufs(dec, dsr) - TARGET_LUFS
        over = measure.true_peak_dbtp(dec, dsr) > TRUE_PEAK_CEILING
        if abs(error) <= 0.1 and not over:
            break
        if over:
            margin += 0.4
            final = measure.normalize_loudness(far, sr, TARGET_LUFS, TRUE_PEAK_CEILING, margin_db=margin)
        else:  # the encoder moved the loudness: correct the gain by the decoded error and encode again
            final = final * 10 ** (-error / 20)
    return {
        "message": message["id"], "voice": voice_id, "file": f"{voice_id}/{message['id']}.m4a",
        "durationSec": round(len(dec) / dsr, 3),
        "loudnessLufs": round(measure.integrated_lufs(dec, dsr), 3),
        "truePeakDbtp": round(measure.true_peak_dbtp(dec, dsr), 3),
        "periodicity": round(measure.periodicity(dec, dsr), 3),
        "neutralPeriodicity": round(measure.periodicity(neutral, sr), 3),
    }


def validate_catalog(c: dict) -> None:
    """Raise ValueError when the catalog breaks the version 1 contract or an invariant."""
    def need(cond, msg):
        if not cond:
            raise ValueError(msg)

    need(c.get("version") == 1, "version must be 1")
    messages = json.loads((HERE / "messages.json").read_text(encoding="utf-8"))
    need(c.get("messages") == messages, "message texts differ from messages.json")
    voices = {v.get("id"): v for v in c.get("voices", [])}
    need(set(voices) == set(VOICE_GENDER), f"voices must be {sorted(VOICE_GENDER)}")
    for vid, v in voices.items():
        for k in ("gender", "engine", "model", "license", "medianF0Hz"):
            need(k in v, f"voice {vid} lacks {k}")
        need(v["gender"] == VOICE_GENDER[vid], f"voice {vid} has the wrong gender label")
        if v["gender"] == "female":
            need(v["medianF0Hz"] >= select.FEMALE_MIN_HZ, "mujer F0 contradicts the rule")
        else:
            need(0 < v["medianF0Hz"] <= select.MALE_MAX_HZ, "hombre F0 contradicts the rule")
    clips = c.get("clips", [])
    need(len(clips) == len(messages) * len(voices), "one clip per message and voice")
    seen = set()
    for x in clips:
        for k in ("message", "voice", "file", "durationSec", "loudnessLufs", "truePeakDbtp", "periodicity"):
            need(k in x, f"clip lacks {k}")
        need((x["message"], x["voice"]) not in seen, "duplicate clip")
        seen.add((x["message"], x["voice"]))
        need(x["file"] == f"{x['voice']}/{x['message']}.m4a", "file name must be <voice>/<message>.m4a")
        need(MIN_DURATION <= x["durationSec"] <= MAX_DURATION, f"duration out of range in {x['file']}")
        need(x["truePeakDbtp"] <= TRUE_PEAK_CEILING, f"true peak too high in {x['file']}")
        need(abs(x["loudnessLufs"] - TARGET_LUFS) <= LUFS_TOLERANCE, f"loudness off target in {x['file']}")


def dumps_catalog(c: dict) -> str:
    return json.dumps(c, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str]) -> int:
    scratch = scratch_dir()
    if argv[:1] == ["--synth-only"]:  # warm the neutral cache for the given candidate ids (all messages)
        for cid in argv[1:]:
            for m in MESSAGES:
                neutral_speech(synth.BY_ID[cid], m, scratch)
            print(f"neutral speech cached for {cid}")
        return 0
    table = measure_candidates(scratch)
    chosen = {**choose_voices(table), **EXTRA_VOICES}
    # --add: render only the voices the committed catalog does not have yet, and keep its clips.
    previous = json.loads((OUT / "catalog.json").read_text(encoding="utf-8")) if argv[:1] == ["--add"] else None
    have = {v["id"] for v in previous["voices"]} if previous else set()
    SELECTION_PATH.write_text(
        dumps_catalog({"rule": {"femaleMinHz": select.FEMALE_MIN_HZ, "maleMaxHz": select.MALE_MAX_HZ},
                       "candidates": table, "chosen": chosen}), encoding="utf-8", newline="\n")
    voices = [v for v in previous["voices"] if v["id"] in chosen] if previous else []
    clips = [x for x in previous["clips"] if x["voice"] in have] if previous else []
    for vid, cid in chosen.items():
        if vid in have:
            continue
        cand = synth.BY_ID[cid]
        voices.append({"id": vid, "gender": VOICE_GENDER[vid], "engine": cand.engine, "model": cid, "license": cand.license,
                       "medianF0Hz": table[cid]["medianF0Hz"]})
        for m in MESSAGES:
            clip = render_clip(cand, vid, m, scratch)
            clips.append({k: v for k, v in clip.items() if k != "neutralPeriodicity"})
            print(f"{clip['file']}: {clip['durationSec']} s, {clip['loudnessLufs']} LUFS, {clip['truePeakDbtp']} dBTP, "
                  f"periodicity {clip['periodicity']} (neutral {clip['neutralPeriodicity']})")
    catalog = {"version": 1, "messages": MESSAGES, "voices": voices, "clips": clips}
    validate_catalog(catalog)
    (OUT / "catalog.json").write_text(dumps_catalog(catalog), encoding="utf-8", newline="\n")
    print("catalog written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
