import { createNoise2D, fbm2 } from '../noise';

describe('noise', () => {
  const n = createNoise2D(42);

  it('is within [-1, 1]', () => {
    for (let i = 0; i < 4000; i++) {
      const v = n(i * 0.137 - 100, i * 0.291 + 7);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous', () => {
    for (let i = 0; i < 2000; i++) {
      const x = i * 0.0731;
      const y = i * 0.0317;
      expect(Math.abs(n(x, y) - n(x + 1e-3, y))).toBeLessThan(0.01);
      expect(Math.abs(n(x, y) - n(x, y + 1e-3))).toBeLessThan(0.01);
    }
  });

  it('is zero at integer lattice points', () => {
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        expect(Math.abs(n(x, y))).toBeLessThan(1e-12);
      }
    }
  });

  it('is deterministic per seed and differs across seeds', () => {
    const a = createNoise2D(7);
    const b = createNoise2D(7);
    const c = createNoise2D(8);
    let differs = false;
    for (let i = 0; i < 50; i++) {
      expect(a(i * 0.31 + 0.5, 0.5)).toBe(b(i * 0.31 + 0.5, 0.5));
      if (a(i * 0.31 + 0.5, 0.5) !== c(i * 0.31 + 0.5, 0.5)) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('is not trivially flat', () => {
    let max = 0;
    for (let i = 0; i < 2000; i++) max = Math.max(max, Math.abs(n(i * 0.0913, i * 0.0577)));
    expect(max).toBeGreaterThan(0.4);
  });

  it('fbm2 stays within [-1, 1] and one octave is the noise itself', () => {
    for (let i = 0; i < 2000; i++) {
      const v = fbm2(n, i * 0.05, i * 0.03, 5);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(fbm2(n, 0.3, 0.4, 1)).toBeCloseTo(n(0.3, 0.4), 12);
  });
});
