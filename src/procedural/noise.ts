import { mulberry32, shuffle } from './random';

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// Eight unit gradient directions.
const D = Math.SQRT1_2;
const GRADS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [D, D],
  [-D, D],
  [D, -D],
  [-D, -D],
];

// With unit gradients the 2D maximum is sqrt(2) / 2; this rescales it to 1.
const NORMALIZE = Math.SQRT2;

/**
 * Perlin improved noise in 2D (Perlin 2002) with a permutation table shuffled by the seeded PRNG.
 * Output in [-1, 1]; exactly 0 at integer lattice points.
 */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  const base = shuffle(
    mulberry32(seed),
    Array.from({ length: 256 }, (_, i) => i),
  );
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const grad = (hash: number, x: number, y: number) => {
    const g = GRADS[hash & 7];
    return g[0] * x + g[1] * y;
  };

  return (x: number, y: number): number => {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const xi = fx & 255;
    const yi = fy & 255;
    const xf = x - fx;
    const yf = y - fy;
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
    const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
    const n = (x1 + v * (x2 - x1)) * NORMALIZE;
    return n > 1 ? 1 : n < -1 ? -1 : n;
  };
}

/** Fractal Brownian motion: summed octaves, normalized to [-1, 1]. */
export function fbm2(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  const count = Math.max(1, Math.floor(octaves));
  for (let i = 0; i < count; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
