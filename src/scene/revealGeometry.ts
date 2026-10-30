/**
 * Where the camera image goes in the frame: cropped to cover it. A pure function, also run as a worklet.
 */

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
