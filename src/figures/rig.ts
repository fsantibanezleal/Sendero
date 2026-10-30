/**
 * The human 2D cutout rig in profile, facing +x, in body-height units (H = 1), ground at y = 0,
 * y up. Forward kinematics from the sagittal gait curves (gait.ts).
 *
 * Segment lengths are fractions of body height H from Drillis and Contini (1966) as drawn in
 * Winter, Biomechanics and Motor Control of Human Movement, 4th ed. (Wiley, 2009), Figure 4.1:
 * hip joint 0.530, knee 0.285, ankle 0.039, shoulder 0.818, chin 0.870, head 0.130, upper arm
 * 0.186, forearm 0.146, hand 0.108, foot length 0.152, shoulder width 0.259, hip width 0.191.
 * Checked on 2026-10-29 against the figure reproduced at
 * https://courses.grainger.illinois.edu/me481/sp2021/Anthro-Winter.pdf (page 83).
 */
import { evalFourier, type GaitCurves } from './fourier';

export interface Vec {
  x: number;
  y: number;
}

export const BODY = {
  hipHeight: 0.53,
  thigh: 0.245,
  shank: 0.246,
  ankleHeight: 0.039,
  foot: 0.152,
  trunk: 0.288,
  neck: 0.052,
  /** Half the head height (0.130 H). */
  headRadius: 0.065,
  upperArm: 0.186,
  forearm: 0.146,
  hand: 0.108,
  shoulderWidth: 0.259,
  hipWidth: 0.191,
} as const;

export interface LegPose {
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  heel: Vec;
  toe: Vec;
}

export interface ArmPose {
  shoulder: Vec;
  elbow: Vec;
  hand: Vec;
}

export interface HumanPose {
  pelvis: Vec;
  shoulder: Vec;
  neck: Vec;
  head: Vec;
  /** Trunk angle from vertical, degrees, forward positive. */
  trunkDeg: number;
  near: { leg: LegPose; arm: ArmPose };
  far: { leg: LegPose; arm: ArmPose };
}

export interface RigStyle {
  /** Constant forward lean of the trunk, degrees (older people lean more). */
  trunkLeanDeg: number;
  /** Scales the joint excursions around their means (1 = the data). */
  amplitude: number;
  /** Arm swing in degrees per degree of contralateral hip excursion. */
  armSwing: number;
  /** Extra forward head offset, body-height units. */
  headForward: number;
}

const DEG = Math.PI / 180;

/** Unit vector pointing down, rotated forward (toward +x) by `deg`. */
function down(deg: number): Vec {
  'worklet';
  const r = deg * DEG;
  return { x: Math.sin(r), y: -Math.cos(r) };
}

function addScaled(p: Vec, d: Vec, s: number): Vec {
  'worklet';
  return { x: p.x + d.x * s, y: p.y + d.y * s };
}

/** Scales an angle's excursion around its mean. */
function around(value: number, mean: number, amplitude: number): number {
  'worklet';
  return mean + (value - mean) * amplitude;
}

/** One leg from the hip, given hip flexion, knee flexion and ankle dorsiflexion in degrees. */
export function legFK(hip: Vec, hipFlex: number, kneeFlex: number, ankleDorsi: number): LegPose {
  'worklet';
  const thighDir = down(hipFlex);
  const knee = addScaled(hip, thighDir, BODY.thigh);
  const shankDeg = hipFlex - kneeFlex;
  const shankDir = down(shankDeg);
  const ankle = addScaled(knee, shankDir, BODY.shank);
  // Foot: perpendicular to the shank, pointing forward, rotated up by dorsiflexion.
  const footDeg = shankDeg + 90 - ankleDorsi;
  const footDir = down(footDeg);
  const sole = addScaled(ankle, down(shankDeg), BODY.ankleHeight);
  const heel = addScaled(sole, footDir, -0.25 * BODY.foot);
  const toe = addScaled(sole, footDir, 0.75 * BODY.foot);
  return { hip, knee, ankle, heel, toe };
}

/** One arm from the shoulder: swing angle and elbow flexion in degrees (forward positive). */
export function armFK(shoulder: Vec, swingDeg: number, elbowFlexDeg: number): ArmPose {
  'worklet';
  const elbow = addScaled(shoulder, down(swingDeg), BODY.upperArm);
  const hand = addScaled(elbow, down(swingDeg + elbowFlexDeg), BODY.forearm);
  return { shoulder, elbow, hand };
}

function lowestY(leg: LegPose): number {
  'worklet';
  return Math.min(leg.heel.y, leg.toe.y, leg.ankle.y);
}

/**
 * The full walking pose at phase p. The near side is the right side (phase p), the far side the
 * left (phase p + 0.5). The pelvis height is solved so the lowest foot point touches y = 0.
 */
export function walkPose(curves: GaitCurves, p: number, style: RigStyle): HumanPose {
  'worklet';
  const pl = p + 0.5;
  const hipMean = curves.hipFlexion.a0;
  const kneeMean = curves.kneeFlexion.a0;
  const ankleMean = curves.ankleDorsiflexion.a0;
  const hipR = around(evalFourier(curves.hipFlexion, p), hipMean, style.amplitude);
  const hipL = around(evalFourier(curves.hipFlexion, pl), hipMean, style.amplitude);
  const kneeR = around(evalFourier(curves.kneeFlexion, p), kneeMean, style.amplitude);
  const kneeL = around(evalFourier(curves.kneeFlexion, pl), kneeMean, style.amplitude);
  const ankR = around(evalFourier(curves.ankleDorsiflexion, p), ankleMean, style.amplitude);
  const ankL = around(evalFourier(curves.ankleDorsiflexion, pl), ankleMean, style.amplitude);
  const tilt = evalFourier(curves.pelvisTilt, p) - curves.pelvisTilt.a0;

  // Solve the pelvis height with the hip at the origin first, then lift so the lowest point is 0.
  const origin = { x: 0, y: 0 };
  const nearLeg0 = legFK(origin, hipR, kneeR, ankR);
  const farLeg0 = legFK(origin, hipL, kneeL, ankL);
  const lift = -Math.min(lowestY(nearLeg0), lowestY(farLeg0));
  const pelvis = { x: 0, y: lift };
  const nearLeg = legFK(pelvis, hipR, kneeR, ankR);
  const farLeg = legFK(pelvis, hipL, kneeL, ankL);

  const trunkDeg = style.trunkLeanDeg + 0.5 * tilt;
  const up = { x: Math.sin(trunkDeg * DEG), y: Math.cos(trunkDeg * DEG) };
  const shoulder = addScaled(pelvis, up, BODY.trunk);
  const neck = addScaled(shoulder, up, BODY.neck);
  const head = {
    x: neck.x + up.x * BODY.headRadius + style.headForward,
    y: neck.y + up.y * BODY.headRadius * 1.05,
  };

  // Arms swing against the contralateral leg; the elbow bends more when the arm is forward.
  const swingR = style.armSwing * (hipL - hipMean);
  const swingL = style.armSwing * (hipR - hipMean);
  const nearArm = armFK(shoulder, trunkDeg * 0.3 + swingR, 14 + Math.max(0, swingR) * 0.6);
  const farArm = armFK(shoulder, trunkDeg * 0.3 + swingL, 14 + Math.max(0, swingL) * 0.6);

  return {
    pelvis,
    shoulder,
    neck,
    head,
    trunkDeg,
    near: { leg: nearLeg, arm: nearArm },
    far: { leg: farLeg, arm: farArm },
  };
}

/** A gentle standing pose (for the gathered figures waiting at the far end of the path). */
export function standPose(style: RigStyle, swayDeg: number): HumanPose {
  'worklet';
  const nearLeg0 = legFK({ x: 0, y: 0 }, 2, 4, 2);
  const farLeg0 = legFK({ x: 0, y: 0 }, -2, 3, 0);
  const lift = -Math.min(lowestY(nearLeg0), lowestY(farLeg0));
  const pelvis = { x: 0, y: lift };
  const nearLeg = legFK(pelvis, 2, 4, 2);
  const farLeg = legFK(pelvis, -2, 3, 0);
  const trunkDeg = style.trunkLeanDeg + swayDeg;
  const up = { x: Math.sin(trunkDeg * DEG), y: Math.cos(trunkDeg * DEG) };
  const shoulder = addScaled(pelvis, up, BODY.trunk);
  const neck = addScaled(shoulder, up, BODY.neck);
  const head = {
    x: neck.x + up.x * BODY.headRadius + style.headForward,
    y: neck.y + up.y * BODY.headRadius * 1.05,
  };
  return {
    pelvis,
    shoulder,
    neck,
    head,
    trunkDeg,
    near: { leg: nearLeg, arm: armFK(shoulder, 4 + swayDeg, 18) },
    far: { leg: farLeg, arm: armFK(shoulder, -3 + swayDeg, 14) },
  };
}
