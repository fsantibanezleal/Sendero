import type { Point } from './geometry';

export type ArcTable = { points: Point[]; cumulative: number[]; total: number };

/** Cumulative chord lengths of a densely sampled polyline (Guenter and Parent 1990). */
export function buildArcTable(polyline: readonly Point[]): ArcTable {
  const points = polyline.map((p) => ({ x: p.x, y: p.y }));
  const cumulative: number[] = new Array(points.length);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cumulative[i] = total;
  }
  return { points, cumulative, total };
}

export type PathSample = { x: number; y: number; tx: number; ty: number };

/** Point and unit tangent at distance `s` along the table; `s` is clamped to [0, total]. */
export function pointAtDistance(table: ArcTable, s: number): PathSample {
  'worklet';
  const pts = table.points;
  const cum = table.cumulative;
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0, tx: 1, ty: 0 };
  if (n === 1 || !(table.total > 0)) return { x: pts[0].x, y: pts[0].y, tx: 1, ty: 0 };
  const d = s < 0 || s !== s ? 0 : s > table.total ? table.total : s;
  // Smallest i in [1, n - 1] with cum[i] > d; the segment (i - 1, i) then has positive length.
  let lo = 1;
  let hi = n - 1;
  if (cum[hi] <= d) {
    while (hi > 1 && cum[hi] === cum[hi - 1]) hi--;
    lo = hi;
  } else {
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] > d) hi = mid;
      else lo = mid + 1;
    }
  }
  const a = pts[lo - 1];
  const b = pts[lo];
  const t = (d - cum[lo - 1]) / (cum[lo] - cum[lo - 1]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
    tx: len > 0 ? dx / len : 1,
    ty: len > 0 ? dy / len : 0,
  };
}

/** Same as pointAtDistance with `u` in [0, 1] (clamped) as a fraction of the total length. */
export function pointAtFraction(table: ArcTable, u: number): PathSample {
  'worklet';
  const f = u < 0 || u !== u ? 0 : u > 1 ? 1 : u;
  return pointAtDistance(table, f * table.total);
}
