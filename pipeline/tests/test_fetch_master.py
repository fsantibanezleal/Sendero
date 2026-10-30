import pytest

from pipeline.music import fetch, master


def test_hash_lock_records_then_fails_loudly_on_change():
    lock = {"version": 1, "files": {}}
    fetch.verify_hash(lock, "a", "abc", "a.mp3")
    fetch.verify_hash(lock, "a", "abc", "a.mp3")  # same hash: fine
    with pytest.raises(fetch.FetchError, match="SHA-256 differs"):
        fetch.verify_hash(lock, "a", "def", "a.mp3")


def test_mp3_name_needs_exactly_one_mp3():
    assert fetch.mp3_name([{"name": "x.mp3", "format": "VBR MP3"}, {"name": "x.png", "format": "PNG"}]) == "x.mp3"
    with pytest.raises(fetch.FetchError):
        fetch.mp3_name([{"name": "x.png", "format": "PNG"}])


def test_catalog_order_alternates_vocal_and_instrumental():
    tr = [{"id": i, "instrumental": v} for i, v in [("v1", False), ("i1", True), ("i2", True), ("v2", False), ("i3", True)]]
    assert [t["id"] for t in master.alternate(tr)] == ["v1", "i1", "v2", "i2", "i3"]
