/**
 * The silhouettes on the day of the dead. The owner's direction of 2026-10-31: the figure stays a warm, spiritual
 * silhouette of light with no face details; a few flowers rest in the hair and on the body; in the frontal view the
 * person holds a candle (docs/figures.md). Painted once per figure, on the JS thread, in figure units (feet at
 * y = 0, height 1, facing right) and rendered into an image; the scene only places the image.
 */
import { BlurStyle, ClipOp, PaintStyle, type SkCanvas, Skia, type SkImage, type SkPaint, type SkPath, type SkPicture, StrokeCap, TileMode, vec } from '@shopify/react-native-skia';

import type { ArtEntry, PersonAnchors, PetAnchors } from './artData';
import { artById } from './artData';
import { artPath } from './art';
import { mulberry32 } from '../procedural';

const COLORS = {
  stroke: '#8E5E3C',
  marigold: '#F59A23',
  marigoldLight: '#FFC94A',
  rose: '#E8748F',
  leaf: '#7FA36B',
  wax: '#FFF3DC',
  flame: '#FFD36B',
  flameCore: '#FFF7DC',
};

const PETALS = [COLORS.marigold, COLORS.marigoldLight, COLORS.rose];

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

/** A soft flower seen from above: rounds of petals around a core. */
function flower(c: SkCanvas, x: number, y: number, r: number, petal: string, rand: Rand) {
  const turn = rand() * Math.PI;
  const outer = fill(petal, 0.95);
  for (let i = 0; i < 9; i++) {
    const a = turn + (i / 9) * 2 * Math.PI;
    c.drawCircle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.42, outer);
  }
  const inner = fill(petal === COLORS.marigoldLight ? COLORS.marigold : COLORS.marigoldLight, 0.9);
  for (let i = 0; i < 6; i++) {
    const a = turn + 0.3 + (i / 6) * 2 * Math.PI;
    c.drawCircle(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.3, inner);
  }
  c.drawCircle(x, y, r * 0.15, fill(COLORS.stroke, 0.8));
}

function leaf(c: SkCanvas, x: number, y: number, r: number, a: number) {
  const b = Skia.PathBuilder.Make();
  b.moveTo(x, y);
  const tipX = x + Math.cos(a) * r;
  const tipY = y + Math.sin(a) * r;
  b.quadTo(x + Math.cos(a + 0.6) * r * 0.6, y + Math.sin(a + 0.6) * r * 0.6, tipX, tipY);
  b.quadTo(x + Math.cos(a - 0.6) * r * 0.6, y + Math.sin(a - 0.6) * r * 0.6, x, y);
  b.close();
  c.drawPath(b.build(), fill(COLORS.leaf, 0.9));
}

/** A few flowers in the hair or at the hat, seated on the outline, never in the air. */
function hairFlowers(c: SkCanvas, a: PersonAnchors, art: SkPath, kind: string, rand: Rand) {
  const { x, y, r } = a.head;
  const women = kind === 'mujer' || kind === 'abuela';
  const angles = women ? [-2.35, -1.95, -1.55, -1.15] : [-1.3, -1.75];
  angles.forEach((ang, i) => {
    for (let k = 1.05; k >= 0.5; k -= 0.08) {
      const px = x + Math.cos(ang) * r * k;
      const py = y + Math.sin(ang) * r * k;
      if (!art.contains(x + (px - x) * 0.72, y + (py - y) * 0.72)) continue;
      if (i % 2 === 0) leaf(c, px, py, r * 0.42, ang + 0.9);
      flower(c, px, py, r * (i % 2 === 0 ? 0.3 : 0.23), PETALS[(i + (kind === 'abuela' ? 2 : 0)) % 3], rand);
      break;
    }
  });
}

/** One small accessory on the body: flowers at the collar and, for some figures, at the waist. */
function bodyFlowers(c: SkCanvas, a: PersonAnchors, art: SkPath, rand: Rand) {
  const spots: [number, number, number][] = [
    [a.neck.x + a.shoulder.w * 0.16, a.shoulder.y + 0.012, 0.016],
    [a.neck.x + a.shoulder.w * 0.28, a.shoulder.y + 0.03, 0.012],
  ];
  if (rand() < 0.5) spots.push([a.waist.x - a.waist.w * 0.2, a.waist.y, 0.014]);
  spots.forEach(([x, y, r], i) => {
    if (art.contains(x, y)) flower(c, x, y, r, PETALS[i % 3], rand);
  });
}

/** Where the flame of a person's candle is, in figure units. */
function flameAt(a: PersonAnchors): { x: number; y: number } {
  const cx = a.waist.x + a.waist.w * 0.2;
  return { x: cx, y: a.shoulder.y + (a.waist.y - a.shoulder.y) * 0.34 - 0.03 };
}

/** The candle of the day held before the chest in both hands: white wax, a marigold band, a small flower. */
function candle(c: SkCanvas, a: PersonAnchors, rand: Rand) {
  const flame = flameAt(a);
  const w = 0.03;
  const top = flame.y + 0.03;
  const bottom = top + 0.15;
  const x = flame.x;
  const wax = Skia.RRectXY(Skia.XYWHRect(x - w / 2, top, w, bottom - top), 0.006, 0.006);
  c.drawRRect(wax, fill(COLORS.wax));
  c.drawRRect(wax, line(COLORS.stroke, 0.0025, 0.7));
  c.drawRect(Skia.XYWHRect(x - w / 2, top + 0.035, w, 0.012), fill(COLORS.marigold, 0.9));
  flower(c, x, top + 0.075, 0.013, COLORS.rose, rand);
  c.drawLine(x, top, x, top - 0.008, line(COLORS.stroke, 0.0025));
  const drop = Skia.PathBuilder.Make();
  drop.moveTo(x, top - 0.05);
  drop.quadTo(x + 0.017, top - 0.02, x, top - 0.006);
  drop.quadTo(x - 0.017, top - 0.02, x, top - 0.05);
  drop.close();
  c.drawPath(drop.build(), fill(COLORS.flame));
  c.drawCircle(x, top - 0.018, 0.005, fill(COLORS.flameCore));
  // The hands around the wax, the same light as the body, with the fingers in strokes.
  const hy = bottom - 0.05;
  const hand = Skia.XYWHRect(x - 0.03, hy - 0.016, 0.06, 0.032);
  c.drawOval(hand, fill('#FFE9C4'));
  c.drawOval(hand, line(COLORS.stroke, 0.003, 0.75));
  for (let i = -1; i <= 1; i++) {
    c.drawLine(x + i * 0.012, hy - 0.013, x + i * 0.012, hy + 0.005, line(COLORS.stroke, 0.002, 0.6));
  }
}

/** The inner stroke that gives the shape an edge against its own light. */
function contour(c: SkCanvas, art: SkPath, width: number) {
  c.save();
  c.clipPath(art, ClipOp.Intersect, true);
  c.drawPath(art, line(COLORS.stroke, width, 0.45));
  c.restore();
}

function paintPerson(c: SkCanvas, entry: ArtEntry, art: SkPath, rand: Rand, holdsCandle: boolean) {
  const a = entry.anchors as PersonAnchors;
  contour(c, art, 0.007);
  hairFlowers(c, a, art, entry.archetype, rand);
  bodyFlowers(c, a, art, rand);
  if (holdsCandle) candle(c, a, rand);
}

/** A pet of light: its outline and a few flowers at the neck. */
function paintPet(c: SkCanvas, entry: ArtEntry, art: SkPath, rand: Rand) {
  const a = entry.anchors as PetAnchors;
  contour(c, art, 0.02);
  const cluster: [number, number][] = [[-0.16, 0.02], [-0.2, 0.1]];
  cluster.forEach(([dx, dy], i) => {
    const x = a.head.x + dx;
    const y = a.head.y + dy;
    if (art.contains(x, y)) flower(c, x, y, 0.06, PETALS[i], rand);
  });
}

/** The strokes and flowers of a drawing, in figure units. `seed` varies the flowers. */
export function decoratedPicture(id: string, seed: number, holdsCandle = false): SkPicture | null {
  const entry = artById(id);
  if (entry == null) return null;
  const art = artPath(id);
  const rand = mulberry32(seed);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(-2, -1.4, 4, 1.6));
  if (entry.archetype === 'perro' || entry.archetype === 'gato') paintPet(canvas, entry, art, rand);
  else paintPerson(canvas, entry, art, rand, holdsCandle);
  return recorder.finishRecordingAsPicture();
}

/** A dressed figure: its image, its soft glow, the box they fill and the flame of its candle, in figure units. */
export interface Dressed {
  image: SkImage;
  glow: SkImage | null;
  x: number;
  y: number;
  width: number;
  height: number;
  flame: { x: number; y: number } | null;
}

/** Pixels per figure height at each size on screen, and of the glow, which is only soft light. */
export const FIGURE_PX = { family: 340, walk: 560, farewell: 760 };
const GLOW_PX = 110;
const MARGIN = 0.14;
const CACHE_SIZE = 12;
const cache = new Map<string, Dressed>();

/** The body of light: warm cream that fades toward the feet, as a soul seen by candlelight. */
export function bodyPaint(): SkPaint {
  const p = fill('#FFFFFF');
  p.setShader(
    Skia.Shader.MakeLinearGradient(
      vec(0, -1),
      vec(0, 0),
      ['rgba(255, 246, 230, 0.92)', 'rgba(255, 226, 170, 0.76)', 'rgba(255, 213, 138, 0.5)', 'rgba(255, 213, 138, 0.16)'].map((v) => Skia.Color(v)),
      [0, 0.55, 0.9, 1],
      TileMode.Clamp,
    ),
  );
  return p;
}

/** The halo baked small: a blur every frame is what a modest GPU cannot afford, a stretched image is nothing. */
function glowOf(id: string, width: number, height: number, x: number, y: number): SkImage | null {
  const surface = Skia.Surface.Make(Math.ceil(width * GLOW_PX), Math.ceil(height * GLOW_PX));
  if (surface == null) return null;
  const canvas = surface.getCanvas();
  canvas.scale(GLOW_PX, GLOW_PX);
  canvas.translate(-x, -y);
  const paint = fill('#FFD58A', 0.9);
  paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.045, true));
  canvas.drawPath(artPath(id), paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/** The figure rendered once on the CPU, so that drawing it costs one image per frame. */
export function dressedFigure(id: string, seed: number, px: number, holdsCandle = false): Dressed | null {
  const key = `${id}:${seed}:${px}:${holdsCandle}`;
  const cached = cache.get(key);
  if (cached != null) return cached;
  const entry = artById(id);
  const picture = decoratedPicture(id, seed, holdsCandle);
  if (entry == null || picture == null) return null;
  const width = entry.aspect + 2 * MARGIN;
  const height = 1 + MARGIN + 0.02;
  const x = -width / 2;
  const y = -1 - MARGIN;
  const surface = Skia.Surface.Make(Math.ceil(width * px), Math.ceil(height * px));
  if (surface == null) return null;
  const canvas = surface.getCanvas();
  canvas.scale(px, px);
  canvas.translate(-x, -y);
  canvas.drawPath(artPath(id), bodyPaint());
  canvas.drawPicture(picture);
  surface.flush();
  const person = holdsCandle && entry.archetype !== 'perro' && entry.archetype !== 'gato';
  const dressed = { image: surface.makeImageSnapshot(), glow: glowOf(id, width, height, x, y), x, y, width, height, flame: person ? flameAt(entry.anchors as PersonAnchors) : null };
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, dressed);
  return dressed;
}

/**
 * The little crown for the visitor's hair: flowers along an arc, one unit wide (one head width), its middle at the
 * origin of the unit box's top third, the top of the head. Rendered once.
 */
let visitorCrownImage: SkImage | null = null;
const CROWN_PX = 320;

export function visitorCrown(): SkImage | null {
  if (visitorCrownImage != null) return visitorCrownImage;
  const surface = Skia.Surface.Make(CROWN_PX, CROWN_PX);
  if (surface == null) return null;
  const c = surface.getCanvas();
  c.scale(CROWN_PX, CROWN_PX);
  c.translate(0.5, 0.35);
  const rand = mulberry32(7);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1;
    if (i % 2 === 0) leaf(c, t * 0.42, t * t * 0.24, 0.1, -Math.PI / 2 + t);
  }
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1;
    flower(c, t * 0.42, t * t * 0.24, i % 2 === 0 ? 0.06 : 0.045, PETALS[i % 3], rand);
  }
  surface.flush();
  visitorCrownImage = surface.makeImageSnapshot();
  return visitorCrownImage;
}
