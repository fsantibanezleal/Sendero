"""Contract test of assets/voice/catalog.json (version 1) and of the committed clips."""
import json
from pathlib import Path

import pytest

from pipeline.voice import render

ROOT = Path(__file__).resolve().parents[3]
MESSAGES = json.loads((ROOT / "pipeline/voice/messages.json").read_text(encoding="utf-8"))
VERBATIM = {
    "m01": "siempre te recordaré",
    "m02": "siempre en mis pensamientos",
    "m03": "gracias",
    "m04": "sigue así",
    "m05": "lo estás haciendo bien",
    "m06": "descansa, lo estás haciendo bien",
    "m07": "también te extraño",
}


def test_messages_are_verbatim():
    # The owner's seven, word for word; the rest follow the owner's brief of at least about fifty.
    by_id = {m["id"]: m["text"] for m in MESSAGES}
    assert {k: by_id[k] for k in VERBATIM} == VERBATIM
    assert len(MESSAGES) >= 50
    assert len(set(by_id.values())) == len(MESSAGES)


def good_catalog():
    voices = [
        {"id": v, "gender": g, "engine": "piper", "model": "es_MX-x", "license": "MIT", "medianF0Hz": f}
        for v, g, f in (("mujer", "female", 200.0), ("hombre", "male", 120.0), ("mujer-2", "female", 171.0), ("hombre-2", "male", 135.0))
    ]
    clips = [
        {"message": m["id"], "voice": v["id"], "file": f"{v['id']}/{m['id']}.m4a", "durationSec": 3.0,
         "loudnessLufs": -20.0, "truePeakDbtp": -3.1, "periodicity": 0.12}
        for v in voices for m in MESSAGES
    ]
    return {"version": 1, "messages": MESSAGES, "voices": voices, "clips": clips}


def test_validate_accepts_good_catalog():
    render.validate_catalog(good_catalog())


@pytest.mark.parametrize("mutate", [
    lambda c: c.update(version=2),
    lambda c: c["clips"].pop(),
    lambda c: c["clips"][0].update(durationSec=0.5),
    lambda c: c["clips"][0].update(durationSec=6.5),
    lambda c: c["messages"][0].update(text="siempre te recorde"),
    lambda c: c["voices"][0].update(gender="female", medianF0Hz=150.0),
    lambda c: c["voices"][1].update(medianF0Hz=170.0),
    lambda c: c["clips"][0].update(file="mujer/x.m4a"),
    lambda c: c["clips"][0].pop("loudnessLufs"),
])
def test_validate_rejects_bad_catalog(mutate):
    c = good_catalog()
    mutate(c)
    with pytest.raises(ValueError):
        render.validate_catalog(c)


def test_committed_catalog_and_files():
    path = ROOT / "assets/voice/catalog.json"
    if not path.exists():
        pytest.skip("clips not rendered yet")
    c = json.loads(path.read_text(encoding="utf-8"))
    render.validate_catalog(c)
    for clip in c["clips"]:
        assert (ROOT / "assets/voice" / clip["file"]).is_file()
    raw = path.read_text(encoding="utf-8")
    assert raw == render.dumps_catalog(c)


def test_spoken_forms_keep_the_words():
    import re

    from pipeline.voice import intelligibility, synth

    for m in MESSAGES:
        assert render.spoken_text("kokoro-em_alex", m) == m["text"][:1].upper() + m["text"][1:] + "."
    for cid, overrides in render.SPOKEN["overrides"].items():
        assert cid in synth.BY_ID
        for mid, text in overrides.items():
            message = next(m for m in MESSAGES if m["id"] == mid)
            # Outside the raw phonemes [[ ]] an override says only words of the message.
            plain = re.sub(r"\[\[.*?\]\]", " ", text)
            assert set(intelligibility.words(plain)) <= set(intelligibility.words(message["text"]))
            assert render.spoken_text(cid, message) == text
