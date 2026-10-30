/** Golden angle in radians: pi * (3 - sqrt(5)), about 137.50776 degrees. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type VogelPoint = { x: number; y: number; r: number; angle: number; index: number };

/**
 * Vogel (1979) sunflower model: floret n sits at angle n * golden angle and radius c * sqrt(n),
 * centred at the origin. `rotation` offsets every angle.
 */
export function vogel(count: number, c: number, rotation = 0): VogelPoint[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`vogel: count must be a non-negative integer, got ${count}`);
  }
  const out: VogelPoint[] = [];
  for (let n = 0; n < count; n++) {
    const r = c * Math.sqrt(n);
    const angle = n * GOLDEN_ANGLE + rotation;
    out.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), r, angle, index: n });
  }
  return out;
}
