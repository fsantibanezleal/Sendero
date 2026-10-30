import type { Point } from '../geometry';
import { catmullRomBeziers, catmullRomPolyline, sampleBeziers } from '../spline';

const pts: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 40 },
  { x: 180, y: -30 },
  { x: 300, y: 60 },
  { x: 380, y: 10 },
];

describe('spline', () => {
  it('passes through every control point', () => {
    const poly = catmullRomPolyline(pts, 20);
    for (const p of pts) {
      const near = poly.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-9);
      expect(near).toBe(true);
    }
  });

  it('is C1 at joins (tangents parallel, same direction)', () => {
    const segs = catmullRomBeziers(pts);
    expect(segs).toHaveLength(4);
    for (let i = 0; i < segs.length - 1; i++) {
      const [, , c2, p3] = segs[i];
      const [q0, c1] = segs[i + 1];
      expect(q0).toEqual(p3);
      const inT = { x: p3.x - c2.x, y: p3.y - c2.y };
      const outT = { x: c1.x - q0.x, y: c1.y - q0.y };
      const cross = inT.x * outT.y - inT.y * outT.x;
      const dot = inT.x * outT.x + inT.y * outT.y;
      expect(Math.abs(cross)).toBeLessThan(
        1e-6 * Math.hypot(inT.x, inT.y) * Math.hypot(outT.x, outT.y),
      );
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('two points give the straight segment', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 20 };
    const poly = catmullRomPolyline([a, b], 10);
    expect(poly).toHaveLength(11);
    for (const p of poly) {
      expect(Math.abs(p.x * 2 - p.y)).toBeLessThan(1e-9);
    }
    expect(poly[0]).toEqual(a);
    expect(poly[10].x).toBeCloseTo(10, 12);
  });

  it('0 and 1 points do not throw', () => {
    expect(catmullRomPolyline([], 10)).toEqual([]);
    expect(catmullRomPolyline([{ x: 3, y: 4 }], 10)).toEqual([{ x: 3, y: 4 }]);
    expect(catmullRomBeziers([{ x: 3, y: 4 }])).toEqual([]);
  });

  it('coincident consecutive points never give NaN and are de-duplicated', () => {
    const dup: Point[] = [pts[0], pts[0], pts[1], pts[1], pts[1], pts[2]];
    const poly = catmullRomPolyline(dup, 10);
    for (const p of poly) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
    expect(catmullRomBeziers(dup)).toHaveLength(2);
    expect(catmullRomPolyline([pts[0], pts[0], pts[0]], 5)).toEqual([pts[0]]);
  });

  it('sampleBeziers includes the endpoints once', () => {
    const segs = catmullRomBeziers(pts);
    expect(sampleBeziers(segs, 8)).toHaveLength(4 * 8 + 1);
    expect(sampleBeziers([], 8)).toEqual([]);
  });

  it('rejects bad sample counts', () => {
    expect(() => sampleBeziers(catmullRomBeziers(pts), 0)).toThrow(RangeError);
  });
});
