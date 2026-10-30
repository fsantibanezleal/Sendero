/**
 * The petal path from the far corner to the visitor's frame (research-visuals D2).
 *
 * - Curve: centripetal Catmull-Rom (Yuksel, Schaefer and Keyser 2011, DOI
 *   10.1016/j.cad.2010.08.008) through seeded control points that wander across the straight line
 *   from start to end, so it curves without cusps or loops.
 * - Arc length table for constant drawing speed (Guenter and Parent 1990, DOI 10.1109/38.55155).
 * - Petals: Poisson disk samples (Bridson 2007, DOI 10.1145/1278780.1278807) in a strip around the
 *   curve, with a radius that grows with depth, kept inside the band and thinned toward its edges.
 * - Pseudo-perspective: depth z = s / L goes from 0 at the far end to 1 at the frame; the band
 *   half-width and the petal size grow with z^1.5 and z^1.3.
 */
import {
  buildArcTable,
  catmullRomPolyline,
  mulberry32,
  pointAtDistance,
  poissonDisk,
  randRange,
  type ArcTable,
  type Point,
} from '../procedural';

export interface Petal {
  /** Arc length position along the curve, pixels. */
  s: number;
  x: number;
  y: number;
  rotation: number;
  /** Petal length in pixels at full reveal. */
  size: number;
  variant: number;
  /** Depth 0 (far) to 1 (near). */
  z: number;
}

export interface PetalPathData {
  control: Point[];
  polyline: Point[];
  table: ArcTable;
  petals: Petal[];
}

export interface PetalPathOptions {
  start: Point;
  end: Point;
  width: number;
  height: number;
  seed: number;
  petalVariants: number;
}

/** Half-width of the petal band at depth z, pixels. */
export function bandHalfWidth(z: number, height: number): number {
  'worklet';
  const zz = Math.max(0, Math.min(1, z));
  return height * (0.012 + 0.063 * Math.pow(zz, 1.5));
}

/** Petal length at depth z, pixels. */
export function petalSize(z: number, height: number): number {
  'worklet';
  const zz = Math.max(0, Math.min(1, z));
  return height * (0.009 + 0.026 * Math.pow(zz, 1.3));
}

export function controlPoints(o: PetalPathOptions): Point[] {
  const rng = mulberry32(o.seed);
  const n = 7;
  const dx = o.end.x - o.start.x;
  const dy = o.end.y - o.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const points: Point[] = [o.start];
  let sign = rng() < 0.5 ? -1 : 1;
  for (let i = 1; i < n - 1; i++) {
    const u = i / (n - 1);
    const amp = o.height * 0.11 * (1 - 0.35 * u) * randRange(rng, 0.65, 1.2);
    const x = o.start.x + dx * u + nx * amp * sign;
    const y = o.start.y + dy * u + ny * amp * sign;
    points.push({
      x: Math.max(0.04 * o.width, Math.min(0.96 * o.width, x)),
      y: Math.max(0.06 * o.height, Math.min(0.94 * o.height, y)),
    });
    sign = -sign;
  }
  points.push(o.end);
  return points;
}

export function buildPetalPath(o: PetalPathOptions): PetalPathData {
  const control = controlPoints(o);
  const polyline = catmullRomPolyline(control, 28);
  const table = buildArcTable(polyline);
  const L = table.total;
  const maxHalf = bandHalfWidth(1, o.height);
  const rng = mulberry32(o.seed ^ 0x51ed);

  // Sample the strip [0, L] x [-maxHalf, maxHalf]; the radius grows with depth.
  const rFar = o.height * 0.0055;
  const rNear = o.height * 0.017;
  const samples = poissonDisk({
    width: L,
    height: 2 * maxHalf,
    rMin: rFar,
    radiusAt: (s: number) => rFar + (rNear - rFar) * Math.pow(Math.max(0, Math.min(1, s / L)), 1.2),
    rng,
  });

  const petals: Petal[] = [];
  for (const q of samples) {
    const s = q.x;
    const d = q.y - maxHalf;
    const z = s / L;
    const half = bandHalfWidth(z, o.height);
    const rel = Math.abs(d) / half;
    if (rel > 1) continue;
    if (rng() > 1 - 0.6 * rel * rel) continue;
    const p = pointAtDistance(table, s);
    const nx = -p.ty;
    const ny = p.tx;
    petals.push({
      s,
      x: p.x + nx * d,
      y: p.y + ny * d,
      rotation: randRange(rng, 0, Math.PI * 2),
      size: petalSize(z, o.height) * randRange(rng, 0.8, 1.2),
      variant: Math.floor(rng() * o.petalVariants),
      z,
    });
  }
  // Far petals first so near ones overlap them.
  petals.sort((a, b) => a.z - b.z);
  return { control, polyline, table, petals };
}
