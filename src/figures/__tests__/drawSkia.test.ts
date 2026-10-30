/**
 * Draws the figures with the real Skia engine (CanvasKit, the WebAssembly build of Skia that
 * @shopify/react-native-skia ships for tests), so a geometry error shows up here instead of on the
 * tablet: many random variants of every person and pet, walking and standing, the reveal's front
 * view, and how many of the variants come out visibly different.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import type { HumanKind, PetKind } from '../catalog';
import type { Look, PetLook } from '../looks';

jest.mock('@shopify/react-native-skia', () =>
  require('@shopify/react-native-skia/lib/commonjs/mock').Mock((globalThis as unknown as { CanvasKit: unknown }).CanvasKit),
);

type Draw = typeof import('../draw');
type Looks = typeof import('../looks');

let CK: {
  MakeSurface(w: number, h: number): {
    getCanvas(): { clear(c: unknown): void; drawPath(p: unknown, paint: unknown): void };
    makeImageSnapshot(): { readPixels(x: number, y: number, info: unknown): Uint8Array | null };
    dispose(): void;
  };
  Paint: new () => { setColor(c: unknown): void; setAntiAlias(a: boolean): void };
  Color(r: number, g: number, b: number, a: number): unknown;
  TRANSPARENT: unknown;
  AlphaType: { Unpremul: unknown };
  ColorType: { RGBA_8888: unknown };
  ColorSpace: { SRGB: unknown };
};
let draw: Draw;
let looks: Looks;
let rig: typeof import('../rig');
let style: typeof import('../style');
let gait: typeof import('../gait');
let rand: () => number;

beforeAll(async () => {
  const init = require('canvaskit-wasm/bin/full/canvaskit');
  CK = await init({});
  (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = CK;
  draw = require('../draw');
  looks = require('../looks');
  rig = require('../rig');
  style = require('../style');
  gait = require('../gait');
  rand = require('../../procedural').mulberry32(2026);
}, 60000);

const T = { ox: 400, oy: 900, h: 600, facing: 1 };
const PEOPLE: HumanKind[] = ['abuela', 'abuelo', 'mujer', 'hombre'];
const PETS: PetKind[] = ['perro', 'gato'];

function bounds(path: { getBounds(): { x: number; y: number; width: number; height: number } }) {
  return path.getBounds();
}

/** The path as a CanvasKit path (the Skia mock wraps a path builder). */
function ck(p: unknown): unknown {
  const ref = (p as { ref: { snapshot?: () => unknown; detach?: () => unknown } }).ref;
  return ref.snapshot?.() ?? ref.detach?.() ?? ref;
}

/** A coarse coverage mask of a path drawn at a given transform. */
function mask(paths: unknown[], w: number, h: number): Uint8Array {
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  const paint = new CK.Paint();
  paint.setColor(CK.Color(255, 255, 255, 1));
  paint.setAntiAlias(false);
  for (const p of paths) canvas.drawPath(ck(p), paint);
  const px = surface.makeImageSnapshot().readPixels(0, 0, { width: w, height: h, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB }) as Uint8Array;
  surface.dispose();
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = px[4 * i + 3] > 127 ? 1 : 0;
  return m;
}

/** Share of differing pixels over the union of two masks. */
function difference(a: Uint8Array, b: Uint8Array): number {
  let x = 0;
  let u = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) u++;
    if (a[i] !== b[i]) x++;
  }
  return u === 0 ? 0 : x / u;
}

/** How many of the masks differ from every other kept one by at least `min` (greedy). */
function distinct(masks: Uint8Array[], min: number): number {
  const kept: Uint8Array[] = [];
  for (const m of masks) {
    if (kept.every((k) => difference(k, m) >= min)) kept.push(m);
  }
  return kept.length;
}

describe('figures drawn with real Skia', () => {
  it('draws 60 random variants of every person walking through the gait cycle, feet on the ground', () => {
    for (const kind of PEOPLE) {
      const curves = gait.gaitCurves(kind.startsWith('abu') ? 'older' : 'young');
      for (let i = 0; i < 60; i++) {
        const look: Look = looks.randomLook(rand, kind);
        const scale = looks.BASE_HEIGHT[kind] * look.build.height;
        const pose = rig.walkPose(curves, i / 60, style.rigStyle(look, false));
        const main = draw.humanMainPath(look, pose, T);
        const far = draw.humanFarPath(look, pose, T);
        const b = bounds(main);
        expect(b.height).toBeGreaterThan(0.8 * T.h * scale);
        expect(b.height).toBeLessThan(1.3 * T.h * scale);
        const bf = bounds(far);
        const bottom = Math.max(b.y + b.height, bf.y + bf.height);
        expect(Math.abs(bottom - T.oy)).toBeLessThan(0.05 * T.h);
      }
    }
  });

  it('draws the front view of 60 random variants of every person for the reveal', () => {
    for (const kind of PEOPLE) {
      for (let i = 0; i < 60; i++) {
        const look: Look = looks.randomLook(rand, kind);
        const scale = looks.BASE_HEIGHT[kind] * look.build.height;
        const b = bounds(draw.humanFrontPath(look, T, 0.5));
        expect(b.height).toBeGreaterThan(0.9 * T.h * scale);
        expect(b.height).toBeLessThan(1.25 * T.h * scale);
        expect(b.width).toBeGreaterThan(0.2 * T.h * scale);
        expect(b.y).toBeGreaterThanOrEqual(T.oy - T.h * looks.silhouetteTop(look) - 0.03 * T.h);
      }
    }
  });

  it('draws 40 random dogs and cats walking and sitting', () => {
    for (const kind of PETS) {
      for (let i = 0; i < 40; i++) {
        const look: PetLook = looks.randomPetLook(rand, kind);
        const { main, far } = draw.petWalkPaths(look, i / 40, T);
        const b = bounds(main);
        expect(b.height).toBeGreaterThan(0.08 * T.h);
        expect(b.height).toBeLessThan(0.6 * T.h);
        expect(b.y + b.height).toBeLessThanOrEqual(T.oy + 0.01 * T.h);
        expect(bounds(far).width).toBeGreaterThan(0);
        const s = bounds(draw.petSitPath(look, T));
        expect(s.height).toBeGreaterThan(0.08 * T.h);
        expect(s.height).toBeLessThan(0.6 * T.h);
      }
    }
  });

  it('gives at least 30 visibly different silhouettes out of 60 random variants of each person', () => {
    const w = 64;
    const h = 128;
    const t = { ox: 32, oy: 124, h: 110, facing: 1 };
    for (const kind of PEOPLE) {
      const side: Uint8Array[] = [];
      const front: Uint8Array[] = [];
      for (let i = 0; i < 60; i++) {
        const look: Look = looks.randomLook(rand, kind);
        const pose = rig.standPose(style.rigStyle(look, true), 0);
        side.push(mask([draw.humanMainPath(look, pose, t), draw.humanFarPath(look, pose, t)], w, h));
        front.push(mask([draw.humanFrontPath(look, t, 0.5)], w, h));
      }
      expect(distinct(side, 0.08)).toBeGreaterThanOrEqual(30);
      expect(distinct(front, 0.08)).toBeGreaterThanOrEqual(30);
    }
  });

  it('gives at least 15 visibly different pets of each kind out of 40', () => {
    const w = 96;
    const h = 64;
    const t = { ox: 48, oy: 62, h: 160, facing: 1 };
    for (const kind of PETS) {
      const walking: Uint8Array[] = [];
      for (let i = 0; i < 40; i++) {
        const look: PetLook = looks.randomPetLook(rand, kind);
        const p = draw.petWalkPaths(look, 0.1, t);
        walking.push(mask([p.main, p.far], w, h));
      }
      expect(distinct(walking, 0.08)).toBeGreaterThanOrEqual(15);
    }
  });
});
