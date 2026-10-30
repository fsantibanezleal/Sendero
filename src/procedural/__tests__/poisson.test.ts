import { poissonDisk } from '../poisson';
import { mulberry32 } from '../random';

/** For each pair, the distance is at least the radius of the later-inserted point. */
function checkInvariant(
  pts: { x: number; y: number }[],
  radiusAt: (x: number, y: number) => number,
): boolean {
  for (let j = 1; j < pts.length; j++) {
    const rj = radiusAt(pts[j].x, pts[j].y);
    for (let i = 0; i < j; i++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < rj - 1e-9) return false;
    }
  }
  return true;
}

describe('poissonDisk', () => {
  it('keeps the min distance for a constant radius and stays inside the area', () => {
    const pts = poissonDisk({ width: 300, height: 200, rMin: 12, rng: mulberry32(1) });
    expect(pts.length).toBeGreaterThan(50);
    expect(checkInvariant(pts, () => 12)).toBe(true);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(300);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(200);
    }
  });

  it('keeps the invariant on a field whose radius doubles across the width', () => {
    const W = 400;
    const field = (x: number) => 8 + (8 * x) / W;
    const pts = poissonDisk({
      width: W,
      height: 250,
      rMin: 8,
      radiusAt: (x) => field(x),
      rng: mulberry32(2),
    });
    expect(pts.length).toBeGreaterThan(100);
    expect(checkInvariant(pts, (x) => field(x))).toBe(true);
    const left = pts.filter((p) => p.x < W / 2).length;
    expect(left).toBeGreaterThan(pts.length - left);
  });

  it('density for a constant radius is within the blue-noise band', () => {
    const W = 600;
    const H = 400;
    const r = 10;
    const pts = poissonDisk({ width: W, height: H, rMin: r, rng: mulberry32(3) });
    const norm = (W * H) / (r * r);
    expect(pts.length).toBeGreaterThan(0.35 * norm);
    expect(pts.length).toBeLessThan(0.8 * norm);
  });

  it('is deterministic for the same seed', () => {
    const a = poissonDisk({ width: 200, height: 200, rMin: 9, rng: mulberry32(4) });
    const b = poissonDisk({ width: 200, height: 200, rMin: 9, rng: mulberry32(4) });
    expect(a).toEqual(b);
  });

  it('clamps radiusAt to at least rMin and honours maxPoints', () => {
    const pts = poissonDisk({
      width: 200,
      height: 200,
      rMin: 10,
      radiusAt: () => 1,
      rng: mulberry32(5),
    });
    expect(checkInvariant(pts, () => 10)).toBe(true);
    const few = poissonDisk({ width: 200, height: 200, rMin: 5, maxPoints: 7, rng: mulberry32(5) });
    expect(few).toHaveLength(7);
  });

  it('throws RangeError for a non-positive rMin or size', () => {
    for (const rMin of [0, -1, NaN]) {
      expect(() => poissonDisk({ width: 10, height: 10, rMin, rng: mulberry32(1) })).toThrow(
        RangeError,
      );
    }
    expect(() => poissonDisk({ width: 0, height: 10, rMin: 1, rng: mulberry32(1) })).toThrow(
      RangeError,
    );
  });

  it('handles an area smaller than the radius', () => {
    const pts = poissonDisk({ width: 2, height: 2, rMin: 50, rng: mulberry32(1) });
    expect(pts).toHaveLength(1);
  });

  it('samples 1600 x 900 at rMin 6 in under 300 ms', () => {
    const t0 = performance.now();
    const pts = poissonDisk({ width: 1600, height: 900, rMin: 6, rng: mulberry32(6) });
    const dt = performance.now() - t0;
    expect(pts.length).toBeGreaterThan(10000);
    if (!process.env.CI) expect(dt).toBeLessThan(300);
  });
});
