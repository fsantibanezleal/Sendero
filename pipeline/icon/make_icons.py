"""Render Sendero's launcher icons: one cempasuchil head on the night colour.

The head uses the same construction as the app's flower atlas (src/flowers/marigold.ts): florets
placed by Vogel's phyllotaxis (angle n x golden angle, radius c sqrt(n); Vogel 1979, DOI
10.1016/0025-5564(79)90080-4), spatula-shaped ligules with a three-lobed tip pointing outward,
drawn from the rim inward, coloured from a deep core to a light rim. Rendered at 4x and downsampled
for anti-aliasing. Deterministic (fixed seed). Writes into assets/ of the repository:

  icon.png                      1024 x 1024, night background, full head
  android-icon-foreground.png   1024 x 1024, transparent, head inside the adaptive-icon safe zone
  android-icon-background.png   1024 x 1024, night colour
  android-icon-monochrome.png   1024 x 1024, white head silhouette on transparent
  splash-icon.png               512 x 512, transparent, head
  favicon.png                   48 x 48

Usage: python -m pipeline.icon.make_icons   (from the repository root, with the pipeline venv)
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
NIGHT = (20, 16, 43, 255)
GOLDEN = math.pi * (3 - math.sqrt(5))
CORE = (184, 74, 0)
MID = (245, 138, 7)
RIM = (255, 194, 14)
SS = 4  # supersampling factor


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def ligule(length: float, width: float, lobes: int = 3) -> list[tuple[float, float]]:
    """Outline in the ligule's own frame: base at the origin, pointing along +x."""
    half = width / 2
    pts: list[tuple[float, float]] = []
    steps = 10
    for i in range(steps + 1):
        u = i / steps
        profile = math.sin(min(1.0, u / 0.85) * math.pi / 2)
        pts.append((u * 0.82 * length, -(0.22 + 0.78 * profile) * half))
    tip = lobes * 4
    for i in range(tip + 1):
        v = i / tip
        lobe = abs(math.sin(v * math.pi * lobes))
        pts.append((0.82 * length + (0.12 + 0.06 * lobe) * length, -half + v * width))
    for i in range(steps, -1, -1):
        u = i / steps
        profile = math.sin(min(1.0, u / 0.85) * math.pi / 2)
        pts.append((u * 0.82 * length, (0.22 + 0.78 * profile) * half))
    return pts


def draw_head(size: int, radius_frac: float, silhouette: bool = False) -> Image.Image:
    """A transparent square image with one head centred, radius = radius_frac * size."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S / 2
    R = radius_frac * S
    rng = random.Random(1102)
    florets = 150
    c = 0.62 / math.sqrt(florets)
    if not silhouette:
        shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse((cx - R * 0.95, cy - R * 0.85, cx + R * 0.95, cy + R * 1.05), fill=(10, 4, 0, 140))
        img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(R * 0.08)))
        d = ImageDraw.Draw(img)
    d.ellipse((cx - R * 0.72, cy - R * 0.72, cx + R * 0.72, cy + R * 0.72), fill=(255, 255, 255, 255) if silhouette else CORE + (255,))
    for n in range(florets - 1, -1, -1):
        r = c * math.sqrt(n + 0.5)
        theta = n * GOLDEN
        depth = r / (c * math.sqrt(florets))
        length = (0.22 + 0.2 * depth) * rng.uniform(0.9, 1.1) * R
        width = (0.11 + 0.09 * depth) * rng.uniform(0.85, 1.15) * R
        angle = theta + rng.uniform(-0.25, 0.25)
        bx = cx + math.cos(theta) * r * R
        by = cy + math.sin(theta) * r * R
        ca, sa = math.cos(angle), math.sin(angle)
        poly = [(bx + x * ca - y * sa, by + x * sa + y * ca) for x, y in ligule(length, width)]
        if silhouette:
            d.polygon(poly, fill=(255, 255, 255, 255))
        else:
            colour = mix(mix(CORE, MID, 0.35 + 0.65 * depth), RIM, max(0.0, depth - 0.55) * 1.6)
            d.polygon(poly, fill=colour + (255,), outline=(90, 30, 0, 90))
    if not silhouette:
        glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse((cx - R * 0.75, cy - R * 0.8, cx + R * 0.15, cy + R * 0.1), fill=(255, 244, 224, 60))
        img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(R * 0.2)))
    return img.resize((size, size), Image.LANCZOS)


def on_background(head: Image.Image, colour: tuple[int, int, int, int]) -> Image.Image:
    bg = Image.new("RGBA", head.size, colour)
    return Image.alpha_composite(bg, head)


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    on_background(draw_head(1024, 0.42), NIGHT).convert("RGB").save(ASSETS / "icon.png", optimize=True)
    # Adaptive icons show the centre 66 percent: keep the head inside it.
    draw_head(1024, 0.3).save(ASSETS / "android-icon-foreground.png", optimize=True)
    Image.new("RGBA", (1024, 1024), NIGHT).save(ASSETS / "android-icon-background.png", optimize=True)
    draw_head(1024, 0.3, silhouette=True).save(ASSETS / "android-icon-monochrome.png", optimize=True)
    draw_head(512, 0.42).save(ASSETS / "splash-icon.png", optimize=True)
    on_background(draw_head(48, 0.44), NIGHT).convert("RGB").save(ASSETS / "favicon.png", optimize=True)
    print("icons written to", ASSETS)


if __name__ == "__main__":
    main()
