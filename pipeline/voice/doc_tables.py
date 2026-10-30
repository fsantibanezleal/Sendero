"""Rewrites the measured tables of docs/voice.md from the pipeline's outputs, so the page never drifts from the clips.

Tables live between markers `<!-- voice:<name>:start -->` and `<!-- voice:<name>:end -->`:
`candidates` (pipeline/voice/selection.json), `clips` (assets/voice/catalog.json) and `intelligibility`
(pipeline/voice/intelligibility.json, when present).

Run from the repository root:  pipeline/voice/.venv/Scripts/python.exe -m pipeline.voice.doc_tables [--check]
`--check` exits 1 when the page is stale.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOC = ROOT / "docs" / "voice.md"
ENGINE = {"es_MX": "Piper", "kokoro": "Kokoro"}


def _engine(candidate_id: str) -> str:
    return next((v for k, v in ENGINE.items() if candidate_id.startswith(k)), "?")


def candidates_table(selection: dict) -> str:
    chosen = {cid: vid for vid, cid in selection["chosen"].items()}
    rule = selection["rule"]
    rows = ["| Candidate | Engine | Median F0 (Hz) | Neutral periodicity | Outcome |", "|---|---|---|---|---|"]
    for cid, m in sorted(selection["candidates"].items()):
        f0 = m["medianF0Hz"]
        if cid in chosen:
            outcome = f"chosen as `{chosen[cid]}`"
        elif f0 >= rule["femaleMinHz"]:
            outcome = "qualifies as female, not first in order"
        elif f0 <= rule["maleMaxHz"]:
            outcome = "qualifies as male, not first in order"
        else:
            outcome = "between the two thresholds, not used"
        rows.append(f"| `{cid}` | {_engine(cid)} | {f0:.3f} | {m['neutralPeriodicity']:.3f} | {outcome} |")
    return "\n".join(rows)


def clips_table(catalog: dict) -> str:
    texts = {m["id"]: m["text"] for m in catalog["messages"]}
    rows = ["| File | Message | Duration (s) | Loudness (LUFS) | True peak (dBTP) | Periodicity |", "|---|---|---|---|---|---|"]
    for c in catalog["clips"]:
        rows.append(f"| `{c['file']}` | {texts[c['message']]} | {c['durationSec']:.3f} | {c['loudnessLufs']:.3f} | "
                    f"{c['truePeakDbtp']:.3f} | {c['periodicity']:.3f} |")
    return "\n".join(rows)


def intelligibility_table(result: dict) -> str:
    rows = ["| File | Heard by the recognizer | Word error rate |", "|---|---|---|"]
    for c in result["clips"]:
        heard = c["heard"].replace("|", "/")
        rows.append(f"| `{c['file']}` | {heard} | {c['wer']:.2f} |")
    rows.append(f"| mean | | {result['meanWer']:.2f} |")
    return "\n".join(rows)


def render_page(text: str, tables: dict[str, str]) -> str:
    for name, table in tables.items():
        pattern = re.compile(rf"(<!-- voice:{name}:start -->\n).*?(<!-- voice:{name}:end -->)", re.S)
        if not pattern.search(text):
            raise SystemExit(f"docs/voice.md has no markers for the {name} table")
        text = pattern.sub(lambda m: m.group(1) + table + "\n" + m.group(2), text)
    return text


def build_tables() -> dict[str, str]:
    tables = {
        "candidates": candidates_table(json.loads((HERE / "selection.json").read_text(encoding="utf-8"))),
        "clips": clips_table(json.loads((ROOT / "assets/voice/catalog.json").read_text(encoding="utf-8"))),
    }
    intel = HERE / "intelligibility.json"
    if intel.exists():
        tables["intelligibility"] = intelligibility_table(json.loads(intel.read_text(encoding="utf-8")))
    return tables


def main(argv: list[str]) -> int:
    current = DOC.read_text(encoding="utf-8")
    fresh = render_page(current, build_tables())
    if "--check" in argv:
        if fresh != current:
            print("docs/voice.md tables are stale: run python -m pipeline.voice.doc_tables")
            return 1
        print("docs/voice.md tables: OK")
        return 0
    DOC.write_text(fresh, encoding="utf-8", newline="\n")
    print("docs/voice.md tables written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
