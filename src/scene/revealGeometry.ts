/**
 * Geometry of the reveal (docs/reveal.md): where the camera image, the cut-out visitor and the
 * no-mask portrait go on the screen. Pure functions, also run as worklets.
 */

/** The visitor is shown smaller in the reveal (plan.md section 3). */
export const PERSON_SCALE = 0.82;

export interface CoverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The rectangle an image of size iw x ih covers when cropped to fill W x H. */
export function coverRect(iw: number, ih: number, W: number, H: number): CoverRect {
  'worklet';
  if (iw <= 0 || ih <= 0) return { x: 0, y: 0, width: W, height: H };
  const s = Math.max(W / iw, H / ih);
  const width = iw * s;
  const height = ih * s;
  return { x: (W - width) / 2, y: (H - height) / 2, width, height };
}

/** The cover rectangle shrunk about the bottom centre of the screen. */
export function personRect(r: CoverRect, W: number, H: number, k: number): CoverRect {
  'worklet';
  return {
    x: W / 2 + (r.x - W / 2) * k,
    y: H + (r.y - H) * k,
    width: r.width * k,
    height: r.height * k,
  };
}

/**
 * Without a person mask the visitor is a soft-edged portrait left of centre, small enough that the
 * silhouette (centred at 0.565 of the width) stands visibly behind and beside it. Fractions of the
 * screen: left edge, width, height, and the gap to the bottom edge.
 */
export const PORTRAIT = { x: 0.14, width: 0.4, height: 0.58, bottom: 0.04 };

/** The portrait rectangle on a W x H screen. */
export function portraitRect(W: number, H: number): CoverRect {
  'worklet';
  const height = H * PORTRAIT.height;
  return { x: W * PORTRAIT.x, y: H - H * PORTRAIT.bottom - height, width: W * PORTRAIT.width, height };
}

/** The rectangle an image of size iw x ih covers when cropped to fill the rectangle r. */
export function coverInto(iw: number, ih: number, r: CoverRect): CoverRect {
  'worklet';
  const c = coverRect(iw, ih, r.width, r.height);
  return { x: r.x + c.x, y: r.y + c.y, width: c.width, height: c.height };
}
