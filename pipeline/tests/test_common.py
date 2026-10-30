import json

import pytest

from pipeline import common


def test_write_json_is_deterministic(tmp_path):
    a = {"b": 1.234567891, "a": [0.1 + 0.2, {"z": 1, "y": 2}]}
    b = {"a": [0.1 + 0.2, {"y": 2, "z": 1}], "b": 1.234567891}
    p1, p2 = tmp_path / "1.json", tmp_path / "2.json"
    common.write_json(p1, a)
    common.write_json(p2, b)
    assert p1.read_bytes() == p2.read_bytes()
    data = json.loads(p1.read_text(encoding="utf-8"))
    assert data["b"] == 1.2346
    assert data["a"][0] == 0.3
    assert p1.read_bytes().endswith(b"}\n")
    assert b"\r" not in p1.read_bytes()


def test_data_root_requires_variable(monkeypatch):
    monkeypatch.delenv("SENDERO_DATA_ROOT", raising=False)
    with pytest.raises(common.DataRootError, match="SENDERO_DATA_ROOT"):
        common.data_root()


def test_data_root_reads_variable(monkeypatch, tmp_path):
    monkeypatch.setenv("SENDERO_DATA_ROOT", str(tmp_path))
    assert common.data_root() == tmp_path
