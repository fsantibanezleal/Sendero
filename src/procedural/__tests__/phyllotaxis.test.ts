import { GOLDEN_ANGLE, vogel } from '../phyllotaxis';

describe('phyllotaxis', () => {
  it('golden angle is about 137.50776 degrees', () => {
    expect((GOLDEN_ANGLE * 180) / Math.PI).toBeCloseTo(137.50776, 5);
  });

  it('radii equal c sqrt(n) and angles step by the golden angle', () => {
    const c = 3.5;
    const pts = vogel(200, c);
    expect(pts).toHaveLength(200);
    pts.forEach((p, n) => {
      expect(p.index).toBe(n);
      expect(p.r).toBeCloseTo(c * Math.sqrt(n), 10);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(p.r, 9);
      if (n > 0) {
        expect(p.angle - pts[n - 1].angle).toBeCloseTo(GOLDEN_ANGLE, 10);
      }
    });
  });

  it('rotation offsets every angle, count 0 is empty, negative throws', () => {
    const a = vogel(10, 1, 0);
    const b = vogel(10, 1, 0.5);
    expect(b[3].angle - a[3].angle).toBeCloseTo(0.5, 12);
    expect(vogel(0, 1)).toEqual([]);
    expect(() => vogel(-1, 1)).toThrow(RangeError);
  });
});
