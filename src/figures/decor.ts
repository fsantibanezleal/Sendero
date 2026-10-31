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


/** Where the veladoras stand around a person's feet, in figure units: beside the body, never over it. */
function candlePlaces(entry: ArtEntry): { x: number; y: number; k: number }[] {
  const half = entry.aspect / 2;
  return [
    { x: -half - 0.05, y: 0, k: 1.5 },
    { x: -half - 0.15, y: -0.006, k: 1.2 },
    { x: half + 0.05, y: 0, k: 1.6 },
    { x: half + 0.15, y: -0.005, k: 1.25 },
    { x: half + 0.1, y: 0.014, k: 1.05 },
  ];
}

/** The flames of those veladoras, for the light that breathes over them. */
function flamesOf(entry: ArtEntry): { x: number; y: number }[] {
  return candlePlaces(entry).map((p) => ({ x: p.x, y: p.y - 0.062 * p.k - 0.03 * p.k }));
}

/**
 * A veladora of the altars standing on the ground: a small glass of amber light with a marigold on it, a slender
 * flame above. (x, y) is the foot of the glass, k its scale.
 */
function veladora(c: SkCanvas, x: number, y: number, k: number, rand: Rand) {
  const w = 0.05 * k;
  const h = 0.062 * k;
  const top = y - h;
  const glass = Skia.PathBuilder.Make();
  glass.moveTo(x - w / 2, top);
  glass.lineTo(x + w / 2, top);
  glass.quadTo(x + w * 0.44, y, x + w * 0.36, y);
  glass.lineTo(x - w * 0.36, y);
  glass.quadTo(x - w * 0.44, y, x - w / 2, top);
  glass.close();
  const body = glass.build();
  const light = fill('#FFFFFF');
  light.setShader(
    Skia.Shader.MakeLinearGradient(vec(0, top), vec(0, y), [Skia.Color('#FFE7A8'), Skia.Color('#F6A33A'), Skia.Color('#C9611E')], [0, 0.55, 1], TileMode.Clamp),
  );
  c.drawPath(body, light);
  c.drawPath(body, line('#FFF3DC', 0.0022 * k, 0.7));
  c.drawLine(x - w / 2, top + 0.004 * k, x + w / 2, top + 0.004 * k, line('#FFF7E6', 0.003 * k, 0.85));
  flower(c, x, top + h * 0.56, 0.013 * k, COLORS.marigoldLight, rand);
  const f = 0.052 * k;
  const drop = Skia.PathBuilder.Make();
  drop.moveTo(x, top - f);
  drop.cubicTo(x + 0.004 * k, top - f * 0.58, x + 0.013 * k, top - f * 0.31, x, top - 0.002 * k);
  drop.cubicTo(x - 0.013 * k, top - f * 0.31, x - 0.004 * k, top - f * 0.58, x, top - f);
  drop.close();
  c.drawPath(drop.build(), fill(COLORS.flame, 0.95));
  const heart = Skia.PathBuilder.Make();
  heart.moveTo(x, top - f * 0.58);
  heart.cubicTo(x + 0.002 * k, top - f * 0.35, x + 0.006 * k, top - f * 0.2, x, top - 0.004 * k);
  heart.cubicTo(x - 0.006 * k, top - f * 0.2, x - 0.002 * k, top - f * 0.35, x, top - f * 0.58);
  heart.close();
  c.drawPath(heart.build(), fill(COLORS.flameCore));
}

/** Several veladoras around the feet, as on an altar. */
function candles(c: SkCanvas, entry: ArtEntry, rand: Rand) {
  for (const p of candlePlaces(entry)) veladora(c, p.x, p.y, p.k, rand);
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
  if (holdsCandle) candles(c, entry, rand);
}

/** The colours of the alebrijes, the painted spirit animals of Oaxaca. */
const ALEBRIJE = ['#E4007C', '#00A6A6', '#F58A07', '#2456C8', '#6B3FA0', '#C8102E', '#2E8B57'];

/**
 * A pet as an alebrije (the owner, 2026-10-31): one strong colour, waves of two others edged in cream, dots and
 * flowers over it, the eye ringed like a calavera's, an inner outline. The people stay figures of light.
 */
function paintPet(c: SkCanvas, entry: ArtEntry, art: SkPath, rand: Rand) {
  const a = entry.anchors as PetAnchors;
  const pool = [...ALEBRIJE];
  const pick = () => pool.splice(Math.floor(rand() * pool.length), 1)[0];
  const [base, waveA, waveB] = [pick(), pick(), pick()];
  const w = entry.aspect;
  c.save();
  c.clipPath(art, ClipOp.Intersect, true);
  c.drawRect(Skia.XYWHRect(-w, -1.1, 2 * w, 1.2), fill(base, 0.95));
  const waves = 5;
  for (let i = 0; i < waves; i++) {
    const y = -0.92 + (i / (waves - 1)) * 0.86;
    const b = Skia.PathBuilder.Make();
    b.moveTo(-w, y);
    for (let x = -w; x < w; x += 0.24) {
      b.quadTo(x + 0.06, y + (Math.round((x + w) / 0.24) % 2 === 0 ? -0.14 : 0.14), x + 0.12, y);
      b.quadTo(x + 0.18, y, x + 0.24, y);
    }
    const path = b.build();
    c.drawPath(path, line(i % 2 === 0 ? waveA : waveB, 0.045));
    c.drawPath(path, line(COLORS.wax, 0.01));
  }
  for (let i = 0; i < 46; i++) {
    const x = -w / 2 + rand() * w;
    const y = -rand();
    if (i % 5 === 0) flower(c, x, y, 0.05, i % 2 === 0 ? COLORS.marigold : COLORS.rose, rand);
    else c.drawCircle(x, y, 0.012 + rand() * 0.012, fill(COLORS.wax));
  }
  c.drawPath(art, line('#3A1A3E', 0.022, 0.9));
  const er = 0.055;
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * 2 * Math.PI;
    c.drawCircle(a.head.x + Math.cos(t) * er * 1.05, a.head.y + Math.sin(t) * er * 1.05, er * 0.32, fill(COLORS.marigoldLight));
  }
  c.drawCircle(a.head.x, a.head.y, er * 0.95, fill(COLORS.wax));
  c.drawCircle(a.head.x, a.head.y, er * 0.55, fill('#3A1A3E'));
  c.restore();
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
  flames: { x: number; y: number }[];
}

/** Pixels per figure height at each size on screen, and of the glow, which is only soft light. */
export const FIGURE_PX = { family: 340, walk: 560, farewell: 760 };
const GLOW_PX = 110;
const MARGIN = 0.22;
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

/** The GPU image copied to memory once, so any thread's canvas can draw it. */
function snapshotOf(surface: { makeImageSnapshot: () => SkImage }): SkImage | null {
  const gpu = surface.makeImageSnapshot();
  const cpu = gpu.makeNonTextureImage();
  if (cpu != null) gpu.dispose();
  return cpu ?? gpu;
}

/** The halo baked small: a blur every frame is what a modest GPU cannot afford, a stretched image is nothing. */
function glowOf(id: string, width: number, height: number, x: number, y: number): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(Math.ceil(width * GLOW_PX), Math.ceil(height * GLOW_PX));
  if (surface == null) return null;
  const canvas = surface.getCanvas();
  canvas.scale(GLOW_PX, GLOW_PX);
  canvas.translate(-x, -y);
  const paint = fill('#FFD58A', 0.9);
  paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.045, true));
  canvas.drawPath(artPath(id), paint);
  surface.flush();
  return snapshotOf(surface);
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
  const surface = Skia.Surface.MakeOffscreen(Math.ceil(width * px), Math.ceil(height * px));
  if (surface == null) return null;
  const canvas = surface.getCanvas();
  canvas.scale(px, px);
  canvas.translate(-x, -y);
  canvas.drawPath(artPath(id), bodyPaint());
  canvas.drawPicture(picture);
  surface.flush();
  const person = holdsCandle && entry.archetype !== 'perro' && entry.archetype !== 'gato';
  const dressed = { image: snapshotOf(surface) ?? surface.makeImageSnapshot(), glow: glowOf(id, width, height, x, y), x, y, width, height, flames: person ? flamesOf(entry) : [] };
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, dressed);
  return dressed;
}

/**
 * The flowers for the visitor's hair: two or three, chosen at random for each visit (the owner, 2026-10-31: keep the
 * design, randomize the two or three), each at its own spot along the top of the head with a leaf behind it. In a unit
 * box, one head wide; the top of the head is at (0.5, 0.35).
 */
const CROWN_PX = 720;
const crowns = new Map<number, SkImage | null>();

export function visitorCrown(seed: number): SkImage | null {
  if (crowns.has(seed)) return crowns.get(seed) ?? null;
  const surface = Skia.Surface.MakeOffscreen(CROWN_PX, CROWN_PX);
  if (surface == null) return null;
  const c = surface.getCanvas();
  c.scale(CROWN_PX, CROWN_PX);
  const rand = mulberry32(seed * 7919 + 13);
  const count = rand() < 0.5 ? 2 : 3;
  // Spots along the top of the head as an ellipse, from one temple to the other, kept apart from each other.
  const spots: number[] = [];
  while (spots.length < count) {
    const u = 0.08 + rand() * 0.84;
    if (spots.every((v) => Math.abs(v - u) > 0.16)) spots.push(u);
  }
  const petals = [COLORS.marigold, COLORS.marigoldLight, COLORS.rose];
  for (const u of spots) {
    const a = Math.PI * (1.06 + 0.88 * u);
    const x = 0.5 + 0.47 * Math.cos(a);
    const y = 0.6 + 0.25 * Math.sin(a);
    leaf(c, x, y, 0.12, a + (rand() < 0.5 ? -0.6 : 0.6));
    flower(c, x, y, 0.065 + rand() * 0.025, petals[Math.floor(rand() * petals.length)], rand);
  }
  surface.flush();
  const image = snapshotOf(surface);
  if (crowns.size > 8) crowns.delete(crowns.keys().next().value as number);
  crowns.set(seed, image);
  return image;
}
