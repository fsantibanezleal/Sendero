"""Download the included manifest items into the data root and verify them.

    python -m pipeline.music.fetch

The SHA-256 of each downloaded file is recorded in pipeline/music/manifest.lock.json; a later run that sees a
different hash fails. An unreachable item is reported and skipped (exit code 3 at the end); the master step proceeds
with the others.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pipeline import common

MANIFEST = common.REPO_ROOT / "pipeline/music/manifest.json"
LOCK = common.REPO_ROOT / "pipeline/music/manifest.lock.json"


class FetchError(RuntimeError):
    """An integrity failure: never skipped."""


def raw_dir() -> Path:
    return common.data_root() / "music" / "raw"


def load_lock() -> dict:
    return json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else {"version": 1, "files": {}}


def verify_hash(lock: dict, item_id: str, digest: str, name: str) -> None:
    known = lock["files"].get(item_id)
    if known is None:
        lock["files"][item_id] = {"file": name, "sha256": digest}
    elif known["sha256"] != digest:
        raise FetchError(
            f"{item_id}: SHA-256 differs from manifest.lock.json ({digest} against {known['sha256']}); "
            "the mirrored file changed. Investigate before updating the lock."
        )


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    out = raw_dir()
    lock = load_lock()
    failures: list[str] = []
    for item in manifest["items"]:
        if not item["include"]:
            continue
        dest = out / f"{item['id']}.mp3"
        if not dest.exists():
            try:
                common.http_get(item["url"], dest, label=item["id"])
            except RuntimeError as exc:
                print(f"UNREACHABLE {item['id']}: {exc}")
                failures.append(item["id"])
                continue
        digest = common.sha256_file(dest)
        verify_hash(lock, item["id"], digest, dest.name)
        print(f"ok     {item['id']}  {digest[:16]}  {dest.stat().st_size} bytes")
    lock["files"] = dict(sorted(lock["files"].items()))
    common.write_json(LOCK, lock)
    if failures:
        print(f"unreachable after retries: {', '.join(failures)}")
        return 3
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (FetchError, common.DataRootError) as exc:
        print(f"FAILED: {exc}")
        sys.exit(1)
