import type { Point } from './geometry';

export type BezierSegment = [Point, Point, Point, Point];

function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

/**
 * Cubic Bezier segments (p0, c1, c2, p3) equal to the Catmull-Rom curve through `points`
 * (Yuksel, Schaefer, Keyser 2011; alpha 0.5 is centripetal). End tangents come from reflected
 * phantom points. Consecutive duplicate points are removed first.
 */
export function catmullRomBeziers(points: readonly Point[], alpha = 0.5): BezierSegment[] {
  const pts = dedupe(points);
  const n = pts.length;
  if (n < 2) return [];
  const first = pts[0];
  const last = pts[n - 1];
  const ext: Point[] = [
    { x: 2 * first.x - pts[1].x, y: 2 * first.y - pts[1].y },
    ...pts,
    { x: 2 * last.x - pts[n - 2].x, y: 2 * last.y - pts[n - 2].y },
  ];
  const e = (a: Point, b: Point) => Math.pow(Math.hypot(b.x - a.x, b.y - a.y), alpha);
  const segs: BezierSegment[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = ext[i];
    const p1 = ext[i + 1];
    const p2 = ext[i + 2];
    const p3 = ext[i + 3];
    const e1 = e(p0, p1);
    const e2 = e(p1, p2);
    const e3 = e(p2, p3);
    const a1 = 3 * e1 * (e1 + e2);
    const a2 = 3 * e3 * (e3 + e2);
    const k1 = 2 * e1 * e1 + 3 * e1 * e2 + e2 * e2;
    const k2 = 2 * e3 * e3 + 3 * e3 * e2 + e2 * e2;
    const c1: Point = {
      x: (e1 * e1 * p2.x - e2 * e2 * p0.x + k1 * p1.x) / a1,
      y: (e1 * e1 * p2.y - e2 * e2 * p0.y + k1 * p1.y) / a1,
    };
    const c2: Point = {
      x: (e3 * e3 * p1.x - e2 * e2 * p3.x + k2 * p2.x) / a2,
      y: (e3 * e3 * p1.y - e2 * e2 * p3.y + k2 * p2.y) / a2,
    };
    segs.push([p1, c1, c2, p2]);
  }
  return segs;
}

/** Samples each segment `samplesPerSegment` times; shared endpoints appear once. */
export function sampleBeziers(
  segments: readonly BezierSegment[],
  samplesPerSegment: number,
): Point[] {
  if (!Number.isInteger(samplesPerSegment) || samplesPerSegment < 1) {
    throw new RangeError(
      `sampleBeziers: samplesPerSegment must be an integer >= 1, got ${samplesPerSegment}`,
    );
  }
  const out: Point[] = [];
  segments.forEach(([p0, c1, c2, p3], si) => {
    if (si === 0) out.push({ x: p0.x, y: p0.y });
    for (let i = 1; i < samplesPerSegment; i++) {
      const t = i / samplesPerSegment;
      const u = 1 - t;
      const b0 = u * u * u;
      const b1 = 3 * u * u * t;
      const b2 = 3 * u * t * t;
      const b3 = t * t * t;
      out.push({
        x: b0 * p0.x + b1 * c1.x + b2 * c2.x + b3 * p3.x,
        y: b0 * p0.y + b1 * c1.y + b2 * c2.y + b3 * p3.y,
      });
    }
    out.push({ x: p3.x, y: p3.y });
  });
  return out;
}

/** Dense polyline of the Catmull-Rom curve; 0 points give [], 1 point gives that point. */
export function catmullRomPolyline(
  points: readonly Point[],
  samplesPerSegment: number,
  alpha = 0.5,
): Point[] {
  const pts = dedupe(points);
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ x: pts[0].x, y: pts[0].y }];
  return sampleBeziers(catmullRomBeziers(pts, alpha), samplesPerSegment);
}
