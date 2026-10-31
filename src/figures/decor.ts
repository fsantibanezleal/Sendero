/**
 * The dress of the Día de Muertos on the silhouette drawings: an inner contour stroke, calavera paint on the
 * face, a flower crown, a marigold necklace and embroidered clothing for the people; alebrije patterns and a flower
 * collar for the pets (docs/figures.md; the research is cited there). Painted once per figure, on the JS thread,
 * in figure units (feet at y = 0, height 1, facing right) and rendered into an image; the scene only places the image.
 * What is on the body is clipped to the silhouette; what rests on it (flowers) is not.
 */
import { ClipOp, PaintStyle, type SkCanvas, Skia, type SkImage, type SkPaint, type SkPath, type SkPicture, StrokeCap } from '@shopify/react-native-skia';

import type { ArtEntry, PersonAnchors, PetAnchors } from './artData';
import { artById } from './artData';
import { artPath } from './art';
import { mulberry32 } from '../procedural';

const COLORS = {
  ink: '#3A1A3E',
  bone: '#FFF4E0',
  marigold: '#F58A07',
  marigoldLight: '#FFC20E',
  rosa: '#E4007C',
  red: '#C8102E',
  turquoise: '#00A6A6',
  cobalt: '#2456C8',
  violet: '#6B3FA0',
  leaf: '#2E8B57',
};

/** The accent colors of a figure; a figure takes three, so each has its own harmony. */
const ACCENTS = [COLORS.rosa, COLORS.turquoise, COLORS.marigold, COLORS.cobalt, COLORS.violet, COLORS.red, COLORS.leaf];

type Rand = () => number;

function fill(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Fill);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  return p;
}

function line(color: string, width: number, alpha = 1): SkPaint {
  const p = fill(color, alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  return p;
}

function poly(points: [number, number][], close = false): SkPath {
  const b = Skia.PathBuilder.Make();
  points.forEach(([x, y], i) => (i === 0 ? b.moveTo(x, y) : b.lineTo(x, y)));
  if (close) b.close();
  return b.build();
}

/** A flower seen from above: rounds of petals around a core. */
function flower(c: SkCanvas, x: number, y: number, r: number, petal: string, core: string, rand: Rand) {
  const turn = rand() * Math.PI;
  for (const [count, reach, size, color] of [
    [9, 0.62, 0.44, petal],
    [6, 0.32, 0.34, COLORS.marigoldLight === petal ? COLORS.marigold : petal],
  ] as [number, number, number, string][]) {
    const paint = fill(color);
    for (let i = 0; i < count; i++) {
      const a = turn + (i / count) * 2 * Math.PI;
      c.drawCircle(x + Math.cos(a) * r * reach, y + Math.sin(a) * r * reach, r * size, paint);
    }
  }
  c.drawCircle(x, y, r * 0.2, fill(core));
}

function leaf(c: SkCanvas, x: number, y: number, r: number, a: number) {
  const b = Skia.PathBuilder.Make();
  b.moveTo(x, y);
  const tip: [number, number] = [x + Math.cos(a) * r, y + Math.sin(a) * r];
  const side = (s: number): [number, number] => [x + Math.cos(a + s) * r * 0.6, y + Math.sin(a + s) * r * 0.6];
  b.quadTo(...side(0.6), ...tip);
  b.quadTo(...side(-0.6), x, y);
  b.close();
  c.drawPath(b.build(), fill(COLORS.leaf));
}

/** A band across the body at height y: stripes with a repeated motif, the way a serape or a huipil is woven. */
function band(c: SkCanvas, cx: number, y: number, half: number, height: number, colors: string[], motif: number) {
  c.drawRect(Skia.XYWHRect(cx - half, y - height / 2, half * 2, height), fill(colors[0], 0.92));
  const edge = line(colors[1], height * 0.1);
  c.drawLine(cx - half, y - height * 0.42, cx + half, y - height * 0.42, edge);
  c.drawLine(cx - half, y + height * 0.42, cx + half, y + height * 0.42, edge);
  const step = height * 1.05;
  const count = Math.ceil(half / step);
  for (let i = -count; i <= count; i++) {
    const x = cx + i * step;
    const s = height * 0.28;
    if (motif === 0) {
      c.drawPath(poly([[x - s, y], [x, y - s], [x + s, y], [x, y + s]], true), fill(i % 2 === 0 ? colors[1] : colors[2]));
    } else if (motif === 1) {
      c.drawPath(poly([[x - step / 2, y + s], [x, y - s], [x + step / 2, y + s]]), line(colors[1], height * 0.1));
    } else {
      c.drawCircle(x, y, s * 0.8, fill(i % 2 === 0 ? colors[1] : colors[2]));
      c.drawCircle(x, y, s * 0.3, fill(COLORS.bone));
    }
  }
}

/** Calavera paint on the face (white base, flowers at the eyes, nose, stitched smile), clipped to the head. */
function calavera(c: SkCanvas, a: PersonAnchors, art: SkPath, accents: string[], rand: Rand) {
  const { x, y, r } = a.head;
  const profile = Math.abs(a.bias) > 0.12;
  // In a profile the face is the front part of the head and one eye shows.
  const fx = profile ? x + r * 0.28 : x;
  c.save();
  c.clipPath(art, ClipOp.Intersect, true);
  c.drawCircle(fx, y, r * 1.08, fill(COLORS.bone));
  const eyes = profile ? [fx + r * 0.32] : [fx - r * 0.42, fx + r * 0.42];
  const ey = y - r * 0.08;
  for (const ex of eyes) {
    const er = r * 0.33;
    const petal = fill(accents[0]);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * 2 * Math.PI;
      c.drawCircle(ex + Math.cos(t) * er * 1.05, ey + Math.sin(t) * er * 1.05, er * 0.3, petal);
    }
    c.drawCircle(ex, ey, er * 0.85, fill(COLORS.ink));
    c.drawCircle(ex, ey, er * 0.28, fill(accents[1]));
  }
  // The nose: an upside-down heart.
  const nx = profile ? fx + r * 0.62 : fx;
  const ny = y + r * 0.26;
  const ns = r * 0.13;
  c.drawPath(poly([[nx, ny - ns], [nx + ns, ny + ns], [nx - ns, ny + ns]], true), fill(COLORS.ink));
  // The stitched smile.
  const mh = profile ? r * 0.55 : r * 0.72;
  const mx = profile ? fx + r * 0.3 : fx;
  const my = y + r * 0.56;
  c.drawLine(mx - mh, my, mx + mh, my, line(COLORS.ink, r * 0.05));
  const stitches = profile ? 4 : 6;
  for (let i = 0; i <= stitches; i++) {
    const sx = mx - mh + (i / stitches) * 2 * mh;
    c.drawLine(sx, my - r * 0.1, sx, my + r * 0.1, line(COLORS.ink, r * 0.04));
  }
  // The forehead flower and the dots along the jaw.
  flower(c, fx + (profile ? r * 0.25 : 0), y - r * 0.68, r * 0.24, accents[1], COLORS.marigoldLight, rand);
  c.restore();
}

function crown(c: SkCanvas, a: PersonAnchors, art: SkPath, kind: string, accents: string[], rand: Rand) {
  const { x, y, r } = a.head;
  const full = kind === 'mujer' || kind === 'abuela';
  const count = full ? 9 : 3;
  const span = full ? 2.5 : 1;
  // Each flower seats on the rim of the head, or lower when a hat or the hair makes the outline differ from the
  // measured circle; it is never in the air. Under a hat this makes a band of flowers around the crown of the hat.
  const seat = (ang: number): [number, number] | null => {
    for (let k = 1.08; k >= 0.4; k -= 0.08) {
      const px = x + Math.cos(ang) * r * k;
      const py = y + Math.sin(ang) * r * k;
      if (art.contains(x + (px - x) * 0.72, y + (py - y) * 0.72)) return [px, py];
    }
    return null;
  };
  const places = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1) - 0.5;
    places.push({ i, t, ang: -Math.PI / 2 + t * span, at: seat(-Math.PI / 2 + t * span) });
  }
  for (const { i, t, ang, at } of places) {
    if (at != null && i % 2 === 0) leaf(c, at[0], at[1], r * 0.5, ang + (t < 0 ? -0.9 : 0.9));
  }
  for (const { i, at } of places) {
    if (at == null) continue;
    const size = r * (i % 3 === 1 ? 0.36 : 0.28);
    // Marigolds, with roses and the figure's color among them; the grandmother's are roses.
    const petal = kind === 'abuela' && i % 2 === 0 ? COLORS.red : i % 3 === 0 ? accents[0] : i % 3 === 1 ? COLORS.marigold : COLORS.marigoldLight;
    flower(c, at[0], at[1], size, petal, COLORS.marigoldLight === petal ? COLORS.marigold : COLORS.marigoldLight, rand);
  }
}

function necklace(c: SkCanvas, a: PersonAnchors, art: SkPath, rand: Rand) {
  const cx = a.neck.x;
  const half = Math.min(0.075, Math.max(0.04, a.shoulder.w * 0.3));
  const drop = 0.05;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1;
    const px = cx + t * half;
    const py = a.neck.y + 0.012 + (1 - t * t) * drop;
    // Only where it lies on the body: over a thin figure it would float in the air.
    if (art.contains(px, py)) flower(c, px, py, 0.016, i % 2 === 0 ? COLORS.marigold : COLORS.marigoldLight, COLORS.red, rand);
  }
}

/** The clothing lines and the embroidery of an archetype, clipped to the body. */
function clothes(c: SkCanvas, a: PersonAnchors, kind: string, accents: string[], art: SkPath, rand: Rand) {
  const trio = [COLORS.ink, accents[0], accents[1]];
  const cx = a.waist.x;
  const half = 0.5;
  const motif = Math.floor(rand() * 3);
  c.save();
  c.clipPath(art, ClipOp.Intersect, true);
  const stitch = line(COLORS.ink, 0.004, 0.75);
  // The garment: its color from the shoulders down, with the folds of the cloth drawn over it.
  // Skirts end at their hem; the men's clothes reach the shoes.
  const man = kind === 'abuelo' || kind === 'hombre';
  const bottom = man ? -0.015 : (a.hemY ?? -0.28);
  c.drawRect(Skia.XYWHRect(-1, a.shoulder.y - 0.02, 2, bottom - a.shoulder.y + 0.02), fill(kind === 'abuelo' ? COLORS.ink : accents[2], kind === 'abuelo' ? 0.82 : 0.62));
  const folds = 9;
  for (let i = 0; i < folds; i++) {
    const t = (i + 0.5) / folds - 0.5;
    const b = Skia.PathBuilder.Make();
    b.moveTo(cx + t * 0.16, a.waist.y);
    b.quadTo(cx + t * 0.5, (a.waist.y + bottom) / 2, cx + t * 0.9, bottom);
    c.drawPath(b.build(), line(i % 2 === 0 ? COLORS.bone : COLORS.ink, 0.0035, 0.5));
  }
  if (kind === 'abuela') {
    // The rebozo: a shawl across the shoulders, with its stripes and fringe.
    const yTop = a.shoulder.y;
    const yLow = a.shoulder.y + (a.waist.y - a.shoulder.y) * 0.75;
    c.drawPath(poly([[cx - half, yTop - 0.02], [cx + half, yTop - 0.02], [cx + half, yTop + 0.02], [cx, yLow], [cx - half, yTop + 0.02]], true), fill(accents[0], 0.85));
    for (let i = 1; i <= 3; i++) {
      const k = i / 4;
      c.drawPath(poly([[cx - half, yTop], [cx, yTop + (yLow - yTop) * k], [cx + half, yTop]]), line(accents[1], 0.004));
    }
  } else if (kind === 'mujer') {
    // A huipil: the embroidered square yoke at the neck.
    band(c, cx, a.shoulder.y + 0.05, half, 0.06, trio, motif);
    band(c, cx, a.waist.y, half, 0.028, [accents[1], COLORS.bone, accents[0]], 2);
  } else if (kind === 'hombre') {
    // A serape across the chest, over one shoulder.
    c.save();
    c.translate(a.shoulder.x, (a.shoulder.y + a.waist.y) / 2);
    c.rotate(-32, 0, 0);
    band(c, 0, 0, half, 0.075, trio, motif);
    c.restore();
    c.drawLine(cx, a.neck.y, cx, a.waist.y, stitch);
  } else {
    // The catrín: open lapels, buttons, a red bow at the neck.
    c.drawPath(poly([[a.neck.x - a.neck.w, a.neck.y], [cx, a.waist.y - 0.04], [a.neck.x + a.neck.w, a.neck.y]], true), fill(COLORS.bone, 0.9));
    c.drawPath(poly([[a.neck.x - a.neck.w, a.neck.y], [cx, a.waist.y - 0.04], [a.neck.x + a.neck.w, a.neck.y]]), line(COLORS.ink, 0.005));
    for (let i = 1; i <= 3; i++) c.drawCircle(cx, a.neck.y + ((a.waist.y - a.neck.y) * i) / 4, 0.006, fill(accents[0]));
    band(c, cx, a.waist.y + 0.02, half, 0.022, [accents[0], COLORS.bone, accents[1]], 2);
  }
  // The hem and the flowers embroidered over the cloth.
  band(c, cx, bottom - 0.03, half, 0.05, [accents[0], COLORS.bone, accents[1]], motif);
  const rows = kind === 'abuelo' ? 0 : 3;
  for (let row = 0; row < rows; row++) {
    const y = a.waist.y + ((row + 0.6) / rows) * (bottom - 0.06 - a.waist.y);
    for (let i = -5; i <= 5; i++) {
      flower(c, cx + (i + (row % 2) * 0.5) * 0.07, y + (i % 2) * 0.012, 0.016, i % 2 === 0 ? accents[1] : COLORS.marigold, COLORS.marigoldLight, rand);
    }
  }
  c.restore();
}

/** The inner stroke that gives the shape an edge against the light. */
function contour(c: SkCanvas, art: SkPath, width: number) {
  c.save();
  c.clipPath(art, ClipOp.Intersect, true);
  c.drawPath(art, line(COLORS.ink, width, 0.9));
  c.restore();
}

function paintPerson(c: SkCanvas, entry: ArtEntry, art: SkPath, rand: Rand, accents: string[]) {
  const a = entry.anchors as PersonAnchors;
  clothes(c, a, entry.archetype, accents, art, rand);
  contour(c, art, 0.009);
  calavera(c, a, art, accents, rand);
  necklace(c, a, art, rand);
  crown(c, a, art, entry.archetype, accents, rand);
}

/** An alebrije: a strong color with waves, dots and flowers painted over it, a flower at the head. */
function paintPet(c: SkCanvas, entry: ArtEntry, art: SkPath, rand: Rand, accents: string[]) {
  const a = entry.anchors as PetAnchors;
  const w = entry.aspect;
  c.save();
  c.clipPath(art, ClipOp.Intersect, true);
  c.drawRect(Skia.XYWHRect(-w, -1.1, 2 * w, 1.2), fill(accents[2], 0.92));
  const waves = 5;
  for (let i = 0; i < waves; i++) {
    const y = -0.92 + (i / (waves - 1)) * 0.86;
    const b = Skia.PathBuilder.Make();
    b.moveTo(-w, y);
    for (let x = -w; x < w; x += 0.24) {
      b.quadTo(x + 0.06, y + (Math.round((x + w) / 0.24) % 2 === 0 ? -0.14 : 0.14), x + 0.12, y);
      b.quadTo(x + 0.18, y, x + 0.24, y);
    }
    c.drawPath(b.build(), line(accents[i % 2], 0.045));
    c.drawPath(b.build(), line(COLORS.bone, 0.01));
  }
  const dots = 46;
  for (let i = 0; i < dots; i++) {
    const x = -w / 2 + rand() * w;
    const y = -rand();
    if (i % 5 === 0) flower(c, x, y, 0.05, i % 2 === 0 ? COLORS.marigold : COLORS.rosa, COLORS.marigoldLight, rand);
    else c.drawCircle(x, y, 0.012 + rand() * 0.012, fill(COLORS.bone));
  }
  c.drawPath(art, line(COLORS.ink, 0.022, 0.9));
  // The eye, ringed like the eye of a calavera.
  const er = 0.055;
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * 2 * Math.PI;
    c.drawCircle(a.head.x + Math.cos(t) * er * 1.05, a.head.y + Math.sin(t) * er * 1.05, er * 0.32, fill(COLORS.marigoldLight));
  }
  c.drawCircle(a.head.x, a.head.y, er * 0.95, fill(COLORS.bone));
  c.drawCircle(a.head.x, a.head.y, er * 0.55, fill(COLORS.ink));
  c.restore();
  const cluster: [number, number][] = [[-0.16, -0.06], [-0.2, 0.05], [-0.1, 0.09]];
  cluster.forEach(([dx, dy], i) => {
    const x = a.head.x + dx;
    const y = a.head.y + dy;
    if (art.contains(x, y)) flower(c, x, y, 0.065, i === 1 ? accents[0] : COLORS.marigold, COLORS.marigoldLight, rand);
  });
}

/** The picture of a drawing dressed for the day, in figure units. `seed` chooses the colors and the embroidery. */
export function decoratedPicture(id: string, seed: number): SkPicture | null {
  const entry = artById(id);
  if (entry == null) return null;
  const art = artPath(id);
  const rand = mulberry32(seed);
  const pool = [...ACCENTS];
  const accents = [0, 1, 2].map(() => pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(-2, -1.4, 4, 1.6));
  if (entry.archetype === 'perro' || entry.archetype === 'gato') paintPet(canvas, entry, art, rand, accents);
  else paintPerson(canvas, entry, art, rand, accents);
  return recorder.finishRecordingAsPicture();
}

/** A dressed figure: its image and the box it fills in figure units. */
export interface Dressed {
  image: SkImage;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pixels per figure height: as sharp as the farewell needs, where a figure is tallest. */
const IMAGE_PX = 900;
const MARGIN = 0.14;
const CACHE_SIZE = 12;
const cache = new Map<string, Dressed>();

/**
 * The figure rendered once on the CPU, so that drawing it costs one image per frame however rich the dress is.
 * A visit asks for the same figure in the family, on the path and at the farewell; the cache gives it back.
 */
export function dressedFigure(id: string, seed: number): Dressed | null {
  const key = `${id}:${seed}`;
  const cached = cache.get(key);
  if (cached != null) return cached;
  const entry = artById(id);
  const picture = decoratedPicture(id, seed);
  if (entry == null || picture == null) return null;
  const width = entry.aspect + 2 * MARGIN;
  const height = 1 + MARGIN + 0.02;
  const x = -width / 2;
  const y = -1 - MARGIN;
  const surface = Skia.Surface.Make(Math.ceil(width * IMAGE_PX), Math.ceil(height * IMAGE_PX));
  if (surface == null) return null;
  const canvas = surface.getCanvas();
  canvas.scale(IMAGE_PX, IMAGE_PX);
  canvas.translate(-x, -y);
  canvas.drawPath(artPath(id), fill('#FFEBC8', 0.94));
  canvas.drawPicture(picture);
  surface.flush();
  const dressed = { image: surface.makeImageSnapshot(), x, y, width, height };
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, dressed);
  return dressed;
}
