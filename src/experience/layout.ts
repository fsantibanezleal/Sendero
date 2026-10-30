/**
 * Screen layout of the experience, derived from the canvas size only (any tablet, landscape).
 * All values in canvas pixels, y down.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  screen: Rect;
  /** Thickness of the cempasuchil garland band along the screen border. */
  band: number;
  /** Corner radius of the camera window inside the band. */
  radius: number;
  /** Where the framed camera rests during the walk (lower right corner). */
  mini: Rect;
  /** Uniform scale from the full frame to the mini frame. */
  miniScale: number;
  /** Start of the petal path (far end, upper left). */
  pathStart: { x: number; y: number };
  /** End of the petal path (near end, at the left side of the mini frame). */
  pathEnd: { x: number; y: number };
  /** Height of a walking figure when it reaches the mini frame. */
  arrivalHeight: number;
  /** Height of a figure standing at the far end of the path. */
  farHeight: number;
}

/** Fraction of the screen width the mini frame occupies (plan.md section 3: about 34 percent). */
export const MINI_FRACTION = 0.34;

export function computeLayout(width: number, height: number): Layout {
  const short = Math.min(width, height);
  const band = Math.round(0.11 * short);
  const margin = 0.035 * short;
  const miniScale = MINI_FRACTION;
  const mini: Rect = {
    width: width * miniScale,
    height: height * miniScale,
    x: width - margin - width * miniScale,
    y: height - margin - height * miniScale,
  };
  const pathStart = { x: 0.1 * width, y: 0.16 * height };
  const pathEnd = { x: mini.x + 0.02 * width, y: mini.y + 0.62 * mini.height };
  return {
    screen: { x: 0, y: 0, width, height },
    band,
    radius: 0.06 * short,
    mini,
    miniScale,
    pathStart,
    pathEnd,
    arrivalHeight: 0.92 * mini.height,
    farHeight: 0.92 * mini.height * 0.22,
  };
}

/**
 * The affine transform that maps the full screen onto a rectangle scaled by `s` and anchored at
 * the mini frame's position: s = 1 is the full screen, s = miniScale is the mini frame.
 * Returns translate and scale for a Skia transform: [{ translateX }, { translateY }, { scale }].
 */
export function frameTransform(layout: Layout, k: number): { tx: number; ty: number; s: number } {
  'worklet';
  const s = 1 + (layout.miniScale - 1) * k;
  const tx = layout.mini.x * k;
  const ty = layout.mini.y * k;
  return { tx, ty, s };
}
