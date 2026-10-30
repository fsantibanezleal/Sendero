"""Intelligibility of the clips: an automatic speech recognizer transcribes each clip and the word error rate (WER)
against the message is recorded.

The recognizer is OpenAI Whisper small (`openai/whisper-small`, MIT licence) through Hugging Face `transformers`, forced
to Spanish. It is a measurement tool only: nothing of it ships in the app. A whisper heard from a distance is harder for
a recognizer than for a person, so the WER is an upper bound of what a listener misses; it is used to compare settings
and to catch a clip whose words are lost.

Run from the repository root:  pipeline/voice/.venv/Scripts/python.exe -m pipeline.voice.intelligibility
Environment: HF_HOME (Hugging Face cache, in the models root) and SENDERO_SCRATCH (as for render).
Writes pipeline/voice/intelligibility.json.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np

ASR_MODEL = "openai/whisper-small"
ASR_RATE = 16000
HERE = Path(__file__).resolve().parent
OUT = HERE / "intelligibility.json"


def words(text: str) -> list[str]:
    """Lower case, accents removed, punctuation removed, split on spaces."""
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z ]", " ", t).split()


def word_error_rate(reference: str, heard: str) -> float:
    """(substitutions + deletions + insertions) / reference words, by word-level Levenshtein distance."""
    r, h = words(reference), words(heard)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))


class Recognizer:
    """Whisper small, Spanish, on the CPU; loaded once."""

    def __init__(self, model: str = ASR_MODEL) -> None:
        from transformers import pipeline  # heavy import, only when a measurement runs

        self._asr = pipeline("automatic-speech-recognition", model=model, device="cpu")

    def transcribe(self, x: np.ndarray, sr: int) -> str:
        import librosa

        y = librosa.resample(np.asarray(x, dtype=np.float32), orig_sr=sr, target_sr=ASR_RATE)
        y = y / max(1e-6, float(np.max(np.abs(y)))) * 0.5  # same level for every clip: loudness is not the question
        out = self._asr({"raw": y, "sampling_rate": ASR_RATE}, generate_kwargs={"language": "spanish", "task": "transcribe"})
        return str(out["text"]).strip()


def main(argv: list[str]) -> int:
    from pipeline.voice import render

    catalog = json.loads((render.OUT / "catalog.json").read_text(encoding="utf-8"))
    texts = {m["id"]: m["text"] for m in catalog["messages"]}
    scratch = render.scratch_dir()
    asr = Recognizer()
    rows = []
    for clip in catalog["clips"]:
        x, sr = render.decode_m4a(render.OUT / clip["file"], scratch)
        heard = asr.transcribe(x, sr)
        wer = round(word_error_rate(texts[clip["message"]], heard), 3)
        rows.append({"file": clip["file"], "heard": heard, "wer": wer})
        print(f"{clip['file']}: WER {wer:.2f} '{heard}'", flush=True)
    result = {"model": ASR_MODEL, "meanWer": round(float(np.mean([r["wer"] for r in rows])), 3), "clips": rows}
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"mean WER {result['meanWer']:.2f}; written {OUT.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
