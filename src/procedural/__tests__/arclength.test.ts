import { buildArcTable, pointAtDistance, pointAtFraction } from '../arclength';
import { catmullRomPolyline } from '../spline';

describe('arclength', () => {
  it('total of a straight line is exact', () => {
    const t = buildArcTable([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 6, y: 8 },
    ]);
    expect(t.total).toBeCloseTo(10, 12);
    expect(t.cumulative).toEqual([0, 5, 10]);
  });

  it('circle sampled at 4000 points is within 0.1 percent of 2 pi r', () => {
    const r = 50;
    const poly = Array.from({ length: 4001 }, (_, i) => ({
      x: r * Math.cos((2 * Math.PI * i) / 4000),
      y: r * Math.sin((2 * Math.PI * i) / 4000),
    }));
    const t = buildArcTable(poly);
    expect(Math.abs(t.total - 2 * Math.PI * r) / (2 * Math.PI * r)).toBeLessThan(0.001);
  });

  it('interpolates and returns unit tangents', () => {
    const t = buildArcTable([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(pointAtDistance(t, 5)).toEqual({ x: 5, y: 0, tx: 1, ty: 0 });
    const q = pointAtDistance(t, 15);
    expect(q.x).toBeCloseTo(10, 12);
    expect(q.y).toBeCloseTo(5, 12);
    expect(q.tx).toBeCloseTo(0, 12);
    expect(q.ty).toBeCloseTo(1, 12);
    const m = pointAtFraction(t, 0.5);
    expect(m.x).toBeCloseTo(10, 12);
    expect(m.y).toBeCloseTo(0, 12);
  });

  it('clamps below 0 and above total, with finite unit tangents', () => {
    const t = buildArcTable([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    for (const s of [-5, 0, 10, 99]) {
      const p = pointAtDistance(t, s);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 12);
    }
    expect(pointAtDistance(t, -5).x).toBe(0);
    expect(pointAtDistance(t, 99).x).toBe(10);
    expect(pointAtFraction(t, 2).x).toBe(10);
    expect(pointAtFraction(t, -1).x).toBe(0);
  });

  it('zero-length and single-point tables return the point with tangent (1, 0)', () => {
    const polys = [[{ x: 2, y: 3 }], [{ x: 2, y: 3 }, { x: 2, y: 3 }]];
    for (const poly of polys) {
      const t = buildArcTable(poly);
      expect(t.total).toBe(0);
      for (const s of [-1, 0, 1]) {
        expect(pointAtDistance(t, s)).toEqual({ x: 2, y: 3, tx: 1, ty: 0 });
      }
    }
    expect(buildArcTable([]).total).toBe(0);
  });

  it('is monotonic along a spline', () => {
    const poly = catmullRomPolyline(
      [
        { x: 0, y: 0 },
        { x: 100, y: 80 },
        { x: 200, y: 0 },
        { x: 300, y: 90 },
      ],
      50,
    );
    const t = buildArcTable(poly);
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const s = (t.total * i) / 200;
      const p = pointAtDistance(t, s);
      const walked = buildArcTable([...t.points.filter((_, k) => t.cumulative[k] <= s), p]).total;
      expect(walked).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = walked;
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 9);
    }
  });

  it('a duplicated vertex does not give NaN tangents', () => {
    const d = buildArcTable([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ]);
    for (const s of [0, 2, 5, 7, 10]) {
      const p = pointAtDistance(d, s);
      expect(Number.isNaN(p.tx) || Number.isNaN(p.ty) || Number.isNaN(p.x)).toBe(false);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 12);
    }
  });

  it('builds a 2000-sample table in under 20 ms', () => {
    const poly = Array.from({ length: 2000 }, (_, i) => ({ x: i, y: Math.sin(i / 50) * 30 }));
    buildArcTable(poly);
    const t0 = performance.now();
    buildArcTable(poly);
    const dt = performance.now() - t0;
    if (!process.env.CI) expect(dt).toBeLessThan(20);
  });
});
