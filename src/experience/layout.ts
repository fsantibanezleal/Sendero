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
  /** Where the framed camera stands during the farewell: on the right, so the silhouette fits beside it. */
  stage: Rect;
  /** Uniform scale from the full frame to the stage. */
  stageScale: number;
  /** The silhouette beside the stage: the centre of its feet, the ground and its height (a person of height 1). */
  companion: { x: number; ground: number; height: number };
  /** Where the pet sits, beside the silhouette on the side away from the frame. */
  petSpot: { x: number; ground: number };
}

/** Fraction of the screen the frame keeps during the farewell. */
export const STAGE_FRACTION = 0.6;

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
  const stage: Rect = {
    width: width * STAGE_FRACTION,
    height: height * STAGE_FRACTION,
    x: width - margin - width * STAGE_FRACTION,
    y: height * 0.2,
  };
  // Low enough that the family of six waiting around it fits below the top edge.
  const pathStart = { x: 0.11 * width, y: 0.22 * height };
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
    farHeight: 0.92 * mini.height * 0.42,
    stage,
    stageScale: STAGE_FRACTION,
    // Beside the frame on the left, the side the walker came from, standing on the ground a little in front
    // of the frame's bottom edge; tall enough to reach the frame's side with a hand.
    companion: { x: stage.x * 0.64, ground: height * 0.94, height: height * 0.74 },
    petSpot: { x: stage.x * 0.15, ground: height * 0.95 },
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

/** The frame's transform between two placements a and b (k from 0 to 1). */
function between(a: { tx: number; ty: number; s: number }, b: { tx: number; ty: number; s: number }, k: number) {
  'worklet';
  return { tx: a.tx + (b.tx - a.tx) * k, ty: a.ty + (b.ty - a.ty) * k, s: a.s + (b.s - a.s) * k };
}

/**
 * Where the frame is at a moment of the visit: full screen while waiting, shrinking to the mini frame
 * during the walk (`shrink` in [0, 1]), growing from the mini frame to the stage at the arrival
 * (`arrive`), at the stage for the farewell and the message, and back to full screen at the return
 * (`back`). Exactly one of the three progress values is between 0 and 1 at a time.
 */
export function frameAt(layout: Layout, shrink: number, arrive: number, back: number): { tx: number; ty: number; s: number } {
  'worklet';
  const full = { tx: 0, ty: 0, s: 1 };
  const mini = { tx: layout.mini.x, ty: layout.mini.y, s: layout.miniScale };
  const stage = { tx: layout.stage.x, ty: layout.stage.y, s: layout.stageScale };
  if (back > 0) return between(stage, full, back);
  if (arrive > 0) return between(mini, stage, arrive);
  return between(full, mini, shrink);
}

/**
 * Where a drawing of the given aspect stands beside the frame: it never touches the frame nor leaves the screen.
 * `prefer` is the x wanted for its centre; a drawing too wide for the room is scaled down.
 */
export function besideFrame(layout: Layout, prefer: number, height: number, aspect: number): { x: number; height: number } {
  const margin = 0.02 * layout.screen.width;
  const limit = layout.stage.x - margin;
  const room = limit - margin;
  const h = Math.min(height, room / aspect);
  const half = (h * aspect) / 2;
  return { x: Math.max(margin + half, Math.min(prefer, limit - half)), height: h };
}
