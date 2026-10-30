import json

from pipeline import common
from pipeline.music import rules


def test_serradell_included():
    ok, reason = rules.decide("Narciso Serradell", 1910, False, 1920)
    assert ok and "1910" in reason


def test_mendoza_y_cortes_excluded():
    ok, reason = rules.decide("Quirino Mendoza y Cortes", 1957, False, 1919)
    assert not ok and "2057" in reason


def test_unknown_composer_excluded():
    assert rules.decide(None, None, False, 1917)[0] is False
    assert rules.decide("Someone", None, False, 1917)[0] is False


def test_traditional_included_when_old_enough():
    assert rules.decide("Traditional", None, True, 1917)[0] is True
    assert rules.decide("Traditional", None, True, 1935)[0] is False


def test_death_boundary_and_publication_cutoff():
    assert rules.decide("A", 1925, False, 1930)[0] is True
    assert rules.decide("A", 1926, False, 1930)[0] is False
    assert rules.decide("A", 1900, False, 1931)[0] is False


def test_manifest_matches_rules():
    manifest = json.loads((common.REPO_ROOT / "pipeline/music/manifest.json").read_text(encoding="utf-8"))
    assert manifest["items"]
    for item in manifest["items"]:
        c = item["composer"]
        ok, reason = rules.decide(c.get("name"), c.get("deathYear"), c.get("traditional", False), item["year"])
        assert item["include"] is ok, item["id"]
        assert item["reason"] == reason, item["id"]
        if ok:
            assert c.get("source"), f"{item['id']}: an included composer needs a cited source"
    included = [i["id"] for i in manifest["items"] if i["include"]]
    assert "golondrinas-1920" in included
    assert "cielito-lindo-1919" not in included
