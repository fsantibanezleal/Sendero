import {
  clamp,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  invLerp,
  lerp,
  pingPong,
  remap,
  smoothstep,
} from '../easing';

const fns = { easeInCubic, easeOutCubic, easeInOutCubic, easeOutBack, easeInOutSine };

describe('easing', () => {
  for (const [name, f] of Object.entries(fns)) {
    it(`${name} maps 0 to 0, 1 to 1 and clamps`, () => {
      expect(f(0)).toBeCloseTo(0, 12);
      expect(f(1)).toBeCloseTo(1, 12);
      expect(f(-3)).toBeCloseTo(0, 12);
      expect(f(5)).toBeCloseTo(1, 12);
    });
    if (name !== 'easeOutBack') {
      it(`${name} is monotonic on 101 samples`, () => {
        let prev = -Infinity;
        for (let i = 0; i <= 100; i++) {
          const v = f(i / 100);
          expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
          prev = v;
        }
      });
    }
  }

  it('easeOutBack overshoots then settles', () => {
    let max = 0;
    for (let i = 0; i <= 100; i++) max = Math.max(max, easeOutBack(i / 100));
    expect(max).toBeGreaterThan(1.02);
    expect(max).toBeLessThan(1.2);
  });

  it('clamp, lerp, invLerp, remap', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.3, 0, 1)).toBe(0.3);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(invLerp(10, 20, 12.5)).toBe(0.25);
    expect(invLerp(5, 5, 7)).toBe(0);
    expect(remap(5, 0, 10, 100, 200)).toBe(150);
  });

  it('smoothstep', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(2, 2, 1)).toBe(0);
    expect(smoothstep(2, 2, 3)).toBe(1);
  });

  it('pingPong folds into [0, 1]', () => {
    expect(pingPong(0)).toBe(0);
    expect(pingPong(0.5)).toBeCloseTo(0.5, 12);
    expect(pingPong(1)).toBeCloseTo(1, 12);
    expect(pingPong(1.5)).toBeCloseTo(0.5, 12);
    expect(pingPong(2)).toBeCloseTo(0, 12);
    expect(pingPong(-0.25)).toBeCloseTo(0.25, 12);
  });
});
