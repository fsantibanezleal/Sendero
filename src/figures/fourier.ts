/**
 * Periodic curves as Fourier series: f(p) = a0 + sum_k a_k cos(2 pi k p) + b_k sin(2 pi k p),
 * p in cycles. Kept apart from the gait data file so the rig can be tested with synthetic curves.
 */

export interface FourierCurve {
  a0: number;
  a: number[];
  b: number[];
}

export interface GaitCurves {
  pelvisTilt: FourierCurve;
  hipFlexion: FourierCurve;
  kneeFlexion: FourierCurve;
  ankleDorsiflexion: FourierCurve;
}

/** Evaluates a Fourier curve at phase p (any real p; the series is periodic). */
export function evalFourier(c: FourierCurve, p: number): number {
  'worklet';
  let v = c.a0;
  const w = 2 * Math.PI * p;
  const n = Math.min(c.a.length, c.b.length);
  for (let k = 1; k <= n; k++) {
    v += c.a[k - 1] * Math.cos(k * w) + c.b[k - 1] * Math.sin(k * w);
  }
  return v;
}
