import type { Point } from './geometry';

// Hoisted: global `Math` lookups are slow inside Jest's sandbox (about 20x on this hot loop).
const { floor, min, max, ceil, sqrt, cos, sin, SQRT2, PI } = Math;

export type PoissonOptions = {
  width: number;
  height: number;
  /** Smallest radius; must be positive. Sets the background grid cell size (rMin / sqrt 2). */
  rMin: number;
  /** Radius at a position; defaults to rMin and is clamped to at least rMin. */
  radiusAt?: (x: number, y: number) => number;
  /** Candidates per active sample (Bridson uses 30). */
  k?: number;
  rng: () => number;
  maxPoints?: number;
};

/**
 * Bridson (2007) Poisson disk sampling generalized to a position-dependent radius. A candidate
 * drawn in the annulus [r(p), 2 r(p)] around an active sample p is rejected when any accepted
 * point lies closer than r(candidate). Output points lie in [0, width) x [0, height).
 */
export function poissonDisk(options: PoissonOptions): Point[] {
  const { width, height, rMin, rng, maxPoints } = options;
  const k = options.k ?? 30;
  if (!(rMin > 0) || !Number.isFinite(rMin)) {
    throw new RangeError(`poissonDisk: rMin must be a positive number, got ${rMin}`);
  }
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError(`poissonDisk: width and height must be positive, got ${width} x ${height}`);
  }
  const radiusOf = (x: number, y: number): number => {
    if (!options.radiusAt) return rMin;
    const r = options.radiusAt(x, y);
    return r > rMin && Number.isFinite(r) ? r : rMin;
  };

  const cell = rMin / SQRT2;
  const cols = ceil(width / cell);
  const rows = ceil(height / cell);
  // Each cell holds at most one point (index + 1); 0 means empty.
  const grid = new Int32Array(cols * rows);
  const pts: Point[] = [];
  const active: number[] = [];

  const accept = (x: number, y: number) => {
    pts.push({ x, y });
    active.push(pts.length - 1);
    const cx = min(cols - 1, floor(x / cell));
    const cy = min(rows - 1, floor(y / cell));
    grid[cy * cols + cx] = pts.length;
  };

  const fits = (x: number, y: number, r: number): boolean => {
    const cx = min(cols - 1, floor(x / cell));
    const cy = min(rows - 1, floor(y / cell));
    const reach = ceil(r / cell);
    const x0 = max(0, cx - reach);
    const x1 = min(cols - 1, cx + reach);
    const y0 = max(0, cy - reach);
    const y1 = min(rows - 1, cy + reach);
    const r2 = r * r;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const idx = grid[gy * cols + gx];
        if (idx === 0) continue;
        const q = pts[idx - 1];
        const dx = q.x - x;
        const dy = q.y - y;
        if (dx * dx + dy * dy < r2) return false;
      }
    }
    return true;
  };

  const limit = maxPoints ?? Infinity;
  accept(rng() * width, rng() * height);

  while (active.length > 0 && pts.length < limit) {
    const ai = floor(rng() * active.length);
    const p = pts[active[ai]];
    const rp = radiusOf(p.x, p.y);
    let found = false;
    for (let i = 0; i < k; i++) {
      const ang = rng() * 2 * PI;
      // sqrt keeps the candidates uniform in area over the annulus [rp, 2 rp]
      const dist = rp * sqrt(1 + 3 * rng());
      const x = p.x + dist * cos(ang);
      const y = p.y + dist * sin(ang);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (fits(x, y, radiusOf(x, y))) {
        accept(x, y);
        found = true;
        break;
      }
    }
    if (!found) {
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }
  return pts;
}
