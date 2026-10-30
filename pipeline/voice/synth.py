"""Neutral speech synthesis: download the voice models (hash recorded) and render the messages with Piper.

The Piper engine (piper-tts, GPL-3.0) is used as a tool inside the offline pipeline only; it is never committed
or shipped. The voice models are never committed either: they live in the models root.
"""
from __future__ import annotations

import functools
import hashlib
import json
import os
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
LOCK_PATH = HERE / "models.lock.json"
PIPER_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX"
KOKORO_BASE = "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main"
PIPER_LENGTH_SCALE = 1.3  # gentle pace
KOKORO_SPEED = 0.8  # gentle pace
SAMPLE_RATE = 22050  # the working rate of the whole pipeline


@dataclass(frozen=True)
class Candidate:
    id: str  # unique, e.g. es_MX-claude-high or kokoro-ef_dora
    engine: str  # piper or kokoro
    license: str  # licence of the voice (repository and dataset)
    gender_hint: str  # only a note; the assignment is made by the measured F0
    files: tuple  # ((relative path, url, published sha256 or None), ...), the first one is the model
    voice: str = ""  # kokoro voice name

    @property
    def folder(self) -> str:
        return "kokoro-82m" if self.engine == "kokoro" else self.id


def _piper(name: str, speaker: str, quality: str, lic: str, sha: str) -> Candidate:
    base = f"{PIPER_BASE}/{speaker}/{quality}/{name}"
    return Candidate(name, "piper", lic, "unknown", ((f"{name}.onnx", f"{base}.onnx", sha), (f"{name}.onnx.json", f"{base}.onnx.json", None)))


def _kokoro(voice: str, sha: str) -> Candidate:
    files = (
        ("kokoro-v1_0.pth", f"{KOKORO_BASE}/kokoro-v1_0.pth", "496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4"),
        ("config.json", f"{KOKORO_BASE}/config.json", None),
        (f"voices/{voice}.pt", f"{KOKORO_BASE}/voices/{voice}.pt", sha),
    )
    return Candidate(f"kokoro-{voice}", "kokoro", "Apache-2.0 (hexgrad/Kokoro-82M weights and kokoro package)", "unknown", files, voice)


# In order of preference (brief): the Piper es_MX voices of rhasspy/piper-voices, then the Kokoro-82M Spanish voices.
CANDIDATES = (
    _piper("es_MX-claude-high", "claude", "high", "MIT (rhasspy/piper-voices); dataset Apache-2.0",
           "3ef40a71ea63852cd8ab7e6fa7d2ecdcfa67a0b47c9c48e3f10e02ee02083ea0"),
    _piper("es_MX-ald-medium", "ald", "medium", "MIT (rhasspy/piper-voices); dataset Unlicense",
           "019b3803293c93e34a206dd2e53a3889209a514e786fd7144f7b70196c579b63"),
    _piper("es_MX-ald-x_low", "ald", "x_low", "MIT (rhasspy/piper-voices); dataset Unlicense",
           "d8aae54aee9eafb37fb85d6da676facafca31c2d84d11acdca1a5b6dd82b1df6"),
    _kokoro("ef_dora", "d9d69b0f8a2b87a345f269d89639f89dfbd1a6c9da0c498ae36dd34afcf35530"),
    _kokoro("em_alex", "5eac53f767c3f31a081918ba531969aea850bed18fe56419b804d642c6973431"),
    _kokoro("em_santa", "aa8620cb96cec705823efca0d956a63e158e09ad41aca934d354b7f0778f63cb"),
)
BY_ID = {c.id: c for c in CANDIDATES}


def models_root() -> Path:
    root = os.environ.get("SENDERO_MODELS_ROOT")
    if not root:
        raise SystemExit("SENDERO_MODELS_ROOT is not set: point it at the models root of this device")
    return Path(root) / "voices"


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(url: str, dest: Path, retries: int = 3) -> None:
    last: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_suffix(dest.suffix + ".part")
            with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.replace(dest)
            return
        except Exception as e:  # network errors vary; retried, then reported with the URL
            last = e
            time.sleep(2 * attempt)
    raise RuntimeError(f"download failed after {retries} tries: {url}: {last}")


@functools.lru_cache(maxsize=None)
def ensure_model(c: Candidate) -> Path:
    """Download the model files of a candidate if absent, verify the published hash, record it in the lock file."""
    folder = models_root() / c.folder
    record = {}
    for rel, url, published in c.files:
        path = folder / rel
        if not path.exists():
            _download(url, path)
        digest = sha256_of(path)
        if published and digest != published:
            raise RuntimeError(f"hash mismatch for {rel}: {digest} != {published}")
        record[rel] = {"sha256": digest, "bytes": path.stat().st_size, "source": url}
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8")) if LOCK_PATH.exists() else {}
    lock[c.id] = {"engine": c.engine, "license": c.license, "files": record}
    LOCK_PATH.write_text(json.dumps(lock, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return folder


@functools.lru_cache(maxsize=None)
def _piper_voice(model_path: str):
    from piper import PiperVoice

    return PiperVoice.load(model_path)


@functools.lru_cache(maxsize=None)
def _kokoro_pipeline(folder: str):
    from kokoro import KModel, KPipeline

    model = KModel(repo_id="hexgrad/Kokoro-82M", config=str(Path(folder) / "config.json"), model=str(Path(folder) / "kokoro-v1_0.pth"))
    return KPipeline(lang_code="e", repo_id="hexgrad/Kokoro-82M", model=model)


def _piper_audio(folder: Path, c: Candidate, text: str) -> tuple[np.ndarray, int]:
    from piper import SynthesisConfig

    voice = _piper_voice(str(folder / c.files[0][0]))
    cfg = SynthesisConfig(length_scale=PIPER_LENGTH_SCALE, noise_scale=0.0, noise_w_scale=0.0)
    chunks = [np.frombuffer(a.audio_int16_bytes, dtype=np.int16) for a in voice.synthesize(text, syn_config=cfg)]
    return np.concatenate(chunks).astype(np.float64) / 32768.0, voice.config.sample_rate


def _kokoro_audio(folder: Path, c: Candidate, text: str) -> tuple[np.ndarray, int]:
    import torch

    pipe = _kokoro_pipeline(str(folder))
    torch.manual_seed(0)  # the vocoder draws random source noise; a fixed seed per call keeps a run reproducible
    parts = [np.asarray(a, dtype=np.float64) for _, _, a in pipe(text, voice=str(folder / "voices" / f"{c.voice}.pt"), speed=KOKORO_SPEED)]
    return np.concatenate(parts), 24000


def synthesize(c: Candidate, text: str) -> tuple[np.ndarray, int]:
    """Neutral speech as float64 mono at SAMPLE_RATE. Piper noise scales are 0 so a run is reproducible."""
    from scipy.signal import resample_poly

    folder = ensure_model(c)
    x, sr = (_piper_audio if c.engine == "piper" else _kokoro_audio)(folder, c, text)
    if sr != SAMPLE_RATE:
        g = np.gcd(sr, SAMPLE_RATE)
        x = resample_poly(x, SAMPLE_RATE // g, sr // g)
    return x, SAMPLE_RATE
