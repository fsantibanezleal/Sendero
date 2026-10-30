/**
 * Layout of the cempasuchil garland along the border of a rectangle (research-visuals D3).
 *
 * The heads follow the centre line of the border band (a rounded rectangle inset by half the band),
 * spaced by arc length so the density is the same for any aspect ratio. Two rows (a larger outer
 * row and a smaller inner row offset by half a step), small jitter in position, size and rotation,
 * and leaves tucked between the heads on the inner side. Pure data; the scene draws it as an atlas.
 */
import { mulberry32, randInt, randRange } from '../procedural';

export type SpriteKind = 'head' | 'leaf';

export interface GarlandSprite {
  kind: SpriteKind;
  variant: number;
  x: number;
  y: number;
  /** Diameter (head) or length (leaf) in pixels. */
  size: number;
  rotation: number;
}

export interface BorderPoint {
  x: number;
  y: number;
  /** Unit normal pointing out of the rectangle. */
  nx: number;
  ny: number;
}

/** A point at arc length s along a rounded rectangle centred in [0, w] x [0, h] with inset i. */
export function borderPoint(w: number, h: number, inset: number, radius: number, s: number): BorderPoint {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  const top = x1 - x0 - 2 * r;
  const side = y1 - y0 - 2 * r;
  const arc = (Math.PI / 2) * r;
  const total = 2 * top + 2 * side + 4 * arc;
  let t = ((s % total) + total) % total;
  // Top edge, left to right.
  if (t < top) return { x: x0 + r + t, y: y0, nx: 0, ny: -1 };
  t -= top;
  if (t < arc) {
    const a = -Math.PI / 2 + t / r;
    return { x: x1 - r + Math.cos(a) * r, y: y0 + r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  t -= arc;
  if (t < side) return { x: x1, y: y0 + r + t, nx: 1, ny: 0 };
  t -= side;
  if (t < arc) {
    const a = t / r;
    return { x: x1 - r + Math.cos(a) * r, y: y1 - r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  t -= arc;
  if (t < top) return { x: x1 - r - t, y: y1, nx: 0, ny: 1 };
  t -= top;
  if (t < arc) {
    const a = Math.PI / 2 + t / r;
    return { x: x0 + r + Math.cos(a) * r, y: y1 - r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  t -= arc;
  if (t < side) return { x: x0, y: y1 - r - t, nx: -1, ny: 0 };
  t -= side;
  const a = Math.PI + t / r;
  return { x: x0 + r + Math.cos(a) * r, y: y0 + r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
}

export function borderLength(w: number, h: number, inset: number, radius: number): number {
  const x = w - 2 * inset;
  const y = h - 2 * inset;
  const r = Math.max(0, Math.min(radius, x / 2, y / 2));
  return 2 * (x - 2 * r) + 2 * (y - 2 * r) + 2 * Math.PI * r;
}

export interface GarlandOptions {
  width: number;
  height: number;
  band: number;
  seed: number;
  headVariants: number;
  leafVariants: number;
}

/** Sprites of the garland, leaves first (drawn behind), then the outer row, then the inner row. */
export function garlandSprites(o: GarlandOptions): GarlandSprite[] {
  const rng = mulberry32(o.seed);
  const inset = o.band / 2;
  const radius = o.band;
  const L = borderLength(o.width, o.height, inset, radius);
  const leaves: GarlandSprite[] = [];
  const outer: GarlandSprite[] = [];
  const inner: GarlandSprite[] = [];

  const rows = [
    { list: outer, size: 1.04 * o.band, offset: 0.16 * o.band, phase: 0 },
    { list: inner, size: 0.82 * o.band, offset: -0.24 * o.band, phase: 0.5 },
  ];
  for (const row of rows) {
    const step = 0.68 * row.size;
    const n = Math.max(4, Math.round(L / step));
    for (let i = 0; i < n; i++) {
      const s = ((i + row.phase) / n) * L + randRange(rng, -0.2, 0.2) * step;
      const p = borderPoint(o.width, o.height, inset, radius, s);
      const off = row.offset + randRange(rng, -0.08, 0.08) * o.band;
      row.list.push({
        kind: 'head',
        variant: randInt(rng, 0, o.headVariants - 1),
        x: p.x + p.nx * off,
        y: p.y + p.ny * off,
        size: row.size * randRange(rng, 0.84, 1.16),
        rotation: randRange(rng, 0, Math.PI * 2),
      });
    }
  }

  const leafStep = 0.9 * o.band;
  const nl = Math.max(4, Math.round(L / leafStep));
  for (let i = 0; i < nl; i++) {
    const s = ((i + 0.25) / nl) * L;
    const p = borderPoint(o.width, o.height, inset, radius, s);
    const off = -0.42 * o.band;
    leaves.push({
      kind: 'leaf',
      variant: randInt(rng, 0, o.leafVariants - 1),
      x: p.x + p.nx * off,
      y: p.y + p.ny * off,
      size: o.band * randRange(rng, 0.75, 1.0),
      // Point the leaf inward, with a little spread.
      rotation: Math.atan2(-p.ny, -p.nx) + randRange(rng, -0.6, 0.6),
    });
  }
  return [...leaves, ...outer, ...inner];
}
