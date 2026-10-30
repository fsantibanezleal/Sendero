import type { FourierCurve, GaitCurves } from '../fourier';
import { armFK, BODY, legFK, standPose, walkPose } from '../rig';

/** Synthetic curves with textbook shapes (degrees), used until real data is loaded. */
function curve(a0: number, a1: number, b1: number, a2 = 0, b2 = 0): FourierCurve {
  return { a0, a: [a1, a2], b: [b1, b2] };
}

const CURVES: GaitCurves = {
  pelvisTilt: curve(10, 0, 0, 1, 0),
  hipFlexion: curve(12, 18, 6),
  kneeFlexion: curve(22, -8, -22, -6, 0),
  ankleDorsiflexion: curve(1, -6, 4),
};

const STYLE = { trunkLeanDeg: 4, amplitude: 1, armSwing: 0.8, headForward: 0 };

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('leg forward kinematics', () => {
  it('keeps the segment lengths of the anthropometric table', () => {
    const leg = legFK({ x: 0, y: 0 }, 25, 40, 5);
    expect(dist(leg.hip, leg.knee)).toBeCloseTo(BODY.thigh, 9);
    expect(dist(leg.knee, leg.ankle)).toBeCloseTo(BODY.shank, 9);
    expect(dist(leg.heel, leg.toe)).toBeCloseTo(BODY.foot, 9);
  });

  it('puts a straight standing leg under the hip, with the toe forward', () => {
    const leg = legFK({ x: 0, y: BODY.hipHeight }, 0, 0, 0);
    expect(leg.knee.x).toBeCloseTo(0, 9);
    expect(leg.ankle.y).toBeCloseTo(BODY.hipHeight - BODY.thigh - BODY.shank, 9);
    expect(leg.toe.x).toBeGreaterThan(leg.heel.x);
    expect(Math.min(leg.heel.y, leg.toe.y)).toBeCloseTo(0, 2);
  });

  it('moves the knee forward with hip flexion and the foot back with knee flexion', () => {
    const flexed = legFK({ x: 0, y: 0 }, 30, 0, 0);
    expect(flexed.knee.x).toBeGreaterThan(0);
    const bent = legFK({ x: 0, y: 0 }, 0, 50, 0);
    expect(bent.ankle.x).toBeLessThan(bent.knee.x);
  });
});

describe('walking pose', () => {
  it('keeps the lowest foot point on the ground through the whole cycle', () => {
    for (let i = 0; i < 100; i++) {
      const pose = walkPose(CURVES, i / 100, STYLE);
      const legs = [pose.near.leg, pose.far.leg];
      const lowest = Math.min(...legs.flatMap((l) => [l.heel.y, l.toe.y, l.ankle.y]));
      expect(lowest).toBeCloseTo(0, 9);
      expect(pose.pelvis.y).toBeGreaterThan(0.45);
      // Toe contact of a plantarflexed trailing foot lifts the body a little (heel rise).
      expect(pose.pelvis.y).toBeLessThan(BODY.hipHeight + 0.04);
    }
  });

  it('moves the two legs half a cycle apart', () => {
    const a = walkPose(CURVES, 0.1, STYLE);
    const b = walkPose(CURVES, 0.6, STYLE);
    expect(a.near.leg.knee.x).toBeCloseTo(b.far.leg.knee.x, 9);
    expect(a.far.leg.knee.x).toBeCloseTo(b.near.leg.knee.x, 9);
  });

  it('swings each arm with the opposite leg', () => {
    for (const p of [0.05, 0.3, 0.55, 0.8]) {
      const pose = walkPose(CURVES, p, STYLE);
      const farLegForward = pose.far.leg.knee.x - pose.pelvis.x;
      const nearArmForward = pose.near.arm.hand.x - pose.shoulder.x;
      expect(Math.sign(nearArmForward - 0.03)).toBe(Math.sign(farLegForward) || 1);
    }
  });

  it('places the shoulder at the anthropometric height when standing upright', () => {
    const pose = standPose({ ...STYLE, trunkLeanDeg: 0 }, 0);
    expect(pose.shoulder.y).toBeCloseTo(pose.pelvis.y + BODY.trunk, 9);
    expect(pose.shoulder.y).toBeGreaterThan(0.75);
    expect(pose.shoulder.y).toBeLessThan(0.86);
  });

  it('leans the trunk forward for older people', () => {
    const upright = walkPose(CURVES, 0.2, STYLE);
    const leaning = walkPose(CURVES, 0.2, { ...STYLE, trunkLeanDeg: 10 });
    expect(leaning.shoulder.x).toBeGreaterThan(upright.shoulder.x);
  });

  it('keeps the arm segment lengths', () => {
    const arm = armFK({ x: 0, y: 1 }, 20, 30);
    expect(dist(arm.shoulder, arm.elbow)).toBeCloseTo(BODY.upperArm, 9);
    expect(dist(arm.elbow, arm.hand)).toBeCloseTo(BODY.forearm, 9);
  });
});
