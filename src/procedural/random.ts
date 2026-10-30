/** Seeded randomness. Generation-time (JS thread) code: none of these are worklets. */

// Hoisted: global `Math` lookups are slow inside Jest's sandbox.
const { imul, floor, sqrt, log, cos, PI } = Math;

/** mulberry32 PRNG: 32-bit state, returns a float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = imul(t ^ (t >>> 15), t | 1);
    t ^= t + imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Float in [a, b). */
export function randRange(rng: () => number, a: number, b: number): number {
  return a + (b - a) * rng();
}

/** Integer in [a, b], both ends inclusive. */
export function randInt(rng: () => number, a: number, b: number): number {
  return a + floor(rng() * (b - a + 1));
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pick: items is empty');
  return items[floor(rng() * items.length)];
}

/** Fisher-Yates; returns a new array and leaves the input untouched. */
export function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Standard normal (mean 0, sd 1) by the Box-Muller transform. */
export function gaussian(rng: () => number): number {
  const u1 = 1 - rng(); // in (0, 1], so the log is finite
  const u2 = rng();
  return sqrt(-2 * log(u1)) * cos(2 * PI * u2);
}

/** FNV-1a 32-bit hash of a string, to derive seeds from names. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = imul(h, 0x01000193);
  }
  return h >>> 0;
}
