/** 2D vector helpers. Every function is a worklet so it can run per frame on the UI thread. */

/** A point or vector in screen pixels, y down. */
export type Point = { x: number; y: number };

export function add(a: Point, b: Point): Point {
  'worklet';
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  'worklet';
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point, k: number): Point {
  'worklet';
  return { x: a.x * k, y: a.y * k };
}

export function length(a: Point): number {
  'worklet';
  return Math.hypot(a.x, a.y);
}

export function distance(a: Point, b: Point): number {
  'worklet';
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Unit vector in the direction of `a`; the zero vector returns (1, 0). */
export function normalize(a: Point): Point {
  'worklet';
  const len = Math.hypot(a.x, a.y);
  if (len === 0 || !Number.isFinite(len)) return { x: 1, y: 0 };
  return { x: a.x / len, y: a.y / len };
}

/** Left normal (-y, x). */
export function perpendicular(a: Point): Point {
  'worklet';
  return { x: -a.y, y: a.x };
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  'worklet';
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Rotates `p` around the origin by `angle` radians (clockwise on screen, y down). */
export function rotate(p: Point, angle: number): Point {
  'worklet';
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}
