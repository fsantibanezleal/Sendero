/**
 * Draws every figure with the real Skia engine (CanvasKit, the WebAssembly build of Skia that
 * @shopify/react-native-skia ships for tests), so a geometry error shows up here instead of on the
 * tablet: every person and pet, walking and standing, for the whole gait cycle, and the reveal poses.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@shopify/react-native-skia', () =>
  require('@shopify/react-native-skia/lib/commonjs/mock').Mock((globalThis as unknown as { CanvasKit: unknown }).CanvasKit),
);

type Draw = typeof import('../draw');

let draw: Draw;
let curves: import('../fourier').GaitCurves;
let rig: typeof import('../rig');

beforeAll(async () => {
  const init = require('canvaskit-wasm/bin/full/canvaskit');
  (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = await init({});
  draw = require('../draw');
  rig = require('../rig');
  curves = require('../gait').gaitCurves('older');
}, 60000);

const T = { ox: 400, oy: 900, h: 600, facing: 1 };

function bounds(path: { getBounds(): { x: number; y: number; width: number; height: number } }) {
  return path.getBounds();
}

describe('figures drawn with real Skia', () => {
  const style = { trunkLeanDeg: 8, amplitude: 0.85, armSwing: 0.6, headForward: 0.012 };

  it('draws every person walking through the whole cycle, feet near the ground line', () => {
    for (const kind of ['abuela', 'abuelo', 'mujer', 'hombre'] as const) {
      for (let i = 0; i < 20; i++) {
        const pose = rig.walkPose(curves, i / 20, style);
        const main = draw.humanMainPath(kind, pose, T);
        const far = draw.humanFarPath(pose, T);
        const b = bounds(main);
        expect(b.height).toBeGreaterThan(0.85 * T.h);
        expect(b.height).toBeLessThan(1.25 * T.h);
        const bf = bounds(far);
        // The lowest point of both legs together touches the ground (one foot is always down).
        const bottom = Math.max(b.y + b.height, bf.y + bf.height);
        expect(Math.abs(bottom - T.oy)).toBeLessThan(0.05 * T.h);
        expect(bf.height).toBeGreaterThan(0.3 * T.h);
      }
    }
  });

  it('draws the dog and the cat walking and sitting', () => {
    for (const kind of ['perro', 'gato'] as const) {
      for (let i = 0; i < 12; i++) {
        const { main, far } = draw.petWalkPaths(kind, i / 12, T);
        expect(bounds(main).height).toBeGreaterThan(0.1 * T.h);
        expect(bounds(far).width).toBeGreaterThan(0);
      }
      expect(bounds(draw.petSitPath(kind, T)).height).toBeGreaterThan(0.1 * T.h);
    }
  });

  it('draws the front view of every person for the reveal', () => {
    for (const kind of ['abuela', 'abuelo', 'mujer', 'hombre'] as const) {
      const b = bounds(draw.humanFrontPath(kind, T, 0.5));
      expect(b.height).toBeGreaterThan(0.9 * T.h);
      expect(b.width).toBeGreaterThan(0.2 * T.h);
    }
  });
});
