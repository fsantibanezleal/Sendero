"""Download the included manifest items from the Internet Archive into the data root and verify them.

    python -m pipeline.music.fetch

For every manifest item the Internet Archive metadata must carry the Public Domain Mark licence URL. The SHA-256 of
each downloaded file is recorded in pipeline/music/manifest.lock.json; a later run that sees a different hash fails.
An unreachable item is reported and skipped (exit code 3 at the end); the master step proceeds with the others.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pipeline import common

PDM_URL = "https://creativecommons.org/publicdomain/mark/1.0/"
MANIFEST = common.REPO_ROOT / "pipeline/music/manifest.json"
LOCK = common.REPO_ROOT / "pipeline/music/manifest.lock.json"


class FetchError(RuntimeError):
    """A licence or integrity failure: never skipped."""


def raw_dir() -> Path:
    return common.data_root() / "music" / "raw"


def mp3_name(files: list[dict]) -> str:
    names = [f["name"] for f in files if f.get("format") == "VBR MP3" or f["name"].lower().endswith(".mp3")]
    if len(names) != 1:
        raise FetchError(f"expected exactly one MP3 in the item, found {names}")
    return names[0]


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
        ident = item["identifier"]
        try:
            meta = json.loads(
                common.http_get(f"https://archive.org/metadata/{ident}", label=ident).decode("utf-8")
            )
        except RuntimeError as exc:
            print(f"UNREACHABLE {item['id']}: {exc}")
            failures.append(item["id"])
            continue
        licence = meta.get("metadata", {}).get("licenseurl")
        if licence != PDM_URL:
            raise FetchError(f"{item['id']}: licenseurl is {licence!r}, expected the Public Domain Mark {PDM_URL}")
        if not item["include"]:
            print(f"skip   {item['id']} (excluded: {item['reason']})")
            continue
        name = mp3_name(meta["files"])
        dest = out / f"{item['id']}.mp3"
        if not dest.exists():
            try:
                common.http_get(f"https://archive.org/download/{ident}/{name}", dest, label=item["id"])
            except RuntimeError as exc:
                print(f"UNREACHABLE {item['id']}: {exc}")
                failures.append(item["id"])
                continue
        digest = common.sha256_file(dest)
        verify_hash(lock, item["id"], digest, name)
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
