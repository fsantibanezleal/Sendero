/**
 * Procedural cempasuchil (Tagetes erecta) flower heads (docs/flowers.md, research-visuals D1).
 *
 * A double marigold head is a pompom of ruffled ligulate florets. Florets are placed by Vogel's
 * phyllotaxis model (angle n x golden angle, radius c sqrt(n); Vogel 1979, DOI
 * 10.1016/0025-5564(79)90080-4); each one is a spatula-shaped ligule with a scalloped tip, pointing
 * outward, longer toward the rim, with its angle, length and width ruffled by gradient noise
 * (Perlin 2002, DOI 10.1145/566654.566636). Florets are drawn from the rim inward so inner ones
 * overlap outer ones, and each carries a base-to-tip gradient from a deep core to a light rim.
 *
 * This module is pure data (no Skia): the atlas baker renders it.
 */
import { createNoise2D, GOLDEN_ANGLE, mulberry32, randRange } from '../procedural';

export interface Floret {
  /** Base of the ligule, relative to the head centre, in head radii. */
  x: number;
  y: number;
  /** Direction the ligule points, radians. */
  angle: number;
  /** Length and width in head radii. */
  length: number;
  width: number;
  /** 0 at the centre to 1 at the rim; drives the colour. */
  depth: number;
}

export interface MarigoldColors {
  core: string;
  mid: string;
  rim: string;
}

/** Colour ramps across the yellow-to-deep-orange range of the ligules (palette.ts). */
export const MARIGOLD_COLORS: readonly MarigoldColors[] = [
  { core: '#B84A00', mid: '#E8650A', rim: '#F9A11B' },
  { core: '#C25400', mid: '#F58A07', rim: '#FFC20E' },
  { core: '#A84200', mid: '#E05A00', rim: '#F58A07' },
  { core: '#C96A00', mid: '#FFA600', rim: '#FFD34D' },
];

export interface MarigoldOptions {
  seed: number;
  florets?: number;
}

/**
 * Florets of one head, ordered rim first. Radii are normalized so the outermost ligule tips reach
 * about 1.0.
 */
export function marigoldFlorets({ seed, florets = 150 }: MarigoldOptions): Floret[] {
  const rng = mulberry32(seed);
  const noise = createNoise2D(seed ^ 0x9e3779b9);
  const out: Floret[] = [];
  const c = 0.62 / Math.sqrt(florets);
  for (let n = florets - 1; n >= 0; n--) {
    const r = c * Math.sqrt(n + 0.5);
    const theta = n * GOLDEN_ANGLE;
    const depth = r / (c * Math.sqrt(florets));
    const ruffle = noise(Math.cos(theta) * 2.2 + seed * 0.01, Math.sin(theta) * 2.2);
    const length = (0.22 + 0.2 * depth) * (1 + 0.18 * ruffle) * randRange(rng, 0.9, 1.1);
    const width = (0.11 + 0.09 * depth) * randRange(rng, 0.85, 1.15);
    out.push({
      x: Math.cos(theta) * r,
      y: Math.sin(theta) * r,
      angle: theta + 0.35 * ruffle + randRange(rng, -0.15, 0.15),
      length,
      width,
      depth,
    });
  }
  return out;
}

/**
 * Outline of one ligule in its own frame: base at the origin, pointing along +x, length L, width W.
 * Narrow base, widest at 70 percent of the length, a tip of three shallow lobes. Returned as flat
 * coordinates of a closed polygon (smooth enough at atlas scale).
 */
export function liguleOutline(L: number, W: number, lobes = 3): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const half = W / 2;
  const steps = 10;
  // Upper edge from the base to the widest point and on to the tip.
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = u * 0.82 * L;
    const profile = Math.sin(Math.min(1, u / 0.85) * Math.PI * 0.5);
    xs.push(x);
    ys.push(-(0.22 + 0.78 * profile) * half);
  }
  // Scalloped tip: lobes across the width.
  const tipSteps = lobes * 4;
  for (let i = 0; i <= tipSteps; i++) {
    const v = i / tipSteps;
    const y = -half + v * W;
    const lobe = Math.abs(Math.sin(v * Math.PI * lobes));
    xs.push(0.82 * L + (0.12 + 0.06 * lobe) * L);
    ys.push(y);
  }
  // Lower edge back to the base.
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    const x = u * 0.82 * L;
    const profile = Math.sin(Math.min(1, u / 0.85) * Math.PI * 0.5);
    xs.push(x);
    ys.push((0.22 + 0.78 * profile) * half);
  }
  return { xs, ys };
}
