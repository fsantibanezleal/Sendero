"""The tables of docs/voice.md written from the pipeline's outputs."""
import pytest

from pipeline.voice import doc_tables

SELECTION = {
    "rule": {"femaleMinHz": 165.0, "maleMaxHz": 155.0},
    "chosen": {"mujer": "es_MX-a", "hombre": "kokoro-b"},
    "candidates": {
        "es_MX-a": {"medianF0Hz": 198.3, "neutralPeriodicity": 0.79},
        "kokoro-b": {"medianF0Hz": 130.5, "neutralPeriodicity": 0.61},
        "kokoro-c": {"medianF0Hz": 160.0, "neutralPeriodicity": 0.6},
    },
}


def test_candidates_table_names_the_outcome():
    t = doc_tables.candidates_table(SELECTION)
    assert "| `es_MX-a` | Piper | 198.300 | 0.790 | chosen as `mujer` |" in t
    assert "| `kokoro-b` | Kokoro | 130.500 | 0.610 | chosen as `hombre` |" in t
    assert "between the two thresholds" in t


def test_render_page_replaces_only_between_markers():
    page = "intro\n<!-- voice:x:start -->\nold\n<!-- voice:x:end -->\noutro\n<!-- voice:y:start -->\n<!-- voice:y:end -->\n"
    out = doc_tables.render_page(page, {"x": "| a |", "y": "| b |"})
    assert out == "intro\n<!-- voice:x:start -->\n| a |\n<!-- voice:x:end -->\noutro\n<!-- voice:y:start -->\n| b |\n<!-- voice:y:end -->\n"
    assert doc_tables.render_page(out, {"x": "| a |", "y": "| b |"}) == out  # idempotent


def test_render_page_requires_markers():
    with pytest.raises(SystemExit):
        doc_tables.render_page("no markers", {"x": "| a |"})


def test_intelligibility_table_has_the_mean():
    t = doc_tables.intelligibility_table({"meanWer": 0.2, "clips": [{"file": "mujer/m01.m4a", "heard": "Siempre te recordaré.", "wer": 0.0}]})
    assert t.splitlines()[-1] == "| mean | | 0.20 |"
