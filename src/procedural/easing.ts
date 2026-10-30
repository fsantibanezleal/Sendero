/** Scalar helpers and easing curves. Every function is a worklet (per frame, UI thread). */

export function clamp(x: number, lo: number, hi: number): number {
  'worklet';
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Fraction of x between a and b (not clamped); 0 when a equals b. */
export function invLerp(a: number, b: number, x: number): number {
  'worklet';
  return a === b ? 0 : (x - a) / (b - a);
}

export function remap(x: number, inA: number, inB: number, outA: number, outB: number): number {
  'worklet';
  const t = inA === inB ? 0 : (x - inA) / (inB - inA);
  return outA + (outB - outA) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  'worklet';
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function easeInCubic(x: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, x));
  return t * t * t;
}

export function easeOutCubic(x: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, x));
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeInOutCubic(x: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, x));
  if (t < 0.5) return 4 * t * t * t;
  const u = -2 * t + 2;
  return 1 - (u * u * u) / 2;
}

/** Ease-out with a slight overshoot (back constant 1.2). */
export function easeOutBack(x: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, x));
  const c1 = 1.2;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export function easeInOutSine(x: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, x));
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Triangle wave with period 2: 0 to 1 to 0. */
export function pingPong(t: number): number {
  'worklet';
  const m = ((t % 2) + 2) % 2;
  return m > 1 ? 2 - m : m;
}
