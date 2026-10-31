"""Contract tests on the produced boundary: the committed catalog and gait JSON (version 1)."""
import json
import re

import numpy as np

from pipeline import common

ROOT = common.REPO_ROOT
GROUPS = ("young", "older")
CURVES = ("pelvisTilt", "hipFlexion", "kneeFlexion", "ankleDorsiflexion")


def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def test_catalog_shape():
    cat = load("assets/music/catalog.json")
    assert cat["version"] == 1
    assert cat["tracks"]
    ids = set()
    for t in cat["tracks"]:
        assert set(t) == {
            "id", "file", "title", "performer", "year", "composer", "durationSec", "instrumental",
            "loudnessLufs", "truePeakDbtp", "license", "licenseUrl", "source", "credit",
        }
        assert t["id"] not in ids
        ids.add(t["id"])
        assert t["file"] == f"{t['id']}.m4a" and (ROOT / "assets/music" / t["file"]).is_file()
        assert isinstance(t["instrumental"], bool)
        assert isinstance(t["year"], int) and 2000 <= t["year"] <= 2030
        assert t["durationSec"] > 30
        assert abs(t["loudnessLufs"] + 16.0) <= 0.3, t["id"]
        assert t["truePeakDbtp"] <= -1.0, t["id"]
        assert t["licenseUrl"] == "https://creativecommons.org/licenses/by/4.0/"
        assert t["license"] == "CC BY 4.0"
        assert t["source"].startswith("https://incompetech.com/")
        assert t["title"] in t["credit"] and "Kevin MacLeod" in t["credit"] and "Attribution 4.0" in t["credit"]
        assert t["composer"] not in ("", None, "Unknown")


def test_catalog_lists_only_included_manifest_items():
    cat = load("assets/music/catalog.json")
    manifest = load("pipeline/music/manifest.json")
    included = {i["id"] for i in manifest["items"] if i["include"]}
    assert {t["id"] for t in cat["tracks"]} <= included
    files = {p.name for p in (ROOT / "assets/music").glob("*.m4a")}
    assert files == {t["file"] for t in cat["tracks"]}


def test_gait_shape_and_convention():
    g = load("data/gait/fukuchi2018-sagittal.json")
    assert g["version"] == 1 and g["order"] == 6 and g["units"] == "degrees"
    assert g["convention"] == "flexion and dorsiflexion positive"
    assert g["source"]["doi"] == "10.7717/peerj.4640"
    assert g["source"]["license"] == "CC BY 4.0"
    assert g["source"]["data"] == "https://doi.org/10.6084/m9.figshare.5722711"
    assert set(g["groups"]) == set(GROUPS)
    for name in GROUPS:
        grp = g["groups"][name]
        assert grp["subjects"] >= 10 and grp["speedLabel"] == "overground comfortable"
        assert set(grp["curves"]) == set(CURVES)
        for cname in CURVES:
            c = grp["curves"][cname]
            assert len(c["a"]) == 6 and len(c["b"]) == 6
            assert c["rmsDeg"] < 1.5, (name, cname)


def test_gait_sign_convention_and_ranges():
    g = load("data/gait/fukuchi2018-sagittal.json")
    p = np.arange(100) / 100.0

    def curve(grp, name):
        c = g["groups"][grp]["curves"][name]
        y = np.full_like(p, c["a0"])
        for k in range(1, 7):
            y += c["a"][k - 1] * np.cos(2 * np.pi * k * p) + c["b"][k - 1] * np.sin(2 * np.pi * k * p)
        return y

    for grp in GROUPS:
        hip, knee, ankle = curve(grp, "hipFlexion"), curve(grp, "kneeFlexion"), curve(grp, "ankleDorsiflexion")
        assert 20 < hip[0] < 45 and hip.min() < -2 and 40 <= p[hip.argmin()] * 100 <= 60
        assert 50 <= knee.max() <= 70 and 62 <= p[knee.argmax()] * 100 <= 80
        assert knee.min() > -5  # no hyperextension in swing
        assert -20 <= ankle.min() and ankle.max() <= 15
