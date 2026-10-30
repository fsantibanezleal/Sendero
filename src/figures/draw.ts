/**
 * Silhouette geometry: turns rig poses into ONE Skia path per figure, in screen pixels.
 *
 * Every primitive (tapered capsule, ellipse, polygon) is wound clockwise on screen (positive
 * shoelace area in y-down coordinates, the direction Skia uses for addCircle and addOval), so the
 * default nonzero fill merges overlapping parts into one clean silhouette, never punching holes.
 *
 * Body units: H = 1 is the person's height, ground at y = 0, y up, facing +x. A transform maps
 * them to the screen: X = ox + facing * x * h, Y = oy - y * h.
 */
import { Skia, type SkPath, type SkPathBuilder } from '@shopify/react-native-skia';

import type { HumanKind, PetKind } from './catalog';
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

function legPath(path: SkPathBuilder, t: ScreenTransform, leg: HumanPose['near']['leg']): void {
  'worklet';
  limb(path, t, leg.hip, 0.06, leg.knee, 0.041);
  limb(path, t, leg.knee, 0.04, leg.ankle, 0.025);
  limb(path, t, { x: leg.heel.x, y: leg.heel.y + 0.02 }, 0.021, { x: leg.toe.x, y: leg.toe.y + 0.012 }, 0.012);
}

function armPath(path: SkPathBuilder, t: ScreenTransform, arm: HumanPose['near']['arm']): void {
  'worklet';
  limb(path, t, arm.shoulder, 0.034, arm.elbow, 0.027);
  limb(path, t, arm.elbow, 0.026, arm.hand, 0.02);
  const dx = arm.hand.x - arm.elbow.x;
  const dy = arm.hand.y - arm.elbow.y;
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  blob(path, t, { x: arm.hand.x + (dx / l) * 0.03, y: arm.hand.y + (dy / l) * 0.03 }, 0.024, 0.032, Math.atan2(dx, -dy));
}

/** The far-side limbs of a person in profile (drawn dimmer, behind the body). */
export function humanFarPath(pose: HumanPose, t: ScreenTransform): SkPath {
  'worklet';
  const path = Skia.PathBuilder.Make();
  legPath(path, t, pose.far.leg);
  armPath(path, t, pose.far.arm);
  return path.build();
}

/** The body, head, near limbs and the clothing that identifies each person, in profile. */
export function humanMainPath(kind: HumanKind, pose: HumanPose, t: ScreenTransform): SkPath {
  'worklet';
  const path = Skia.PathBuilder.Make();
  const broad = kind === 'hombre' || kind === 'abuelo' ? 1.08 : 1;

  // Torso: back line up, front line down, in trunk coordinates (along, depth).
  const along = [-0.02, 0.25, 0.55, 0.92, 1.0, 1.0, 0.78, 0.5, 0.2, -0.02];
  const depth = [-0.078, -0.06, -0.075, -0.062, -0.03, 0.042, 0.07, 0.052, 0.066, 0.062];
  const tx: number[] = [];
  const ty: number[] = [];
  for (let i = 0; i < along.length; i++) {
    const p = trunkPoint(pose, along[i], depth[i] * broad);
    tx.push(p.x);
    ty.push(p.y);
  }
  poly(path, t, tx, ty);
  blob(path, t, pose.pelvis, 0.075, 0.068, 0);

  // Neck and head.
  const neckBase = trunkPoint(pose, 0.97, 0.008);
  limb(path, t, neckBase, 0.033, { x: pose.head.x - 0.008, y: pose.head.y - 0.045 }, 0.028);
  blob(path, t, pose.head, BODY.headRadius * 0.92, BODY.headRadius, 0);
  const hx = pose.head.x;
  const hy = pose.head.y;
  poly(path, t, [hx + 0.052, hx + 0.074, hx + 0.05], [hy + 0.004, hy - 0.016, hy - 0.026]);

  legPath(path, t, pose.near.leg);
  armPath(path, t, pose.near.arm);

  const kneeFront = Math.max(pose.near.leg.knee.x, pose.far.leg.knee.x);
  const kneeBack = Math.min(pose.near.leg.knee.x, pose.far.leg.knee.x);
  const ankleFront = Math.max(pose.near.leg.ankle.x, pose.far.leg.ankle.x);
  const ankleBack = Math.min(pose.near.leg.ankle.x, pose.far.leg.ankle.x);
  const waist = trunkPoint(pose, 0.32, 0);
  const shoulder = pose.shoulder;

  if (kind === 'abuela') {
    // Rebozo over the head and shoulders, falling down the back and draped across the chest.
    poly(
      path,
      t,
      [hx + 0.055, hx + 0.01, hx - 0.062, hx - 0.078, shoulder.x - 0.095, waist.x - 0.1, waist.x - 0.02, shoulder.x + 0.05, shoulder.x + 0.08, hx + 0.036],
      [hy + 0.03, hy + 0.088, hy + 0.05, hy - 0.035, shoulder.y - 0.02, waist.y - 0.02, waist.y + 0.07, shoulder.y - 0.15, shoulder.y - 0.055, hy - 0.058],
    );
    // Long skirt from the waist to mid-calf, following the knees.
    poly(
      path,
      t,
      [waist.x - 0.082, waist.x + 0.074, kneeFront + 0.07, Math.max(kneeFront, ankleFront) + 0.06, Math.min(kneeBack, ankleBack) - 0.07, kneeBack - 0.085],
      [waist.y, waist.y, 0.3, 0.1, 0.1, 0.3],
    );
  } else if (kind === 'abuelo') {
    // Wide-brimmed sombrero and a cane planted ahead of the near hand.
    blob(path, t, { x: hx - 0.004, y: hy + 0.058 }, 0.13, 0.022, 0);
    poly(path, t, [hx - 0.055, hx - 0.048, hx + 0.042, hx + 0.05], [hy + 0.062, hy + 0.135, hy + 0.135, hy + 0.062]);
    const hand = pose.near.arm.hand;
    limb(path, t, { x: hand.x + 0.01, y: hand.y + 0.01 }, 0.011, { x: hand.x + 0.075, y: 0.0 }, 0.009);
    limb(path, t, { x: hand.x - 0.02, y: hand.y + 0.028 }, 0.009, { x: hand.x + 0.018, y: hand.y + 0.03 }, 0.009);
  } else if (kind === 'mujer') {
    // Long hair down the back and a dress to the knees.
    poly(
      path,
      t,
      [hx + 0.024, hx - 0.06, shoulder.x - 0.075, shoulder.x - 0.035, hx - 0.018],
      [hy + 0.07, hy + 0.045, shoulder.y - 0.12, shoulder.y - 0.13, hy - 0.035],
    );
    poly(
      path,
      t,
      [waist.x - 0.078, waist.x + 0.07, kneeFront + 0.065, kneeBack - 0.075],
      [waist.y, waist.y, 0.3, 0.3],
    );
  } else {
    // A narrower hat.
    blob(path, t, { x: hx - 0.004, y: hy + 0.056 }, 0.095, 0.016, 0);
    poly(path, t, [hx - 0.045, hx - 0.04, hx + 0.036, hx + 0.042], [hy + 0.06, hy + 0.118, hy + 0.118, hy + 0.06]);
  }
  return path.build();
}

/** Leg phases of the lateral-sequence walk: left hind, left fore, right hind, right fore. */
const PET_PHASES = [0, 0.25, 0.5, 0.75];

interface PetShape {
  scale: number;
  shoulder: Vec;
  hip: Vec;
  upper: number;
  lower: number;
  swingDeg: number;
}

const PET_SHAPE: Record<PetKind, PetShape> = {
  perro: { scale: 1, shoulder: { x: 0.105, y: 0.235 }, hip: { x: -0.125, y: 0.24 }, upper: 0.115, lower: 0.115, swingDeg: 24 },
  gato: { scale: 0.56, shoulder: { x: 0.105, y: 0.235 }, hip: { x: -0.125, y: 0.24 }, upper: 0.112, lower: 0.112, swingDeg: 26 },
};

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
  const upperDeg = rear ? swing - 12 : swing + 4;
  const lowerDeg = rear ? swing + 18 - 28 * lift : swing - 32 * lift;
  const ur = (upperDeg * Math.PI) / 180;
  const lr = (lowerDeg * Math.PI) / 180;
  const joint = { x: root.x + Math.sin(ur) * upper, y: root.y - Math.cos(ur) * upper };
  const paw = { x: joint.x + Math.sin(lr) * lower, y: joint.y - Math.cos(lr) * lower };
  return { root, joint, paw };
}

export interface PetPaths {
  far: SkPath;
  main: SkPath;
}

/** A walking dog or cat in profile at gait phase p, with feet on the ground. */
export function petWalkPaths(kind: PetKind, p: number, t: ScreenTransform): PetPaths {
  'worklet';
  const shape = PET_SHAPE[kind];
  const k = shape.scale;
  const bob = 0.006 * Math.cos(4 * Math.PI * p);
  const legs: PetLeg[] = [];
  for (let i = 0; i < 4; i++) {
    const rear = i % 2 === 0;
    const root = rear ? shape.hip : shape.shoulder;
    legs.push(petLeg(root, shape.upper, shape.lower, shape.swingDeg, p - PET_PHASES[i], rear));
  }
  let lowest = 1;
  for (let i = 0; i < 4; i++) lowest = Math.min(lowest, legs[i].paw.y);
  const lift = -lowest + 0.012 + bob;
  const tt: ScreenTransform = { ox: t.ox, oy: t.oy - lift * k * t.h, h: t.h * k, facing: t.facing };

  const far = Skia.PathBuilder.Make();
  const main = Skia.PathBuilder.Make();
  for (let i = 0; i < 4; i++) {
    const target = i < 2 ? far : main;
    const leg = legs[i];
    limb(target, tt, leg.root, 0.034, leg.joint, 0.022);
    limb(target, tt, leg.joint, 0.02, leg.paw, 0.016);
    blob(target, tt, { x: leg.paw.x + 0.01, y: leg.paw.y + 0.008 }, 0.022, 0.012, 0);
  }

  const wag = 0.02 * Math.sin(2 * Math.PI * p * 2);
  limb(main, tt, { x: 0.12, y: 0.26 }, 0.074, { x: -0.13, y: 0.262 }, 0.066);
  poly(main, tt, [0.08, -0.06, -0.12, 0.1], [0.215, 0.235, 0.215, 0.21]);
  if (kind === 'perro') {
    // Xoloitzcuintle: lean body, long neck, large upright ears, long thin tail.
    limb(main, tt, { x: 0.13, y: 0.3 }, 0.045, { x: 0.2, y: 0.39 }, 0.033);
    blob(main, tt, { x: 0.205, y: 0.405 }, 0.046, 0.04, 0);
    limb(main, tt, { x: 0.23, y: 0.4 }, 0.028, { x: 0.295, y: 0.382 }, 0.015);
    poly(main, tt, [0.19, 0.172, 0.218], [0.438, 0.535, 0.445]);
    poly(far, tt, [0.17, 0.152, 0.197], [0.434, 0.522, 0.44]);
    limb(main, tt, { x: -0.15, y: 0.272 }, 0.016, { x: -0.222, y: 0.232 + wag }, 0.011);
    limb(main, tt, { x: -0.222, y: 0.232 + wag }, 0.011, { x: -0.262, y: 0.165 + wag }, 0.006);
  } else {
    // Cat: round head, small pointed ears, tail raised in a gentle curve.
    limb(main, tt, { x: 0.13, y: 0.29 }, 0.05, { x: 0.18, y: 0.36 }, 0.045);
    blob(main, tt, { x: 0.19, y: 0.37 }, 0.062, 0.056, 0);
    poly(main, tt, [0.16, 0.162, 0.198], [0.408, 0.47, 0.418]);
    poly(main, tt, [0.205, 0.226, 0.236], [0.414, 0.468, 0.398]);
    limb(main, tt, { x: -0.14, y: 0.28 }, 0.022, { x: -0.2, y: 0.37 + wag }, 0.018);
    limb(main, tt, { x: -0.2, y: 0.37 + wag }, 0.018, { x: -0.17, y: 0.46 + wag }, 0.014);
  }
  return { far: far.build(), main: main.build() };
}

/** A pet sitting in profile, for the reveal. */
export function petSitPath(kind: PetKind, t: ScreenTransform): SkPath {
  'worklet';
  const k = PET_SHAPE[kind].scale;
  const tt: ScreenTransform = { ox: t.ox, oy: t.oy, h: t.h * k, facing: t.facing };
  const path = Skia.PathBuilder.Make();
  blob(path, tt, { x: -0.05, y: 0.085 }, 0.1, 0.082, 0);
  limb(path, tt, { x: -0.035, y: 0.11 }, 0.08, { x: 0.065, y: 0.27 }, 0.068);
  limb(path, tt, { x: 0.085, y: 0.24 }, 0.026, { x: 0.095, y: 0.012 }, 0.02);
  limb(path, tt, { x: 0.06, y: 0.24 }, 0.024, { x: 0.065, y: 0.012 }, 0.019);
  blob(path, tt, { x: -0.03, y: 0.012 }, 0.07, 0.014, 0);
  if (kind === 'perro') {
    limb(path, tt, { x: 0.07, y: 0.3 }, 0.045, { x: 0.12, y: 0.42 }, 0.034);
    blob(path, tt, { x: 0.125, y: 0.44 }, 0.046, 0.04, 0);
    limb(path, tt, { x: 0.15, y: 0.435 }, 0.028, { x: 0.215, y: 0.418 }, 0.015);
    poly(path, tt, [0.11, 0.094, 0.138], [0.474, 0.57, 0.48]);
    limb(path, tt, { x: -0.13, y: 0.03 }, 0.012, { x: 0.02, y: 0.012 }, 0.007);
  } else {
    blob(path, tt, { x: 0.11, y: 0.41 }, 0.062, 0.056, 0);
    poly(path, tt, [0.08, 0.082, 0.118], [0.448, 0.51, 0.458]);
    poly(path, tt, [0.125, 0.146, 0.156], [0.454, 0.508, 0.438]);
    limb(path, tt, { x: -0.13, y: 0.03 }, 0.018, { x: 0.05, y: 0.016 }, 0.012);
  }
  return path.build();
}

/**
 * A person standing and facing the viewer, for the reveal behind the visitor. `breath` in [0, 1]
 * widens the chest slightly. Proportions from the same anthropometric fractions as the rig.
 */
export function humanFrontPath(kind: HumanKind, t: ScreenTransform, breath: number): SkPath {
  'worklet';
  const path = Skia.PathBuilder.Make();
  const stoop = kind === 'abuela' || kind === 'abuelo' ? 0.02 : 0;
  const sw = (BODY.shoulderWidth / 2) * (kind === 'hombre' || kind === 'abuelo' ? 1.06 : 0.97) * (1 + 0.012 * breath);
  const hw = BODY.hipWidth / 2;
  const top = 0.818 - stoop;
  const headY = 0.935 - stoop * 1.4;

  poly(path, t, [-sw, sw, sw * 0.92, hw * 0.98, hw, -hw, -hw * 0.98, -sw * 0.92], [top, top, 0.7, 0.62, 0.53, 0.53, 0.62, 0.7]);
  limb(path, t, { x: -sw * 0.86, y: top - 0.01 }, 0.038, { x: sw * 0.86, y: top - 0.01 }, 0.038);
  limb(path, t, { x: 0, y: top }, 0.03, { x: 0, y: headY - 0.05 }, 0.027);
  blob(path, t, { x: 0, y: headY }, 0.058, BODY.headRadius, 0);
  for (const side of [-1, 1]) {
    const sh = { x: side * sw, y: top - 0.025 };
    const el = { x: side * (sw + 0.024), y: top - BODY.upperArm };
    const ha = { x: side * (sw + 0.012), y: top - BODY.upperArm - BODY.forearm };
    limb(path, t, sh, 0.034, el, 0.027);
    limb(path, t, el, 0.026, ha, 0.02);
    blob(path, t, { x: ha.x, y: ha.y - 0.03 }, 0.022, 0.034, 0);
    const hip = { x: side * hw * 0.5, y: 0.53 };
    const knee = { x: side * hw * 0.52, y: 0.285 };
    const ankle = { x: side * hw * 0.5, y: 0.045 };
    limb(path, t, hip, 0.062, knee, 0.042);
    limb(path, t, knee, 0.04, ankle, 0.026);
    blob(path, t, { x: ankle.x + side * 0.012, y: 0.018 }, 0.032, 0.02, 0);
  }

  if (kind === 'abuela') {
    poly(
      path,
      t,
      [0, 0.07, 0.085, sw + 0.06, sw + 0.03, 0, -sw - 0.03, -sw - 0.06, -0.085, -0.07],
      [headY + 0.085, headY + 0.05, headY - 0.04, top - 0.07, 0.6, 0.66, 0.6, top - 0.07, headY - 0.04, headY + 0.05],
    );
    poly(path, t, [-hw - 0.01, hw + 0.01, hw + 0.075, -hw - 0.075], [0.62, 0.62, 0.1, 0.1]);
  } else if (kind === 'abuelo') {
    blob(path, t, { x: 0, y: headY + 0.058 }, 0.15, 0.024, 0);
    poly(path, t, [-0.05, 0.05, 0.044, -0.044], [headY + 0.06, headY + 0.06, headY + 0.135, headY + 0.135]);
    limb(path, t, { x: sw + 0.03, y: top - BODY.upperArm - BODY.forearm + 0.02 }, 0.011, { x: sw + 0.07, y: 0 }, 0.009);
  } else if (kind === 'mujer') {
    limb(path, t, { x: -0.05, y: headY + 0.02 }, 0.04, { x: -sw * 0.7, y: top - 0.1 }, 0.03);
    limb(path, t, { x: 0.05, y: headY + 0.02 }, 0.04, { x: sw * 0.7, y: top - 0.1 }, 0.03);
    poly(path, t, [-hw, hw, hw + 0.06, -hw - 0.06], [0.62, 0.62, 0.3, 0.3]);
  } else {
    blob(path, t, { x: 0, y: headY + 0.056 }, 0.11, 0.018, 0);
    poly(path, t, [-0.045, 0.045, 0.04, -0.04], [headY + 0.06, headY + 0.06, headY + 0.12, headY + 0.12]);
  }
  return path.build();
}
