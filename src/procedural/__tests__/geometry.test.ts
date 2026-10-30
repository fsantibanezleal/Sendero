import {
  add,
  distance,
  length,
  lerpPoint,
  normalize,
  perpendicular,
  rotate,
  scale,
  sub,
} from '../geometry';

describe('geometry', () => {
  it('basic vector ops', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(sub({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: -2, y: -2 });
    expect(scale({ x: 1, y: 2 }, 3)).toEqual({ x: 3, y: 6 });
    expect(length({ x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
  });

  it('normalize returns (1, 0) for the zero vector', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(normalize({ x: 0, y: 5 })).toEqual({ x: 0, y: 1 });
  });

  it('perpendicular is the left normal and rotate turns by the angle', () => {
    const p = perpendicular({ x: 1, y: 0 });
    expect(p.x + 0).toBe(0);
    expect(p.y).toBe(1);
    const r = rotate({ x: 1, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 12);
    expect(r.y).toBeCloseTo(1, 12);
  });
});
