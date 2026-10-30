"""Shared helpers of the offline pipelines: data root, deterministic JSON, hashing, retrying downloads."""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_VAR = "SENDERO_DATA_ROOT"
USER_AGENT = "Sendero-pipeline/1 (https://github.com/fsantibanezleal/Sendero)"
FLOAT_DECIMALS = 4


class DataRootError(RuntimeError):
    pass


def data_root() -> Path:
    """The data root: raw inputs and scratch files live here, never in the repository."""
    value = os.environ.get(ENV_VAR)
    if not value:
        raise DataRootError(
            f"{ENV_VAR} is not set. Point it at a folder outside the repository for raw music, the gait "
            "archive and scratch files (see pipeline/README.md)."
        )
    return Path(value)


def round_floats(obj, decimals: int = FLOAT_DECIMALS):
    if isinstance(obj, float):
        return round(obj, decimals)
    if isinstance(obj, dict):
        return {k: round_floats(v, decimals) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [round_floats(v, decimals) for v in obj]
    return obj


def json_text(obj) -> str:
    return json.dumps(round_floats(obj), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def write_json(path, obj) -> None:
    """Deterministic JSON: sorted keys, 4-decimal floats, LF endings, UTF-8; written atomically."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".part")
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json_text(obj))
    os.replace(tmp, path)


def sha256_file(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def http_get(url: str, dest: Path | None = None, *, retries: int = 3, label: str = "") -> bytes | None:
    """GET with 3 retries and exponential backoff. With dest, stream to dest.part then rename (nothing half
    written is left behind); without, return the body."""
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                if dest is None:
                    return resp.read()
                dest.parent.mkdir(parents=True, exist_ok=True)
                tmp = dest.with_name(dest.name + ".part")
                with open(tmp, "wb") as fh:
                    while True:
                        chunk = resp.read(1 << 20)
                        if not chunk:
                            break
                        fh.write(chunk)
                os.replace(tmp, dest)
                return None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
            last = exc
            tmp = dest.with_name(dest.name + ".part") if dest else None
            if tmp is not None and tmp.exists():
                tmp.unlink()
            if attempt < retries:
                time.sleep(2 ** (attempt + 1))
    raise RuntimeError(f"download failed after {retries} retries: {label or url}: {last}")
