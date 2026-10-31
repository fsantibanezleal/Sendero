"""Silhouette drawings into the app's figures.

Reads the downloaded drawings and their manifest (public domain, CC0 or CC BY SVGs, one figure each), flattens every
transform, keeps the filled shapes (drops background rectangles, white fills and shapes without fill), and writes
`assets/silhouettes/silhouettes.json`: per drawing its archetype, view and the filled parts as SVG path data,
normalized so the figure stands with its feet at y = 0, its height is 1 (y grows down, so the top is at y = -1),
centred at x = 0 and facing right (+x). The app unites the parts with Skia at load time.

It also writes the licence and attribution table of the drawings into ASSETS.md between the markers
`<!-- silhouettes:start -->` and `<!-- silhouettes:end -->`.

Run from the repository root:
    pipeline/.venv/Scripts/python.exe -m pipeline.silhouettes.build --raw <data root>/sendero/silhouettes/raw
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from svgelements import SVG, Color, Matrix, Path as SvgPath, Rect, Shape

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "silhouettes" / "silhouettes.json"
ASSETS = ROOT / "ASSETS.md"
ARCHETYPES = ("abuela", "abuelo", "mujer", "hombre", "perro", "gato")
VIEWS = ("walk", "stand", "sit")
ACCEPTED = re.compile(r"^(PD|public domain|Public Domain|CC0|CC BY [234]\.0|PD-\w+)", re.I)
PRECISION = 4


def is_background(shape: Shape, view_w: float, view_h: float) -> bool:
    """A rectangle covering nearly the whole drawing is a background, not part of the figure."""
    if not isinstance(shape, Rect):
        return False
    return shape.width * shape.height >= 0.9 * view_w * view_h


def is_visible_fill(shape: Shape) -> bool:
    """Filled with a dark enough, opaque enough colour (white or transparent fills are not the silhouette)."""
    fill = shape.fill
    if fill is None or fill.value is None:
        return False
    c = Color(fill)
    if c.alpha is not None and c.alpha < 64:
        return False
    if c.opacity is not None and c.opacity < 0.25:
        return False
    return (c.red + c.green + c.blue) / 3 < 200


def parts_of(file: Path) -> list[tuple[SvgPath, bool]]:
    """The filled shapes of a drawing, transforms applied, with their fill rule (True for evenodd)."""
    svg = SVG.parse(str(file), reify=True)
    vw = float(svg.viewbox.width) if svg.viewbox is not None else float(svg.width or 1)
    vh = float(svg.viewbox.height) if svg.viewbox is not None else float(svg.height or 1)
    out: list[tuple[SvgPath, bool]] = []
    for e in svg.elements():
        if not isinstance(e, Shape) or is_background(e, vw, vh) or not is_visible_fill(e):
            continue
        p = SvgPath(e)
        p.reify()
        if p.bbox() is None:
            continue
        rule = str(e.values.get("fill-rule", e.values.get("fill_rule", "nonzero"))).lower()
        out.append((p, rule == "evenodd"))
    return out


def normalize(parts: list[tuple[SvgPath, bool]], facing: str) -> tuple[list[dict], float]:
    """Feet at y = 0, height 1, centred, facing right. Returns the parts as path data and the width/height ratio."""
    boxes = [p.bbox() for p, _ in parts]
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    h = y1 - y0
    w = x1 - x0
    if h <= 0:
        raise ValueError("empty drawing")
    flip = -1.0 if facing == "left" else 1.0
    m = Matrix(f"translate({-(x0 + w / 2)},{-y1})")
    m.post_scale(flip / h, 1 / h)
    result = []
    for p, evenodd in parts:
        q = SvgPath(p) * m
        q.reify()
        result.append({"d": q.d(relative=False).replace(",", " ") if PRECISION is None else round_d(q), "evenodd": evenodd})
    return result, w / h


def round_d(p: SvgPath) -> str:
    """Path data with coordinates rounded (smaller file, same shape at screen sizes)."""
    d = p.d(relative=False)
    return re.sub(r"-?\d+\.\d+(?:e-?\d+)?", lambda m: f"{float(m.group(0)):.{PRECISION}f}".rstrip("0").rstrip("."), d)


def build(raw: Path) -> list[dict]:
    manifest = json.loads((raw / "manifest.json").read_text(encoding="utf-8"))
    entries = []
    for item in manifest:
        archetype, view = item["archetype"], item["view"]
        if archetype not in ARCHETYPES or view not in VIEWS:
            raise SystemExit(f"unknown archetype or view in {item['file']}")
        if not ACCEPTED.match(item["licence"].strip()):
            raise SystemExit(f"licence not accepted for {item['file']}: {item['licence']}")
        parts = parts_of(raw / item["file"])
        if not parts:
            print(f"skipped (no filled shape): {item['file']}", file=sys.stderr)
            continue
        norm, aspect = normalize(parts, item.get("facing", "right"))
        entries.append(
            {
                "id": Path(item["file"]).stem,
                "archetype": archetype,
                "view": view,
                "aspect": round(aspect, 4),
                "parts": norm,
                "source": item["source_url"],
                "author": item.get("author", ""),
                "licence": item["licence"],
                "notes": item.get("notes", ""),
            }
        )
    return entries


def assets_table(entries: list[dict]) -> str:
    rows = ["| Drawing | Figure | Author | Licence | Source |", "|---|---|---|---|---|"]
    for e in entries:
        rows.append(f"| `{e['id']}` | {e['archetype']}, {e['view']} | {e['author'] or 'not stated'} | {e['licence']} | {e['source']} |")
    return "\n".join(rows)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--raw", required=True, type=Path, help="folder with manifest.json and the downloaded SVGs")
    args = ap.parse_args(argv)
    entries = build(args.raw)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    text = ASSETS.read_text(encoding="utf-8")
    block = f"<!-- silhouettes:start -->\n{assets_table(entries)}\n<!-- silhouettes:end -->"
    if "<!-- silhouettes:start -->" in text:
        text = re.sub(r"<!-- silhouettes:start -->.*?<!-- silhouettes:end -->", lambda _: block, text, flags=re.S)
    else:
        text = text.rstrip() + "\n\n## Silhouettes\n\nSilhouette drawings of the people and pets, normalized by `pipeline/silhouettes/build.py` into `assets/silhouettes/silhouettes.json`.\n\n" + block + "\n"
    ASSETS.write_text(text, encoding="utf-8", newline="\n")
    counts: dict[tuple[str, str], int] = {}
    for e in entries:
        counts[(e["archetype"], e["view"])] = counts.get((e["archetype"], e["view"]), 0) + 1
    print(f"{len(entries)} drawings written to {OUT.relative_to(ROOT)}: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
