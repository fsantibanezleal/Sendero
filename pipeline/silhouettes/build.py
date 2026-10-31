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

import numpy as np
from PIL import Image, ImageChops, ImageDraw
from svgelements import SVG, Color, Matrix, Path as SvgPath, Rect, Shape

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "silhouettes" / "silhouettes.json"
ASSETS = ROOT / "ASSETS.md"
ARCHETYPES = ("abuela", "abuelo", "mujer", "hombre", "perro", "gato")
VIEWS = ("walk", "stand", "sit")
ACCEPTED = re.compile(r"^(PD|public domain|Public Domain|CC0|CC BY [234]\.0|PD-\w+)", re.I)
PRECISION = 4
ANCHOR_RASTER = 500
PEOPLE = ("abuela", "abuelo", "mujer", "hombre")


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


def raster(parts: list[dict], aspect: float) -> tuple[np.ndarray, float]:
    """The figure as a boolean mask, ANCHOR_RASTER rows tall; returns the mask and x = 0 in columns."""
    n = ANCHOR_RASTER
    w = int(n * max(aspect, 0.2)) + 8
    ox = w / 2
    acc = Image.new("1", (w, n + 1), 0)
    for part in parts:
        layer = Image.new("1", (w, n + 1), 0)
        for sub in SvgPath(part["d"]).as_subpaths():
            pts = []
            for seg in SvgPath(sub):
                steps = 10 if type(seg).__name__ in ("CubicBezier", "QuadraticBezier", "Arc") else 2
                for i in range(steps):
                    try:
                        q = seg.point(i / (steps - 1))
                    except (TypeError, ValueError, AttributeError):
                        q = None
                    if q is not None:
                        pts.append((ox + q.x * n, n + q.y * n))
            if len(pts) > 2:
                one = Image.new("1", (w, n + 1), 0)
                ImageDraw.Draw(one).polygon(pts, fill=1)
                layer = ImageChops.logical_xor(layer, one)
        acc = ImageChops.logical_or(acc, layer)
    return np.array(acc, dtype=bool), ox


def run_at(row: np.ndarray, x: float) -> tuple[int, int] | None:
    """The filled run of a row that holds column x, or the nearest one."""
    cols = np.flatnonzero(row)
    if cols.size == 0:
        return None
    runs = np.split(cols, np.flatnonzero(np.diff(cols) > 1) + 1)
    best = min(runs, key=lambda r: 0 if r[0] <= x <= r[-1] else min(abs(r[0] - x), abs(r[-1] - x)))
    return int(best[0]), int(best[-1])


def person_anchors(mask: np.ndarray, ox: float) -> dict:
    """Head, neck, shoulders, waist and hem of a person, followed down the body from the top, in figure units."""
    n = ANCHOR_RASTER
    top = int(np.flatnonzero(mask.any(axis=1))[0])
    x = float(np.flatnonzero(mask[top])[0])
    rows = []
    for y in range(top, n):
        run = run_at(mask[y], x)
        if run is None:
            rows.append((y, x, 0.0))
            continue
        x = 0.8 * x + 0.2 * (run[0] + run[1]) / 2
        rows.append((y, (run[0] + run[1]) / 2, float(run[1] - run[0] + 1)))
    width = np.array([r[2] for r in rows])
    centre = np.array([r[1] for r in rows])
    # The neck: the first narrow row with the body widening clearly below it.
    neck = int(0.16 * n)
    for i in range(int(0.08 * n), int(0.3 * n)):
        if width[i] == width[max(0, i - 25) : i + 1].min() and width[i + 1 : i + 45].max() > 1.5 * width[i]:
            neck = i
            break
    above = width[max(0, neck - 34) : max(1, neck - 6)]
    r = float(np.clip(np.median(above) / 2 / n, 0.04, 0.085))
    head_x = float(np.median(centre[max(0, neck - 34) : max(1, neck - 6)]))
    head_rows = [mask[top + i, :] for i in range(max(0, neck - 36), neck)]
    left = sum(int(row[: int(head_x)].sum()) for row in head_rows)
    right = sum(int(row[int(head_x) :].sum()) for row in head_rows)
    body = width[neck:]
    wide = body[: int(0.2 * n)] > 1.9 * max(width[neck], 1)
    shoulder = neck + (int(np.argmax(wide)) if wide.any() else int(np.argmax(body[: int(0.14 * n)])))
    # The waist: the narrowest part of the trunk; thin runs are an arm or a stick, not the body.
    waist_lo, waist_hi = shoulder + int(0.12 * n), shoulder + int(0.3 * n)
    trunk = np.where(width[waist_lo:waist_hi] > 0.45 * width[shoulder], width[waist_lo:waist_hi], np.inf)
    waist = waist_lo + (int(np.argmin(trunk)) if np.isfinite(trunk).any() else int(0.1 * n))
    hem = next((i for i in range(len(width) - 1, int(0.6 * n), -1) if width[i] > 0.75 * width[shoulder]), None)
    u = lambda v: round(float(v) / n, 4)
    y_of = lambda i: round(float(top + i - n) / n, 4)
    return {
        "head": {"x": u(head_x - ox), "y": round(y_of(neck) - r * 1.05, 4), "r": round(r, 4)},
        "neck": {"x": u(centre[neck] - ox), "y": y_of(neck), "w": u(width[neck])},
        "shoulder": {"x": u(centre[shoulder] - ox), "y": y_of(shoulder), "w": u(width[shoulder])},
        "waist": {"x": u(centre[waist] - ox), "y": y_of(waist), "w": u(width[waist])},
        "hemY": y_of(hem) if hem is not None else None,
        "bias": round((right - left) / max(1, right + left), 3),
    }


def pet_anchors(mask: np.ndarray, ox: float) -> dict:
    """Head and body of a pet: the widest mass in the upper front part, and the middle of the body."""
    n = ANCHOR_RASTER
    ys, xs = np.nonzero(mask)
    rows = mask[: int(0.4 * n)]
    columns = rows.sum(axis=0).astype(float)
    # A pet faces right, so the head is in the front half; a raised tail stays out of the search.
    columns[: int(ox - 0.02 * n)] = 0
    if columns.max() <= 0:
        columns = mask.sum(axis=0).astype(float)
    smooth = np.convolve(columns, np.ones(60) / 60, mode="same")
    hx = int(np.argmax(smooth))
    hy = float(np.nonzero(mask[:, max(0, hx - 30) : hx + 30])[0].min()) + 0.13 * n
    return {
        "head": {"x": round((hx - ox) / n, 4), "y": round((hy - n) / n, 4), "r": 0.15},
        "body": {"x": round((float(xs.mean()) - ox) / n, 4), "y": round((float(ys.mean()) - n) / n, 4)},
    }


def crop_parts(parts: list[tuple[SvgPath, bool]], crop: list[float] | None) -> list[tuple[SvgPath, bool]]:
    """Keeps the closed shapes whose centre lies in [x0, x1] (fractions of the drawing's width): one person of a couple."""
    if not crop:
        return parts
    boxes = [sp.bbox() for p, _ in parts for sp in p.as_subpaths() if SvgPath(sp).bbox() is not None for sp in [SvgPath(sp)]]
    left = min(b[0] for b in boxes)
    right = max(b[2] for b in boxes)
    x0 = left + crop[0] * (right - left)
    x1 = left + crop[1] * (right - left)
    kept = []
    for p, evenodd in parts:
        subs = [SvgPath(sp) for sp in p.as_subpaths()]
        chosen = [sp for sp in subs if sp.bbox() is not None and x0 <= (sp.bbox()[0] + sp.bbox()[2]) / 2 <= x1]
        if chosen:
            joined = SvgPath()
            for sp in chosen:
                joined += sp
            kept.append((joined, evenodd))
    return kept


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
        parts = crop_parts(parts, item.get("crop"))
        if not parts:
            print(f"skipped (no filled shape): {item['file']}", file=sys.stderr)
            continue
        norm, aspect = normalize(parts, item.get("facing", "right"))
        mask, ox = raster(norm, aspect)
        anchors = person_anchors(mask, ox) if archetype in PEOPLE else pet_anchors(mask, ox)
        anchors.update(item.get("anchors", {}))
        entries.append(
            {
                "id": Path(item["file"]).stem,
                "archetype": archetype,
                "view": view,
                "aspect": round(aspect, 4),
                "anchors": anchors,
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
