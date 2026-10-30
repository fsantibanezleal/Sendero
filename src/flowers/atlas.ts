/**
 * Bakes every flower sprite once, at startup, into one Skia image (an atlas), so the garland, the
 * petal path and the bloom draw hundreds of sprites in one call (research-visuals D1 item 5).
 *
 * Layout: a grid of CELL x CELL cells. Row 0: HEAD_VARIANTS marigold heads (with a soft contact
 * shadow). Row 1: PETAL_VARIANTS loose petals, then LEAF_VARIANTS leaves, then a round glow.
 */
import { BlurStyle, PaintStyle, Skia, type SkCanvas, type SkImage, type SkRect, TileMode } from '@shopify/react-native-skia';

import { mulberry32, randRange } from '../procedural';
import { liguleOutline, MARIGOLD_COLORS, marigoldFlorets } from './marigold';

export const CELL = 160;
export const HEAD_VARIANTS = 8;
export const PETAL_VARIANTS = 4;
export const LEAF_VARIANTS = 2;
const COLUMNS = HEAD_VARIANTS;

export interface FlowerAtlas {
  image: SkImage;
  heads: SkRect[];
  petals: SkRect[];
  leaves: SkRect[];
  glow: SkRect;
}

function cell(col: number, row: number): SkRect {
  return Skia.XYWHRect(col * CELL, row * CELL, CELL, CELL);
}

function polygonPath(xs: number[], ys: number[], m?: ReturnType<typeof Skia.Matrix>) {
  const p = Skia.PathBuilder.Make();
  p.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length; i++) p.lineTo(xs[i], ys[i]);
  p.close();
  if (m) p.transform(m);
  return p.build();
}

function drawHead(canvas: SkCanvas, cx: number, cy: number, radius: number, seed: number) {
  const colors = MARIGOLD_COLORS[seed % MARIGOLD_COLORS.length];
  const shadow = Skia.Paint();
  shadow.setColor(Skia.Color('rgba(20, 8, 0, 0.55)'));
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, radius * 0.12, true));
  canvas.drawCircle(cx + radius * 0.06, cy + radius * 0.1, radius * 0.92, shadow);

  const base = Skia.Paint();
  base.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(cx, cy),
      radius,
      [Skia.Color(colors.core), Skia.Color(colors.mid)],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(cx, cy, radius * 0.72, base);

  const edge = Skia.Paint();
  edge.setColor(Skia.Color('rgba(90, 30, 0, 0.35)'));
  edge.setStyle(PaintStyle.Stroke);
  edge.setStrokeWidth(Math.max(0.6, radius * 0.012));
  edge.setAntiAlias(true);

  for (const f of marigoldFlorets({ seed })) {
    const L = f.length * radius;
    const W = f.width * radius;
    const { xs, ys } = liguleOutline(L, W);
    const bx = cx + f.x * radius;
    const by = cy + f.y * radius;
    const m = Skia.Matrix();
    m.translate(bx, by);
    m.rotate(f.angle);
    const path = polygonPath(xs, ys, m);
    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    const tipX = bx + Math.cos(f.angle) * L;
    const tipY = by + Math.sin(f.angle) * L;
    const light = 0.35 + 0.65 * f.depth;
    fill.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(bx, by),
        Skia.Point(tipX, tipY),
        [Skia.Color(colors.core), Skia.Color(colors.mid), Skia.Color(light > 0.7 ? colors.rim : colors.mid)],
        [0, 0.45, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawPath(path, fill);
    canvas.drawPath(path, edge);
  }

  // A soft highlight toward the upper left, as candlelight on the pompom.
  const hi = Skia.Paint();
  hi.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(cx - radius * 0.3, cy - radius * 0.35),
      radius * 0.7,
      [Skia.Color('rgba(255, 244, 224, 0.28)'), Skia.Color('rgba(255, 244, 224, 0)')],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(cx, cy, radius, hi);
}

/** Builds the atlas. Called once; the result is reused for the life of the app. */
export function bakeFlowerAtlas(): FlowerAtlas {
  const surface = Skia.Surface.Make(COLUMNS * CELL, 2 * CELL);
  if (surface == null) {
    throw new Error('Could not create the flower atlas surface');
  }
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));

  const heads: SkRect[] = [];
  for (let i = 0; i < HEAD_VARIANTS; i++) {
    const r = cell(i, 0);
    drawHead(canvas, r.x + CELL / 2, r.y + CELL / 2, CELL * 0.42, 11 + i * 7);
    heads.push(r);
  }

  const petals: SkRect[] = [];
  const rng = mulberry32(2024);
  for (let i = 0; i < PETAL_VARIANTS; i++) {
    const r = cell(i, 1);
    const colors = MARIGOLD_COLORS[i % MARIGOLD_COLORS.length];
    const L = CELL * randRange(rng, 0.62, 0.72);
    const W = CELL * randRange(rng, 0.42, 0.5);
    const { xs, ys } = liguleOutline(L, W, 3);
    const m = Skia.Matrix();
    m.translate(r.x + CELL / 2 - L / 2, r.y + CELL / 2);
    const path = polygonPath(xs, ys, m);
    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    fill.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(r.x + CELL / 2 - L / 2, r.y),
        Skia.Point(r.x + CELL / 2 + L / 2, r.y),
        [Skia.Color(colors.mid), Skia.Color(colors.rim)],
        [0, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawPath(path, fill);
    petals.push(r);
  }

  const leaves: SkRect[] = [];
  for (let i = 0; i < LEAF_VARIANTS; i++) {
    const r = cell(PETAL_VARIANTS + i, 1);
    // Pinnate marigold leaf: a midrib with toothed leaflets.
    const leaf = Skia.Paint();
    leaf.setAntiAlias(true);
    leaf.setColor(Skia.Color(i === 0 ? '#2F5A1E' : '#3C6B24'));
    const cx = r.x + CELL / 2;
    const cy = r.y + CELL / 2;
    const span = CELL * 0.42;
    for (let k = -3; k <= 3; k++) {
      const t = k / 3.5;
      const lx = cx + t * span;
      const size = CELL * (0.11 - 0.025 * Math.abs(t));
      for (const side of [-1, 1]) {
        const p = Skia.PathBuilder.Make();
        p.moveTo(lx, cy);
        p.quadTo(lx + size * 0.4, cy + side * size * 0.9, lx + size * 1.1, cy + side * size * 0.25);
        p.quadTo(lx + size * 0.5, cy + side * size * 0.15, lx, cy);
        p.close();
        canvas.drawPath(p.build(), leaf);
      }
    }
    const rib = Skia.Paint();
    rib.setColor(Skia.Color('#22451A'));
    rib.setStyle(PaintStyle.Stroke);
    rib.setStrokeWidth(2.4);
    canvas.drawLine(cx - span, cy, cx + span * 1.05, cy, rib);
    leaves.push(r);
  }

  const glow = cell(PETAL_VARIANTS + LEAF_VARIANTS, 1);
  const glowPaint = Skia.Paint();
  glowPaint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(glow.x + CELL / 2, glow.y + CELL / 2),
      CELL / 2,
      [Skia.Color('rgba(255, 236, 190, 1)'), Skia.Color('rgba(255, 194, 14, 0.35)'), Skia.Color('rgba(255, 194, 14, 0)')],
      [0, 0.35, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(glow.x + CELL / 2, glow.y + CELL / 2, CELL / 2, glowPaint);

  surface.flush();
  const image = surface.makeImageSnapshot();
  return { image, heads, petals, leaves, glow };
}
