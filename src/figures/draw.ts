/**
 * Silhouette geometry: turns rig poses and variants (looks.ts) into ONE Skia path per figure, in
 * screen pixels.
 *
 * Every primitive (tapered capsule, ellipse, polygon) is wound clockwise on screen (positive
 * shoelace area in y-down coordinates, the direction Skia uses for addCircle and addOval), so the
 * default nonzero fill merges overlapping parts into one clean silhouette, never punching holes.
 *
 * Body units: H = 1 is the height of the tallest archetype, ground at y = 0, y up, facing +x. A
 * transform maps them to the screen: X = ox + facing * x * h, Y = oy - y * h. Each person is scaled
 * by their archetype's base height and their variant's height.
 *
 * Worklets are created in file order, so every helper is defined before the functions that use it.
 */
import { Skia, type SkPath, type SkPathBuilder } from '@shopify/react-native-skia';

import { BASE_HEIGHT, type Look, type PetLook } from './looks';
import { BODY, type HumanPose, type Vec } from './rig';

export interface ScreenTransform {
  /** Screen x of the body origin (under the pelvis). */
  ox: number;
  /** Screen y of the ground. */
  oy: number;
  /** Pixels per body height. */
  h: number;
  /** +1 facing right, -1 facing left. */
  facing: number;
}

function sx(t: ScreenTransform, x: number): number {
  'worklet';
  return t.ox + t.facing * x * t.h;
}

function sy(t: ScreenTransform, y: number): number {
  'worklet';
  return t.oy - y * t.h;
}

/** A closed polygon from flat coordinate arrays, wound clockwise on screen. */
export function addPolygon(path: SkPathBuilder, xs: number[], ys: number[]): void {
  'worklet';
  const n = xs.length;
  if (n < 3) {
    return;
  }
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xs[i] * ys[j] - xs[j] * ys[i];
  }
  if (area >= 0) {
    path.moveTo(xs[0], ys[0]);
    for (let i = 1; i < n; i++) path.lineTo(xs[i], ys[i]);
  } else {
    path.moveTo(xs[n - 1], ys[n - 1]);
    for (let i = n - 2; i >= 0; i--) path.lineTo(xs[i], ys[i]);
  }
  path.close();
}

/** A tapered capsule between two screen points with end radii ra and rb (pixels). */
export function addCapsule(path: SkPathBuilder, ax: number, ay: number, ra: number, bx: number, by: number, rb: number): void {
  'worklet';
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (ra > 0) path.addCircle(ax, ay, ra);
  if (rb > 0) path.addCircle(bx, by, rb);
  if (len < 1e-6) {
    return;
  }
  const nx = -dy / len;
  const ny = dx / len;
  addPolygon(
    path,
    [ax + nx * ra, bx + nx * rb, bx - nx * rb, ax - nx * ra],
    [ay + ny * ra, by + ny * rb, by - ny * rb, ay - ny * ra],
  );
}

/** An ellipse rotated by `angle` radians, as a 24-sided polygon. */
export function addEllipse(path: SkPathBuilder, cx: number, cy: number, rx: number, ry: number, angle: number): void {
  'worklet';
  const xs: number[] = [];
  const ys: number[] = [];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    xs.push(cx + ex * c - ey * s);
    ys.push(cy + ex * s + ey * c);
  }
  addPolygon(path, xs, ys);
}

/**
 * A smooth closed curve through the points: a uniform Catmull-Rom spline written as cubic Beziers,
 * wound clockwise on screen like every other primitive.
 */
export function addSmoothClosed(path: SkPathBuilder, xs: number[], ys: number[]): void {
  'worklet';
  const n = xs.length;
  if (n < 3) {
    return;
  }
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xs[i] * ys[j] - xs[j] * ys[i];
  }
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = area >= 0 ? i : n - 1 - i;
    px.push(xs[k]);
    py.push(ys[k]);
  }
  path.moveTo(px[0], py[0]);
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n;
    const i2 = (i + 1) % n;
    const i3 = (i + 2) % n;
    path.cubicTo(
      px[i] + (px[i2] - px[i0]) / 6,
      py[i] + (py[i2] - py[i0]) / 6,
      px[i2] - (px[i3] - px[i]) / 6,
      py[i2] - (py[i3] - py[i]) / 6,
      px[i2],
      py[i2],
    );
  }
  path.close();
}

/** Capsule between two body-unit points with body-unit radii. */
function limb(path: SkPathBuilder, t: ScreenTransform, a: Vec, ra: number, b: Vec, rb: number): void {
  'worklet';
  addCapsule(path, sx(t, a.x), sy(t, a.y), ra * t.h, sx(t, b.x), sy(t, b.y), rb * t.h);
}

/** Polygon from body-unit coordinates. */
function poly(path: SkPathBuilder, t: ScreenTransform, xs: number[], ys: number[]): void {
  'worklet';
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    px.push(sx(t, xs[i]));
    py.push(sy(t, ys[i]));
  }
  addPolygon(path, px, py);
}

/** Smooth closed curve from body-unit coordinates. */
function smooth(path: SkPathBuilder, t: ScreenTransform, xs: number[], ys: number[]): void {
  'worklet';
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    px.push(sx(t, xs[i]));
    py.push(sy(t, ys[i]));
  }
  addSmoothClosed(path, px, py);
}

/**
 * A limb with the shape of a muscle: radius ra at a, rm at the fraction um of the way (the belly of
 * the muscle), rb at b, rounded ends, as one smooth outline (body units).
 */
function muscle(path: SkPathBuilder, t: ScreenTransform, a: Vec, b: Vec, ra: number, rm: number, um: number, rb: number): void {
  'worklet';
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const mx = a.x + dx * um;
  const my = a.y + dy * um;
  smooth(
    path,
    t,
    [a.x + nx * ra, mx + nx * rm, b.x + nx * rb, b.x + ux * rb * 0.95, b.x - nx * rb, mx - nx * rm, a.x - nx * ra, a.x - ux * ra * 0.95],
    [a.y + ny * ra, my + ny * rm, b.y + ny * rb, b.y + uy * rb * 0.95, b.y - ny * rb, my - ny * rm, a.y - ny * ra, a.y - uy * ra * 0.95],
  );
}

function blob(path: SkPathBuilder, t: ScreenTransform, c: Vec, rx: number, ry: number, angle: number): void {
  'worklet';
  addEllipse(path, sx(t, c.x), sy(t, c.y), rx * t.h, ry * t.h, -t.facing * angle);
}

/** Point along the trunk: `along` in trunk lengths from the pelvis, `depth` forward in H. */
function trunkPoint(pose: HumanPose, along: number, depth: number): Vec {
  'worklet';
  const r = (pose.trunkDeg * Math.PI) / 180;
  const ux = Math.sin(r);
  const uy = Math.cos(r);
  return {
    x: pose.pelvis.x + ux * along * BODY.trunk + uy * depth,
    y: pose.pelvis.y + uy * along * BODY.trunk - ux * depth,
  };
}

/** The transform of one person: the archetype's base height times the variant's height. */
function personTransform(t: ScreenTransform, look: Look): ScreenTransform {
  'worklet';
  return { ox: t.ox, oy: t.oy, h: t.h * BASE_HEIGHT[look.human] * look.build.height, facing: t.facing };
}

function legPath(path: SkPathBuilder, t: ScreenTransform, leg: HumanPose['near']['leg'], k: number): void {
  'worklet';
  muscle(path, t, leg.hip, leg.knee, 0.064 * k, 0.06 * k, 0.3, 0.041 * k);
  muscle(path, t, leg.knee, leg.ankle, 0.039 * k, 0.044 * k, 0.3, 0.024 * k);
  // The shoe, in the frame of the foot (heel to toe), from the heel to the toe and back under the sole.
  const fx = leg.toe.x - leg.heel.x;
  const fy = leg.toe.y - leg.heel.y;
  const fl = Math.sqrt(fx * fx + fy * fy) || 1e-6;
  const ux = fx / fl;
  const uy = fy / fl;
  const nx = -uy;
  const ny = ux;
  const s = fl / BODY.foot;
  const us = [-0.014, -0.012, 0.02, 0.07, 0.125, 0.156, 0.15, 0.06, 0.0];
  const vs = [0.006, 0.042, 0.06, 0.044, 0.026, 0.012, -0.002, -0.004, -0.004];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < us.length; i++) {
    xs.push(leg.heel.x + ux * us[i] * s + nx * vs[i]);
    ys.push(leg.heel.y + uy * us[i] * s + ny * vs[i]);
  }
  smooth(path, t, xs, ys);
}

function armPath(path: SkPathBuilder, t: ScreenTransform, arm: HumanPose['near']['arm'], k: number): void {
  'worklet';
  blob(path, t, { x: arm.shoulder.x, y: arm.shoulder.y - 0.01 }, 0.04 * k, 0.042 * k, 0);
  muscle(path, t, arm.shoulder, arm.elbow, 0.037 * k, 0.036 * k, 0.35, 0.026 * k);
  muscle(path, t, arm.elbow, arm.hand, 0.026 * k, 0.029 * k, 0.28, 0.018 * k);
  const dx = arm.hand.x - arm.elbow.x;
  const dy = arm.hand.y - arm.elbow.y;
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  blob(path, t, { x: arm.hand.x + (dx / l) * 0.034, y: arm.hand.y + (dy / l) * 0.034 }, 0.021, 0.036, Math.atan2(dx, -dy));
}

/** True for headwear with a crown over the head (hair on top is hidden). */
function isHat(headwear: Look['headwear']): boolean {
  'worklet';
  return headwear === 'sombrero' || headwear === 'palma' || headwear === 'texana' || headwear === 'fedora' || headwear === 'boina' || headwear === 'gorra';
}

/** Hem height and flare of each skirt (body units); 0 height means no skirt. */
function skirtShape(bottom: Look['bottom']): { hem: number; flare: number } {
  'worklet';
  if (bottom === 'skirt-long') return { hem: 0.1, flare: 0.06 };
  if (bottom === 'skirt-mid') return { hem: 0.2, flare: 0.065 };
  if (bottom === 'skirt-knee') return { hem: 0.3, flare: 0.065 };
  if (bottom === 'skirt-wide') return { hem: 0.06, flare: 0.13 };
  if (bottom === 'skirt-tight') return { hem: 0.32, flare: 0.012 };
  return { hem: 0, flare: 0 };
}

// ---- People in profile -------------------------------------------------------------------------

function hairSide(path: SkPathBuilder, t: ScreenTransform, look: Look, pose: HumanPose): void {
  'worklet';
  const hx = pose.head.x;
  const hy = pose.head.y;
  const hair = look.hair;
  if (hair === 'bald' || look.headwear === 'rebozo' || look.headwear === 'panuelo') return;
  const hat = isHat(look.headwear);
  if (hair === 'curly') {
    blob(path, t, { x: hx - 0.012, y: hy + 0.012 }, 0.085, 0.082, 0);
    return;
  }
  if (hair === 'bob') {
    blob(path, t, { x: hx - 0.018, y: hy - 0.008 }, 0.07, 0.077, 0);
    return;
  }
  blob(path, t, { x: hx - 0.01, y: hy + 0.012 }, 0.064, 0.062, 0);
  const shoulder = pose.shoulder;
  if (hair === 'long') {
    smooth(path, t, [hx + 0.024, hx - 0.06, shoulder.x - 0.075, shoulder.x - 0.035, hx - 0.018], [hy + 0.07, hy + 0.045, shoulder.y - 0.12, shoulder.y - 0.13, hy - 0.035]);
  } else if (hair === 'shoulder') {
    smooth(path, t, [hx + 0.01, hx - 0.065, hx - 0.085, hx - 0.05, hx - 0.01], [hy + 0.068, hy + 0.04, hy - 0.1, hy - 0.115, hy - 0.03]);
  } else if (hair === 'bun') {
    blob(path, t, { x: hx - 0.068, y: hy + (hat ? 0.0 : 0.025) }, 0.034, 0.031, 0);
  } else if (hair === 'ponytail') {
    limb(path, t, { x: hx - 0.06, y: hy + 0.03 }, 0.02, { x: hx - 0.1, y: hy - 0.1 }, 0.011);
  } else if (hair === 'braids') {
    const a = { x: hx - 0.052, y: hy - 0.01 };
    const b = { x: shoulder.x - 0.055, y: shoulder.y - 0.19 };
    limb(path, t, a, 0.017, b, 0.011);
    for (let i = 1; i <= 4; i++) {
      const u = i / 5;
      blob(path, t, { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, 0.016 - 0.002 * u, 0.012, 0);
    }
  } else if (hair === 'pompadour' && !hat) {
    blob(path, t, { x: hx + 0.012, y: hy + 0.062 }, 0.055, 0.03, 0);
  }
}

function headwearSide(path: SkPathBuilder, t: ScreenTransform, look: Look, pose: HumanPose): void {
  'worklet';
  const hx = pose.head.x;
  const hy = pose.head.y;
  const w = look.headwear;
  if (w === 'sombrero') {
    blob(path, t, { x: hx - 0.004, y: hy + 0.058 }, 0.13, 0.022, 0);
    poly(path, t, [hx - 0.055, hx - 0.048, hx + 0.042, hx + 0.05], [hy + 0.062, hy + 0.135, hy + 0.135, hy + 0.062]);
  } else if (w === 'palma') {
    blob(path, t, { x: hx - 0.004, y: hy + 0.056 }, 0.11, 0.02, 0);
    poly(path, t, [hx - 0.045, hx - 0.04, hx + 0.035, hx + 0.04], [hy + 0.06, hy + 0.115, hy + 0.115, hy + 0.06]);
    blob(path, t, { x: hx - 0.003, y: hy + 0.115 }, 0.038, 0.012, 0);
  } else if (w === 'texana') {
    blob(path, t, { x: hx - 0.004, y: hy + 0.055 }, 0.095, 0.016, 0);
    blob(path, t, { x: hx + 0.082, y: hy + 0.066 }, 0.022, 0.01, 0.5);
    blob(path, t, { x: hx - 0.09, y: hy + 0.066 }, 0.022, 0.01, -0.5);
    poly(path, t, [hx - 0.05, hx - 0.045, hx - 0.01, hx + 0.01, hx + 0.045, hx + 0.05], [hy + 0.06, hy + 0.125, hy + 0.11, hy + 0.11, hy + 0.125, hy + 0.06]);
  } else if (w === 'fedora') {
    blob(path, t, { x: hx - 0.004, y: hy + 0.056 }, 0.095, 0.016, 0);
    poly(path, t, [hx - 0.045, hx - 0.04, hx + 0.036, hx + 0.042], [hy + 0.06, hy + 0.118, hy + 0.118, hy + 0.06]);
  } else if (w === 'boina') {
    blob(path, t, { x: hx - 0.004, y: hy + 0.045 }, 0.072, 0.028, 0);
    poly(path, t, [hx + 0.035, hx + 0.09, hx + 0.085, hx + 0.03], [hy + 0.04, hy + 0.034, hy + 0.024, hy + 0.026]);
  } else if (w === 'gorra') {
    blob(path, t, { x: hx - 0.006, y: hy + 0.035 }, 0.067, 0.048, 0);
    poly(path, t, [hx + 0.03, hx + 0.115, hx + 0.11, hx + 0.03], [hy + 0.038, hy + 0.03, hy + 0.019, hy + 0.022]);
  } else if (w === 'panuelo') {
    blob(path, t, { x: hx - 0.004, y: hy + 0.008 }, 0.068, 0.072, 0);
    blob(path, t, { x: hx - 0.068, y: hy - 0.035 }, 0.022, 0.018, 0);
    limb(path, t, { x: hx - 0.07, y: hy - 0.035 }, 0.012, { x: hx - 0.088, y: hy - 0.09 }, 0.008);
  } else if (w === 'flor') {
    blob(path, t, { x: hx + 0.005, y: hy + 0.064 }, 0.026, 0.024, 0);
    blob(path, t, { x: hx + 0.026, y: hy + 0.056 }, 0.016, 0.014, 0);
  } else if (w === 'rebozo') {
    const shoulder = pose.shoulder;
    const waist = trunkPoint(pose, 0.32, 0);
    smooth(
      path,
      t,
      [hx + 0.055, hx + 0.01, hx - 0.062, hx - 0.078, shoulder.x - 0.095, waist.x - 0.1, waist.x - 0.02, shoulder.x + 0.05, shoulder.x + 0.08, hx + 0.036],
      [hy + 0.03, hy + 0.088, hy + 0.05, hy - 0.035, shoulder.y - 0.02, waist.y - 0.02, waist.y + 0.07, shoulder.y - 0.15, shoulder.y - 0.055, hy - 0.058],
    );
  }
}

function topSide(path: SkPathBuilder, t: ScreenTransform, look: Look, pose: HumanPose): void {
  'worklet';
  const g = look.build.girth;
  const belly = look.build.belly;
  const hx = pose.head.x;
  const hy = pose.head.y;
  const shoulder = pose.shoulder;
  const waist = trunkPoint(pose, 0.32, 0);
  const pelvis = pose.pelvis;
  const top = look.top;
  if (top === 'jacket' || top === 'coat') {
    const hem = top === 'jacket' ? 0.06 : 0.22;
    const flare = top === 'jacket' ? 0 : 0.03;
    const backTop = trunkPoint(pose, 0.95, -0.082 * g);
    const backMid = trunkPoint(pose, 0.1, -0.09 * g);
    const frontMid = trunkPoint(pose, 0.25, 0.075 * g + belly);
    const frontTop = trunkPoint(pose, 0.9, 0.07 * g);
    smooth(
      path,
      t,
      [backTop.x, backMid.x, pelvis.x - 0.09 * g - flare, pelvis.x + 0.085 * g + belly + flare, frontMid.x, frontTop.x],
      [backTop.y, backMid.y, pelvis.y - hem, pelvis.y - hem, frontMid.y, frontTop.y],
    );
  } else if (top === 'poncho') {
    smooth(
      path,
      t,
      [hx - 0.03, shoulder.x - 0.11 * g, waist.x - 0.13 * g, waist.x + 0.12 * g + belly, shoulder.x + 0.1 * g, hx + 0.035],
      [hy - 0.08, shoulder.y - 0.02, waist.y - 0.08, waist.y - 0.08, shoulder.y - 0.02, hy - 0.08],
    );
  } else if (top === 'shawl') {
    smooth(
      path,
      t,
      [hx - 0.04, shoulder.x - 0.095 * g, waist.x - 0.1 * g, shoulder.x + 0.04, shoulder.x + 0.075 * g, hx + 0.03],
      [hy - 0.07, shoulder.y, waist.y + 0.1, shoulder.y - 0.17, shoulder.y - 0.03, hy - 0.075],
    );
  } else if (top === 'rebozo') {
    smooth(
      path,
      t,
      [hx - 0.035, shoulder.x - 0.095 * g, waist.x - 0.105 * g, waist.x - 0.02, shoulder.x + 0.05, shoulder.x + 0.08 * g, hx + 0.02],
      [hy - 0.07, shoulder.y - 0.02, waist.y - 0.08, waist.y + 0.07, shoulder.y - 0.15, shoulder.y - 0.055, hy - 0.08],
    );
  } else if (top === 'apron') {
    const kneeFront = Math.max(pose.near.leg.knee.x, pose.far.leg.knee.x);
    smooth(path, t, [waist.x + 0.05 * g, waist.x + 0.085 * g + belly, kneeFront + 0.085, kneeFront + 0.045], [waist.y + 0.02, waist.y + 0.02, 0.3, 0.3]);
  }
}

function bottomSide(path: SkPathBuilder, t: ScreenTransform, look: Look, pose: HumanPose): void {
  'worklet';
  const s = skirtShape(look.bottom);
  if (s.hem <= 0) return;
  const g = look.build.girth;
  const belly = look.build.belly;
  const waist = trunkPoint(pose, 0.32, 0);
  const kneeFront = Math.max(pose.near.leg.knee.x, pose.far.leg.knee.x);
  const kneeBack = Math.min(pose.near.leg.knee.x, pose.far.leg.knee.x);
  const ankleFront = Math.max(pose.near.leg.ankle.x, pose.far.leg.ankle.x);
  const ankleBack = Math.min(pose.near.leg.ankle.x, pose.far.leg.ankle.x);
  const wb = waist.x - 0.08 * g;
  const wf = waist.x + 0.072 * g + belly * 0.5;
  const extra = (g - 1) * 0.04;
  if (s.hem < 0.28) {
    const front = Math.max(kneeFront, ankleFront);
    const back = Math.min(kneeBack, ankleBack);
    smooth(
      path,
      t,
      [wb, wf, kneeFront + 0.065 + extra, front + s.flare + extra, back - s.flare - extra, kneeBack - 0.08 - extra],
      [waist.y, waist.y, 0.3, s.hem, s.hem, 0.3],
    );
  } else {
    smooth(path, t, [wb, wf, kneeFront + s.flare + 0.005 + extra, kneeBack - s.flare - 0.01 - extra], [waist.y, waist.y, s.hem, s.hem]);
  }
}

function carrySide(path: SkPathBuilder, t: ScreenTransform, look: Look, pose: HumanPose): void {
  'worklet';
  const c = look.carry;
  const hand = pose.near.arm.hand;
  const g = look.build.girth;
  if (c === 'cane') {
    limb(path, t, { x: hand.x + 0.01, y: hand.y + 0.01 }, 0.011, { x: hand.x + 0.075, y: 0.0 }, 0.009);
    limb(path, t, { x: hand.x - 0.02, y: hand.y + 0.028 }, 0.009, { x: hand.x + 0.018, y: hand.y + 0.03 }, 0.009);
  } else if (c === 'flowers') {
    const top = { x: hand.x + 0.045, y: hand.y + 0.075 };
    limb(path, t, hand, 0.007, top, 0.006);
    const dx = [0, 0.03, -0.022, 0.012, 0.038, -0.006];
    const dy = [0, 0.012, 0.016, 0.036, 0.04, 0.05];
    for (let i = 0; i < dx.length; i++) blob(path, t, { x: top.x + dx[i], y: top.y + dy[i] }, 0.021, 0.019, 0);
  } else if (c === 'guitar') {
    const r = (pose.trunkDeg * Math.PI) / 180;
    const lower = trunkPoint(pose, 0.18, -0.12 * g);
    const upper = trunkPoint(pose, 0.47, -0.115 * g);
    blob(path, t, lower, 0.07, 0.085, r);
    blob(path, t, upper, 0.055, 0.06, r);
    const neckA = trunkPoint(pose, 0.55, -0.11 * g);
    const neckB = trunkPoint(pose, 1.32, -0.075 * g);
    limb(path, t, neckA, 0.013, neckB, 0.012);
    blob(path, t, trunkPoint(pose, 1.38, -0.073 * g), 0.02, 0.03, r);
  } else if (c === 'bag') {
    const pelvis = pose.pelvis;
    limb(path, t, { x: pose.shoulder.x + 0.02, y: pose.shoulder.y }, 0.006, { x: pelvis.x - 0.08 * g, y: pelvis.y + 0.05 }, 0.006);
    blob(path, t, { x: pelvis.x - 0.085 * g, y: pelvis.y + 0.02 }, 0.05, 0.045, 0);
  } else if (c === 'basket') {
    poly(path, t, [hand.x - 0.05, hand.x + 0.065, hand.x + 0.05, hand.x - 0.035], [hand.y - 0.03, hand.y - 0.03, hand.y - 0.095, hand.y - 0.095]);
    limb(path, t, { x: hand.x - 0.04, y: hand.y - 0.03 }, 0.006, { x: hand.x + 0.005, y: hand.y + 0.025 }, 0.006);
    limb(path, t, { x: hand.x + 0.005, y: hand.y + 0.025 }, 0.006, { x: hand.x + 0.055, y: hand.y - 0.03 }, 0.006);
  } else if (c === 'candle') {
    poly(path, t, [hand.x + 0.012, hand.x + 0.058, hand.x + 0.058, hand.x + 0.012], [hand.y - 0.01, hand.y - 0.01, hand.y + 0.06, hand.y + 0.06]);
    blob(path, t, { x: hand.x + 0.035, y: hand.y + 0.088 }, 0.011, 0.022, 0);
  }
}

/** The far-side limbs of a person in profile (drawn dimmer, behind the body). */
export function humanFarPath(look: Look, pose: HumanPose, t: ScreenTransform): SkPath {
  'worklet';
  const tt = personTransform(t, look);
  const path = Skia.PathBuilder.Make();
  legPath(path, tt, pose.far.leg, look.build.limbs);
  armPath(path, tt, pose.far.arm, look.build.limbs);
  return path.build();
}

/** The body, head, near limbs, hair, headwear, clothes and what the person carries, in profile. */
export function humanMainPath(look: Look, pose: HumanPose, t: ScreenTransform): SkPath {
  'worklet';
  const tt = personTransform(t, look);
  const path = Skia.PathBuilder.Make();
  const g = look.build.girth;
  const belly = look.build.belly;
  const k = look.build.limbs;

  const female = look.human === 'abuela' || look.human === 'mujer';
  const bust = female ? 0.014 + 0.012 * (g - 1) : 0;
  const chest = female ? 0.0 : 0.008;

  // Torso: down the back (neck, trapezius, shoulder blade, lumbar curve, buttock), then up the front
  // (thigh, belly, chest or bust, collarbone), in trunk coordinates (along, depth).
  const along = [1.04, 0.93, 0.74, 0.5, 0.27, 0.06, -0.14, -0.16, 0.04, 0.24, 0.48, 0.66, 0.85, 1.0];
  const depth = [
    -0.03, -0.064 * g, -0.08 * g, -0.068 * g, -0.06 * g, -0.088 * g, -0.072 * g,
    0.05 * g, 0.064 * g + belly * 0.6, 0.062 * g + belly, 0.068 * g + bust * 0.5 + chest + belly * 0.3, 0.078 * g + bust + chest, 0.066 * g, 0.034,
  ];
  const tx: number[] = [];
  const ty: number[] = [];
  for (let i = 0; i < along.length; i++) {
    const p = trunkPoint(pose, along[i], depth[i]);
    tx.push(p.x);
    ty.push(p.y);
  }
  smooth(path, tt, tx, ty);
  blob(path, tt, { x: pose.pelvis.x - 0.01, y: pose.pelvis.y + 0.01 }, 0.07 * g, 0.072, 0);

  // Neck, from the torso to the jaw and the nape.
  const hx = pose.head.x;
  const hy = pose.head.y;
  const nb = trunkPoint(pose, 1.0, -0.028);
  const nf = trunkPoint(pose, 0.98, 0.036);
  poly(path, tt, [nb.x, hx - 0.032, hx + 0.012, nf.x], [nb.y, hy - 0.036, hy - 0.052, nf.y]);

  // The head in profile: crown, forehead, brow, nose, lips, chin, jaw, nape, back of the skull.
  const fxs = [-0.004, 0.038, 0.055, 0.058, 0.056, 0.071, 0.057, 0.059, 0.055, 0.04, 0.014, -0.012, -0.034, -0.056, -0.062, -0.043];
  const fys = [0.068, 0.056, 0.027, 0.009, -0.002, -0.019, -0.027, -0.037, -0.052, -0.064, -0.058, -0.04, -0.036, -0.012, 0.02, 0.054];
  const hxs: number[] = [];
  const hys: number[] = [];
  for (let i = 0; i < fxs.length; i++) {
    hxs.push(hx + fxs[i]);
    hys.push(hy + fys[i]);
  }
  smooth(path, tt, hxs, hys);

  legPath(path, tt, pose.near.leg, k);
  armPath(path, tt, pose.near.arm, k);
  bottomSide(path, tt, look, pose);
  topSide(path, tt, look, pose);
  hairSide(path, tt, look, pose);
  headwearSide(path, tt, look, pose);
  carrySide(path, tt, look, pose);
  return path.build();
}

// ---- People from the front (the reveal) --------------------------------------------------------

/**
 * Elbow of a two-segment arm from the shoulder s to the hand h (body units), bending downward; the hand
 * is pulled toward the shoulder when it is out of reach. Returns the elbow and the reachable hand.
 */
function armTo(s: Vec, h: Vec, upper: number, lower: number): { elbow: Vec; hand: Vec } {
  'worklet';
  let dx = h.x - s.x;
  let dy = h.y - s.y;
  let d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  const reach = upper + lower - 0.005;
  if (d > reach) {
    dx = (dx / d) * reach;
    dy = (dy / d) * reach;
    d = reach;
  }
  const a = Math.atan2(dy, dx);
  const c = Math.min(1, Math.max(-1, (upper * upper + d * d - lower * lower) / (2 * upper * d)));
  const bend = Math.acos(c) * (dx >= 0 ? -1 : 1);
  return {
    elbow: { x: s.x + upper * Math.cos(a + bend), y: s.y + upper * Math.sin(a + bend) },
    hand: { x: s.x + dx, y: s.y + dy },
  };
}

/**
 * A person standing and facing the viewer, for the farewell beside the frame. `breath` in [0, 1]
 * widens the chest slightly. `rest`, a point on screen, is where the hand on the +x side of the
 * picture rests (on the frame's edge); what the person carries then moves to the other hand.
 * Proportions from the same anthropometric fractions as the rig.
 */
export function humanFrontPath(look: Look, t: ScreenTransform, breath: number, rest?: { x: number; y: number }): SkPath {
  'worklet';
  const tt = personTransform(t, look);
  const path = Skia.PathBuilder.Make();
  const g = look.build.girth;
  const belly = look.build.belly;
  const k = look.build.limbs;
  const stoop = Math.min(0.035, look.build.stoop * 0.0025);
  const sw = (BODY.shoulderWidth / 2) * look.build.shoulders * (0.94 + 0.06 * g) * (1 + 0.012 * breath);
  const hw = (BODY.hipWidth / 2) * Math.pow(g, 0.8);
  const top = 0.818 - stoop;
  const headY = 0.935 - stoop * 1.4;

  const female = look.human === 'abuela' || look.human === 'mujer';
  const bust = female ? 0.012 + 0.012 * (g - 1) : 0;
  const waistX = (female ? hw * 0.8 : hw * 0.92) + belly * 1.3;
  const hipX = (female ? hw * 1.12 : hw * 1.0) + belly * 0.6;
  const chestX = sw * 0.9 + bust * 0.5 + belly * 0.4;

  // Torso, right half from the neck down to the crotch, mirrored for the left.
  const rx = [0.036 * k, 0.078, sw - 0.012, sw + 0.014, sw - 0.012, chestX, waistX, hipX, hipX * 0.96, 0.014];
  const ry = [top + 0.058, top + 0.03, top + 0.006, top - 0.03, top - 0.1, top - 0.16, 0.68, 0.58, 0.51, 0.47];
  const txs: number[] = [];
  const tys: number[] = [];
  for (let i = 0; i < rx.length; i++) {
    txs.push(rx[i]);
    tys.push(ry[i]);
  }
  for (let i = rx.length - 1; i >= 0; i--) {
    txs.push(-rx[i]);
    tys.push(ry[i]);
  }
  smooth(path, tt, txs, tys);
  limb(path, tt, { x: 0, y: top + 0.02 }, 0.034 * k, { x: 0, y: headY - 0.05 }, 0.031 * k);

  // Head: an oval narrowing to the jaw and chin, with ears.
  const hxs = [0, 0.04, 0.054, 0.055, 0.046, 0.03, 0, -0.03, -0.046, -0.055, -0.054, -0.04];
  const hys = [0.068, 0.056, 0.026, -0.012, -0.042, -0.06, -0.068, -0.06, -0.042, -0.012, 0.026, 0.056];
  const headXs: number[] = [];
  const headYs: number[] = [];
  for (let i = 0; i < hxs.length; i++) {
    headXs.push(hxs[i]);
    headYs.push(headY + hys[i]);
  }
  smooth(path, tt, headXs, headYs);
  blob(path, tt, { x: 0.057, y: headY - 0.004 }, 0.011, 0.02, 0);
  blob(path, tt, { x: -0.057, y: headY - 0.004 }, 0.011, 0.02, 0);

  const handY = top - BODY.upperArm - BODY.forearm;
  for (const side of [-1, 1]) {
    const sh = { x: side * (sw + 0.004), y: top - 0.028 };
    let el = { x: side * (sw + 0.03 + belly * 0.3), y: top - BODY.upperArm };
    let ha = { x: side * (sw + 0.018 + belly * 0.3), y: handY };
    let resting = false;
    if (side === 1 && rest != null) {
      // The resting hand, from screen pixels to this person's body units.
      const target = { x: (rest.x - tt.ox) / (tt.facing * tt.h), y: (tt.oy - rest.y) / tt.h };
      const arm = armTo(sh, target, BODY.upperArm, BODY.forearm + 0.03);
      el = arm.elbow;
      ha = arm.hand;
      resting = true;
    }
    muscle(path, tt, sh, el, 0.037 * k, 0.036 * k, 0.3, 0.027 * k);
    muscle(path, tt, el, ha, 0.027 * k, 0.03 * k, 0.28, 0.019 * k);
    if (resting) {
      const hx2 = ha.x - el.x;
      const hy2 = ha.y - el.y;
      blob(path, tt, ha, 0.036, 0.022, Math.atan2(hy2, hx2));
    } else {
      blob(path, tt, { x: ha.x + side * 0.002, y: ha.y - 0.034 }, 0.022, 0.036, 0);
    }
    const hip = { x: side * hipX * 0.52, y: 0.52 };
    const knee = { x: side * hw * 0.48, y: 0.285 };
    const ankle = { x: side * hw * 0.46, y: 0.05 };
    muscle(path, tt, hip, knee, 0.07 * k, 0.062 * k, 0.25, 0.042 * k);
    muscle(path, tt, knee, ankle, 0.04 * k, 0.046 * k, 0.3, 0.025 * k);
    smooth(
      path,
      tt,
      [ankle.x - side * 0.02, ankle.x + side * 0.024, ankle.x + side * 0.05, ankle.x + side * 0.046, ankle.x - side * 0.022],
      [0.052, 0.05, 0.02, 0.0, 0.0],
    );
  }

  // Bottom.
  const s = skirtShape(look.bottom);
  if (s.hem > 0) {
    const w1 = hipX + s.flare + (s.hem < 0.28 ? 0.02 : 0);
    smooth(
      path,
      tt,
      [-waistX - 0.006, waistX + 0.006, hipX + 0.012, w1, w1 * 0.5, 0, -w1 * 0.5, -w1, -hipX - 0.012],
      [0.69, 0.69, 0.57, s.hem, s.hem - 0.008, s.hem - 0.01, s.hem - 0.008, s.hem, 0.57],
    );
  }

  // Top: clothes follow the body, from the collar over the shoulders and down to the hem.
  const tp = look.top;
  /** A garment over the torso, right half mirrored, from the collar to a hem at height `hem` with flare. */
  const garment = (hem: number, flare: number, sleeves: boolean) => {
    const rxs = [0.045, sw * 0.62, sw + 0.02, sw + 0.03, sw + 0.004, chestX + 0.014, waistX + 0.022, Math.max(hipX, waistX) + 0.03 + flare, (hipX + flare) * 0.55, 0];
    const rys = [top + 0.05, top + 0.034, top + 0.008, top - 0.03, top - 0.1, top - 0.16, 0.68, hem, hem - 0.006, hem - 0.008];
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < rxs.length - 1; i++) {
      xs.push(rxs[i]);
      ys.push(rys[i]);
    }
    xs.push(0);
    ys.push(rys[rys.length - 1]);
    for (let i = rxs.length - 2; i >= 0; i--) {
      xs.push(-rxs[i]);
      ys.push(rys[i]);
    }
    smooth(path, tt, xs, ys);
    if (sleeves) {
      for (const side of [-1, 1]) {
        const sh = { x: side * (sw + 0.006), y: top - 0.028 };
        const el = { x: side * (sw + 0.032 + belly * 0.3), y: top - BODY.upperArm };
        const wr = { x: side * (sw + 0.02 + belly * 0.3), y: top - BODY.upperArm - BODY.forearm + 0.02 };
        muscle(path, tt, sh, el, 0.044 * k, 0.042 * k, 0.3, 0.033 * k);
        muscle(path, tt, el, wr, 0.033 * k, 0.033 * k, 0.4, 0.027 * k);
      }
    }
  };
  if (tp === 'jacket') {
    garment(0.46, 0.005, true);
  } else if (tp === 'coat') {
    garment(0.3, 0.06, true);
  } else if (tp === 'poncho') {
    // Draped from the neck over the shoulders, square at the sides, with a fringe along the hem.
    const pw = sw + 0.1;
    smooth(
      path,
      tt,
      [0.04, sw * 0.6, sw + 0.03, pw, pw + 0.004, pw * 0.6, 0, -pw * 0.6, -pw - 0.004, -pw, -sw - 0.03, -sw * 0.6, -0.04],
      [headY - 0.056, top + 0.03, top - 0.015, top - 0.12, 0.49, 0.475, 0.47, 0.475, 0.49, top - 0.12, top - 0.015, top + 0.03, headY - 0.056],
    );
    for (let x = -pw + 0.01; x <= pw - 0.005; x += 0.024) {
      poly(path, tt, [x - 0.005, x + 0.005, x + 0.004, x - 0.004], [0.48, 0.48, 0.448, 0.448]);
    }
  } else if (tp === 'shawl' || tp === 'rebozo') {
    // Over the shoulders and crossed in front; a rebozo hangs lower and one end falls to the side.
    const low = tp === 'rebozo' ? 0.58 : 0.64;
    smooth(
      path,
      tt,
      [0.05, sw * 0.7, sw + 0.035, sw + 0.06, sw + 0.04, 0, -sw - 0.04, -sw - 0.06, -sw - 0.035, -sw * 0.7, -0.05],
      [top + 0.045, top + 0.03, top - 0.0, top - 0.08, top - 0.2, low, top - 0.2, top - 0.08, top - 0.0, top + 0.03, top + 0.045],
    );
    if (tp === 'rebozo') muscle(path, tt, { x: sw + 0.045, y: top - 0.18 }, { x: sw + 0.055, y: 0.42 }, 0.03, 0.028, 0.5, 0.022);
  } else if (tp === 'apron') {
    smooth(path, tt, [-hw * 0.85, hw * 0.85, hw * 0.92, -hw * 0.92], [0.64, 0.64, 0.27, 0.27]);
  }

  // Hair.
  const hair = look.hair;
  const w = look.headwear;
  const hat = isHat(w);
  if (hair !== 'bald' && w !== 'rebozo' && w !== 'panuelo') {
    if (hair === 'curly') {
      blob(path, tt, { x: 0, y: headY + 0.01 }, 0.09, 0.085, 0);
    } else if (hair === 'bob') {
      blob(path, tt, { x: 0, y: headY - 0.005 }, 0.075, 0.077, 0);
    } else {
      blob(path, tt, { x: 0, y: headY + 0.012 }, 0.062, 0.062, 0);
      if (hair === 'long') {
        limb(path, tt, { x: -0.05, y: headY + 0.02 }, 0.04, { x: -sw * 0.7, y: top - 0.1 }, 0.03);
        limb(path, tt, { x: 0.05, y: headY + 0.02 }, 0.04, { x: sw * 0.7, y: top - 0.1 }, 0.03);
      } else if (hair === 'shoulder') {
        poly(path, tt, [-0.068, 0.068, 0.085, -0.085], [headY + 0.04, headY + 0.04, top + 0.005, top + 0.005]);
      } else if (hair === 'bun' && !hat) {
        blob(path, tt, { x: 0, y: headY + 0.075 }, 0.032, 0.03, 0);
      } else if (hair === 'ponytail') {
        limb(path, tt, { x: 0.04, y: headY + 0.03 }, 0.016, { x: 0.078, y: headY - 0.06 }, 0.01);
      } else if (hair === 'braids') {
        for (const side of [-1, 1]) {
          const a = { x: side * 0.05, y: headY - 0.02 };
          const b = { x: side * sw * 0.5, y: top - 0.2 };
          limb(path, tt, a, 0.02, b, 0.013);
          for (let i = 1; i <= 3; i++) {
            const u = i / 4;
            blob(path, tt, { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, 0.018, 0.013, 0);
          }
        }
      } else if (hair === 'pompadour' && !hat) {
        blob(path, tt, { x: 0, y: headY + 0.066 }, 0.05, 0.03, 0);
      }
    }
  }

  // Headwear.
  if (w === 'sombrero') {
    blob(path, tt, { x: 0, y: headY + 0.058 }, 0.15, 0.024, 0);
    poly(path, tt, [-0.05, 0.05, 0.044, -0.044], [headY + 0.06, headY + 0.06, headY + 0.135, headY + 0.135]);
  } else if (w === 'palma') {
    blob(path, tt, { x: 0, y: headY + 0.056 }, 0.125, 0.022, 0);
    poly(path, tt, [-0.045, 0.045, 0.04, -0.04], [headY + 0.06, headY + 0.06, headY + 0.115, headY + 0.115]);
    blob(path, tt, { x: 0, y: headY + 0.115 }, 0.04, 0.012, 0);
  } else if (w === 'texana') {
    blob(path, tt, { x: 0, y: headY + 0.055 }, 0.11, 0.02, 0);
    blob(path, tt, { x: 0.1, y: headY + 0.068 }, 0.025, 0.012, 0.4);
    blob(path, tt, { x: -0.1, y: headY + 0.068 }, 0.025, 0.012, -0.4);
    poly(path, tt, [-0.048, 0.048, 0.045, 0.02, -0.02, -0.045], [headY + 0.06, headY + 0.06, headY + 0.125, headY + 0.11, headY + 0.11, headY + 0.125]);
  } else if (w === 'fedora') {
    blob(path, tt, { x: 0, y: headY + 0.056 }, 0.11, 0.018, 0);
    poly(path, tt, [-0.045, 0.045, 0.04, -0.04], [headY + 0.06, headY + 0.06, headY + 0.12, headY + 0.12]);
  } else if (w === 'boina') {
    blob(path, tt, { x: 0, y: headY + 0.05 }, 0.074, 0.03, 0);
    blob(path, tt, { x: 0, y: headY + 0.03 }, 0.055, 0.012, 0);
  } else if (w === 'gorra') {
    blob(path, tt, { x: 0, y: headY + 0.04 }, 0.066, 0.045, 0);
    blob(path, tt, { x: 0, y: headY + 0.025 }, 0.062, 0.014, 0);
  } else if (w === 'panuelo') {
    blob(path, tt, { x: 0, y: headY + 0.008 }, 0.068, 0.074, 0);
    blob(path, tt, { x: 0, y: headY - 0.078 }, 0.02, 0.015, 0);
  } else if (w === 'flor') {
    blob(path, tt, { x: 0.05, y: headY + 0.05 }, 0.026, 0.024, 0);
    blob(path, tt, { x: 0.07, y: headY + 0.035 }, 0.016, 0.014, 0);
  } else if (w === 'rebozo') {
    poly(
      path,
      tt,
      [0, 0.07, 0.085, sw + 0.06, sw + 0.03, 0, -sw - 0.03, -sw - 0.06, -0.085, -0.07],
      [headY + 0.085, headY + 0.05, headY - 0.04, top - 0.07, 0.6, 0.66, 0.6, top - 0.07, headY - 0.04, headY + 0.05],
    );
  }

  // What they carry (in the right hand of the picture, the left for the basket), mirrored to the other
  // hand while the right one rests on the frame.
  const c = look.carry;
  const carryT: ScreenTransform = rest != null ? { ox: tt.ox, oy: tt.oy, h: tt.h, facing: -tt.facing } : tt;
  const hx = sw + 0.012;
  if (c === 'cane') {
    limb(path, carryT, { x: hx + 0.018, y: handY + 0.02 }, 0.011, { x: hx + 0.058, y: 0 }, 0.009);
  } else if (c === 'flowers') {
    const cx = hx + 0.03;
    const cy = handY + 0.08;
    limb(path, carryT, { x: hx, y: handY - 0.02 }, 0.007, { x: cx, y: cy }, 0.006);
    const dx = [0, 0.03, -0.026, 0.012, 0.04, -0.012];
    const dy = [0, 0.014, 0.012, 0.036, 0.04, 0.045];
    for (let i = 0; i < dx.length; i++) blob(path, carryT, { x: cx + dx[i], y: cy + dy[i] }, 0.022, 0.02, 0);
  } else if (c === 'guitar') {
    limb(path, carryT, { x: -sw * 0.2, y: 0.62 }, 0.014, { x: -sw - 0.09, y: headY + 0.08 }, 0.013);
    blob(path, carryT, { x: -sw - 0.1, y: headY + 0.1 }, 0.022, 0.032, -0.6);
    blob(path, carryT, { x: hw + 0.02, y: 0.6 }, 0.07, 0.085, 0.5);
  } else if (c === 'bag') {
    limb(path, carryT, { x: -sw * 0.8, y: top - 0.01 }, 0.007, { x: hw + 0.04, y: 0.55 }, 0.007);
    blob(path, carryT, { x: hw + 0.06, y: 0.52 }, 0.05, 0.045, 0);
  } else if (c === 'basket') {
    const bx = -hx;
    poly(path, carryT, [bx - 0.06, bx + 0.06, bx + 0.045, bx - 0.045], [handY - 0.02, handY - 0.02, handY - 0.09, handY - 0.09]);
    limb(path, carryT, { x: bx - 0.05, y: handY - 0.02 }, 0.006, { x: bx, y: handY + 0.035 }, 0.006);
    limb(path, carryT, { x: bx, y: handY + 0.035 }, 0.006, { x: bx + 0.05, y: handY - 0.02 }, 0.006);
  } else if (c === 'candle') {
    poly(path, carryT, [hx - 0.02, hx + 0.025, hx + 0.025, hx - 0.02], [handY + 0.0, handY + 0.0, handY + 0.07, handY + 0.07]);
    blob(path, carryT, { x: hx + 0.002, y: handY + 0.098 }, 0.012, 0.024, 0);
  }
  return path.build();
}

// ---- Pets ----------------------------------------------------------------------------------------
//
// Units are a person's height, as for people; a dog of size 1 stands about 0.27 high at the
// withers (a medium dog beside a 1.7 m person), a cat of size 1 about 0.15. Proportions of a dog:
// body length about 1.1 times the height at the withers, chest depth about half of it, legs about
// half, head about 0.4 of it (skull and muzzle); a cat is longer and lower, with a round head,
// small triangular ears and a long tail.

/** Leg phases of the lateral-sequence walk: left hind, left fore, right hind, right fore. */
const PET_PHASES = [0, 0.25, 0.5, 0.75];

interface PetLeg {
  root: Vec;
  joint: Vec;
  paw: Vec;
}

function petLeg(root: Vec, upper: number, lower: number, swingDeg: number, q: number, rear: boolean): PetLeg {
  'worklet';
  const w = 2 * Math.PI * q;
  const swing = swingDeg * Math.sin(w);
  const lift = Math.max(0, Math.cos(w));
  const upperDeg = rear ? swing - 14 : swing + 4;
  const lowerDeg = rear ? swing + 22 - 28 * lift : swing - 30 * lift;
  const ur = (upperDeg * Math.PI) / 180;
  const lr = (lowerDeg * Math.PI) / 180;
  const joint = { x: root.x + Math.sin(ur) * upper, y: root.y - Math.cos(ur) * upper };
  const paw = { x: joint.x + Math.sin(lr) * lower, y: joint.y - Math.cos(lr) * lower };
  return { root, joint, paw };
}

function petTransform(t: ScreenTransform, look: PetLook, lift: number): ScreenTransform {
  'worklet';
  return { ox: t.ox, oy: t.oy - lift * look.size * t.h, h: t.h * look.size, facing: t.facing };
}

/** Smooth closed outline of points given relative to an origin. */
function shapeAt(path: SkPathBuilder, t: ScreenTransform, o: Vec, xs: number[], ys: number[]): void {
  'worklet';
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    px.push(o.x + xs[i]);
    py.push(o.y + ys[i]);
  }
  smooth(path, t, px, py);
}

/** A tapering curve through points (a tail): muscle segments from radius r0 down to r1. */
function strand(path: SkPathBuilder, t: ScreenTransform, xs: number[], ys: number[], r0: number, r1: number): void {
  'worklet';
  const n = xs.length;
  for (let i = 0; i + 1 < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / (n - 1);
    const rb = r0 + ((r1 - r0) * (i + 1)) / (n - 1);
    muscle(path, t, { x: xs[i], y: ys[i] }, { x: xs[i + 1], y: ys[i + 1] }, ra, (ra + rb) / 2, 0.5, rb);
  }
}

/** A dog's or a cat's head at hc, facing +x: skull, muzzle or snout, ears (pet units). */
function petHead(main: SkPathBuilder, far: SkPathBuilder | null, t: ScreenTransform, look: PetLook, hc: Vec): void {
  'worklet';
  if (look.kind === 'gato') {
    blob(main, t, hc, 0.05, 0.044, 0);
    blob(main, t, { x: hc.x + 0.04 * look.snout, y: hc.y - 0.014 }, 0.02, 0.017, 0);
    const s = look.ears === 'small' ? 0.75 : 1;
    shapeAt(main, t, hc, [-0.034, -0.026 * s - 0.008, -0.004], [0.026, 0.026 + 0.05 * s, 0.038]);
    shapeAt(main, t, hc, [0.006, 0.024, 0.032], [0.036, 0.036 + 0.044 * s, 0.022]);
    return;
  }
  // Skull and stop, then the muzzle to the nose and back under the jaw.
  blob(main, t, hc, 0.034, 0.03, 0);
  const m = look.snout;
  shapeAt(main, t, hc, [0.014, 0.034, 0.034 + 0.04 * m, 0.04 + 0.05 * m, 0.034 + 0.05 * m, 0.012], [0.024, 0.014, 0.005, -0.008, -0.024, -0.03]);
  if (look.ears === 'up') {
    shapeAt(main, t, hc, [-0.024, -0.022, 0.004], [0.016, 0.068, 0.024]);
    if (far != null) shapeAt(far, t, hc, [-0.036, -0.036, -0.01], [0.014, 0.062, 0.022]);
  } else if (look.ears === 'bat') {
    shapeAt(main, t, hc, [-0.03, -0.044, 0.008], [0.01, 0.07, 0.022]);
    if (far != null) shapeAt(far, t, hc, [-0.042, -0.058, -0.006], [0.008, 0.062, 0.02]);
  } else if (look.ears === 'flop') {
    shapeAt(main, t, hc, [-0.02, -0.002, -0.006, -0.02, -0.034], [0.024, 0.016, -0.03, -0.04, -0.012]);
  } else {
    shapeAt(main, t, hc, [-0.018, -0.022, 0.0], [0.02, 0.046, 0.024]);
  }
}

/** The tail from its base b, by type; `wag` moves the tip (pet units). */
function petTail(path: SkPathBuilder, t: ScreenTransform, look: PetLook, b: Vec, wag: number): void {
  'worklet';
  const thick = look.fluffy || look.tail === 'plume' ? 1.9 : 1;
  if (look.kind === 'gato') {
    if (look.tail === 'straight') {
      strand(path, t, [b.x, b.x - 0.07, b.x - 0.14, b.x - 0.19], [b.y, b.y + 0.02, b.y + 0.03 + wag, b.y + 0.05 + wag], 0.016 * thick, 0.011 * thick);
    } else if (look.tail === 'low') {
      strand(path, t, [b.x, b.x - 0.05, b.x - 0.08, b.x - 0.1], [b.y, b.y - 0.05, b.y - 0.09 + wag, b.y - 0.06 + wag], 0.016 * thick, 0.012 * thick);
    } else {
      strand(path, t, [b.x, b.x - 0.06, b.x - 0.085, b.x - 0.07, b.x - (look.tail === 'curl' ? 0.03 : 0.05)], [b.y, b.y + 0.04, b.y + 0.11 + wag, b.y + 0.17 + wag, b.y + 0.19 + wag], 0.016 * thick, 0.011 * thick);
    }
    return;
  }
  if (look.tail === 'curl' || look.tail === 'plume') {
    strand(path, t, [b.x, b.x - 0.03, b.x - 0.025, b.x + 0.01, b.x + 0.035], [b.y, b.y + 0.045, b.y + 0.08 + wag * 0.4, b.y + 0.09 + wag * 0.4, b.y + 0.065], 0.014 * thick, 0.009 * thick);
  } else if (look.tail === 'straight') {
    strand(path, t, [b.x, b.x - 0.05, b.x - 0.1], [b.y, b.y + 0.022 + wag * 0.5, b.y + 0.05 + wag], 0.013 * thick, 0.007 * thick);
  } else if (look.tail === 'stub') {
    strand(path, t, [b.x, b.x - 0.025], [b.y, b.y + 0.02], 0.014, 0.012);
  } else {
    strand(path, t, [b.x, b.x - 0.04, b.x - 0.062, b.x - 0.07], [b.y, b.y - 0.03, b.y - 0.075 + wag, b.y - 0.115 + wag], 0.013 * thick, 0.006 * thick);
  }
}

export interface PetPaths {
  far: SkPath;
  main: SkPath;
}

/** A walking (or, at a fixed phase, standing) dog or cat in profile at gait phase p, feet on the ground. */
export function petWalkPaths(look: PetLook, p: number, t: ScreenTransform): PetPaths {
  'worklet';
  const cat = look.kind === 'gato';
  const L = look.length;
  const g = look.girth;
  const seg = (cat ? 0.072 : 0.085) * look.legs;
  const yr = 2 * seg + 0.006;
  const front = { x: (cat ? 0.115 : 0.105) * L, y: yr };
  const hind = { x: (cat ? -0.13 : -0.115) * L, y: yr + 0.008 };
  const swingDeg = cat ? 26 : 24;
  const bob = 0.004 * Math.cos(4 * Math.PI * p);
  const legs: PetLeg[] = [];
  for (let i = 0; i < 4; i++) {
    const rear = i % 2 === 0;
    legs.push(petLeg(rear ? hind : front, seg, seg, swingDeg, p - PET_PHASES[i], rear));
  }
  let lowest = 1;
  for (let i = 0; i < 4; i++) lowest = Math.min(lowest, legs[i].paw.y);
  // The paws rest on the ground: the lower leg ends in a radius of 0.011 * girth around the paw point.
  const tt = petTransform(t, look, -lowest + 0.011 * g + 0.002 + bob);

  const far = Skia.PathBuilder.Make();
  const main = Skia.PathBuilder.Make();
  for (let i = 0; i < 4; i++) {
    const target = i < 2 ? far : main;
    const leg = legs[i];
    const rear = i % 2 === 0;
    muscle(target, tt, leg.root, leg.joint, (rear ? 0.036 : 0.026) * g, (rear ? 0.03 : 0.022) * g, 0.3, 0.015 * g);
    muscle(target, tt, leg.joint, leg.paw, 0.015 * g, 0.014 * g, 0.4, 0.011 * g);
    blob(target, tt, { x: leg.paw.x + 0.012, y: leg.paw.y + 0.008 }, 0.018, 0.009, 0);
  }

  // Body: chest, withers, back, croup, rump, thigh, tuck-up, belly, deep chest.
  const back = cat ? 0.07 : 0.088;
  const deep = (cat ? 0.022 : 0.036) * g;
  const bx = [0.15, 0.168, 0.15, 0.09, -0.02, -0.1, -0.15, -0.17, -0.16, -0.12, -0.06, 0.02, 0.1];
  const by = [0.0, 0.045, back - 0.004, back + 0.01, back, back + 0.004, back - 0.006, 0.045, 0.006, -0.018 * g, -0.008 * g, -deep * 0.7, -deep];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < bx.length; i++) {
    xs.push(bx[i] * L);
    ys.push(yr + by[i]);
  }
  smooth(main, tt, xs, ys);

  // Neck and head.
  const hc = cat ? { x: 0.19 * L + 0.02, y: yr + 0.115 } : { x: 0.18 * L + 0.035, y: yr + 0.135 };
  muscle(main, tt, { x: 0.13 * L, y: yr + 0.05 }, { x: hc.x - 0.014, y: hc.y - 0.014 }, (cat ? 0.038 : 0.048) * g, 0.04 * g, 0.4, cat ? 0.03 : 0.032);
  petHead(main, far, tt, look, hc);
  const wag = (cat ? 0.012 : 0.018) * Math.sin(2 * Math.PI * p * 2);
  petTail(main, tt, look, { x: -0.16 * L, y: yr + back - 0.012 }, wag);
  if (look.fluffy) {
    // Long fur: a ruff at the chest and the neck, a feathered fringe under the belly.
    blob(main, tt, { x: 0.15 * L, y: yr + 0.03 }, 0.034, 0.05, 0);
    smooth(main, tt, [0.1 * L, 0.02 * L, -0.07 * L, -0.06 * L, 0.02 * L, 0.1 * L], [yr - deep, yr - deep * 0.7 - 0.006, yr - 0.012, yr - 0.03, yr - deep - 0.022, yr - deep - 0.026]);
  }
  return { far: far.build(), main: main.build() };
}

/** A dog or a cat sitting in profile, for the gathering and the reveal. */
export function petSitPath(look: PetLook, t: ScreenTransform): SkPath {
  'worklet';
  const tt = petTransform(t, look, 0);
  const path = Skia.PathBuilder.Make();
  const g = look.girth;
  const cat = look.kind === 'gato';
  const lg = 0.75 + 0.25 * look.legs;
  if (cat) {
    // A sitting cat: round haunch, upright chest, front legs straight down, the tail around the paws.
    blob(path, tt, { x: -0.035, y: 0.055 }, 0.065 * g, 0.055 * g, 0);
    smooth(path, tt, [-0.09, -0.08, -0.03, 0.02, 0.045, 0.04, 0.0], [0.01, 0.09, 0.17 * lg, 0.2 * lg, 0.16 * lg, 0.06, 0.005]);
    muscle(path, tt, { x: 0.03, y: 0.15 * lg }, { x: 0.035, y: 0.008 }, 0.017 * g, 0.015 * g, 0.4, 0.012);
    blob(path, tt, { x: 0.045, y: 0.006 }, 0.02, 0.008, 0);
    const hc = { x: 0.04, y: 0.2 * lg + 0.05 };
    petHead(path, null, tt, look, hc);
    const thick = look.fluffy || look.tail === 'plume' ? 1.8 : 1;
    strand(path, tt, [-0.09, -0.04, 0.02, 0.07], [0.012, 0.004, 0.004, 0.012], 0.016 * thick, 0.012 * thick);
    if (look.fluffy) blob(path, tt, { x: 0.035, y: 0.15 * lg }, 0.032, 0.04, 0);
    return path.build();
  }
  // A sitting dog: haunch on the ground, the back rising to the withers, deep chest, straight front
  // legs, neck and head above the chest, the tail along the ground.
  const sh = 0.27 * lg;
  blob(path, tt, { x: -0.065, y: 0.065 }, 0.075 * g, 0.065 * g, 0);
  blob(path, tt, { x: -0.02, y: 0.008 }, 0.042, 0.011, 0);
  smooth(path, tt, [-0.13, -0.12, -0.07, 0.0, 0.055, 0.07, 0.055, 0.0], [0.012, 0.09, sh * 0.72, sh, sh * 0.86, sh * 0.62, sh * 0.42, 0.04]);
  muscle(path, tt, { x: 0.045, y: sh * 0.62 }, { x: 0.05, y: 0.01 }, 0.024 * g, 0.02 * g, 0.35, 0.014);
  muscle(path, tt, { x: 0.025, y: sh * 0.6 }, { x: 0.03, y: 0.01 }, 0.022 * g, 0.019 * g, 0.35, 0.013);
  blob(path, tt, { x: 0.062, y: 0.008 }, 0.022, 0.009, 0);
  const hc = { x: 0.07, y: sh + 0.085 };
  muscle(path, tt, { x: 0.02, y: sh * 0.92 }, { x: hc.x - 0.01, y: hc.y - 0.015 }, 0.042 * g, 0.034 * g, 0.4, 0.026);
  petHead(path, null, tt, look, hc);
  if (look.tail !== 'stub') {
    const thick = look.fluffy || look.tail === 'plume' ? 1.8 : 1;
    strand(path, tt, [-0.13, -0.06, 0.0, 0.05], [0.016, 0.008, 0.006, 0.01], 0.013 * thick, 0.008 * thick);
  }
  if (look.fluffy) {
    blob(path, tt, { x: 0.05, y: sh * 0.75 }, 0.035, 0.045, 0);
    blob(path, tt, { x: -0.08, y: 0.12 }, 0.045, 0.03, 0);
  }
  return path.build();
}
