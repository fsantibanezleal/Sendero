/**
 * Preview sheet of the figures, for design review: random variants of the four people walking and
 * standing in front view, and of the dog and the cat walking and sitting, drawn with the real Skia
 * engine (CanvasKit) into a PNG. Runs only when SENDERO_PREVIEW names the output file:
 *
 *   SENDERO_PREVIEW=<temp root>/sendero/figures.png npx jest src/figures/__tests__/preview.test.ts
 *
 * SENDERO_PREVIEW_SEED picks the variants, SENDERO_PREVIEW_ZOOM=2 draws four larger columns.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@shopify/react-native-skia', () =>
  require('@shopify/react-native-skia/lib/commonjs/mock').Mock((globalThis as unknown as { CanvasKit: unknown }).CanvasKit),
);

const out = process.env.SENDERO_PREVIEW;
const seed = Number(process.env.SENDERO_PREVIEW_SEED ?? '1');

(out ? it : it.skip)(
  'writes the preview sheet',
  async () => {
    const init = require('canvaskit-wasm/bin/full/canvaskit');
    const CK = await init({});
    (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = CK;
    const draw = require('../draw');
    const rig = require('../rig');
    const gait = require('../gait');
    const looks = require('../looks');
    const { mulberry32 } = require('../../procedural');
    const { rigStyle } = require('../style');
    const rand = mulberry32(seed);
    const zoom = Number(process.env.SENDERO_PREVIEW_ZOOM ?? '1');
    const COLS = zoom > 1 ? 4 : 8;
    const CELL_W = 240 * zoom;
    const W = COLS * CELL_W;
    const ROW_H = 300 * zoom;
    const kinds = ['abuela', 'abuelo', 'mujer', 'hombre'];
    const H = ROW_H * (kinds.length * 2 + 2);
    const surface = CK.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    canvas.clear(CK.Color(28, 22, 58, 1));
    const ink = new CK.Paint();
    ink.setColor(CK.Color(246, 236, 216, 1));
    ink.setAntiAlias(true);
    const dim = new CK.Paint();
    dim.setColor(CK.Color(170, 160, 150, 1));
    dim.setAntiAlias(true);
    const toPath = (p: { ref: { snapshot?: () => unknown; detach?: () => unknown } }) => p.ref.snapshot?.() ?? p.ref.detach?.() ?? p.ref;
    let row = 0;
    for (const kind of kinds) {
      const curves = gait.gaitCurves(kind.startsWith('abu') ? 'older' : 'young');
      for (let c = 0; c < COLS; c++) {
        const look = looks.randomLook(rand, kind);
        const pose = rig.walkPose(curves, 0.15 + c * 0.1, rigStyle(look, false));
        const t = { ox: c * CELL_W + CELL_W * 0.45, oy: row * ROW_H + ROW_H - 18 * zoom, h: 255 * zoom, facing: 1 };
        canvas.drawPath(toPath(draw.humanFarPath(look, pose, t)), dim);
        canvas.drawPath(toPath(draw.humanMainPath(look, pose, t)), ink);
        const f = { ox: c * CELL_W + CELL_W * 0.5, oy: (row + 1) * ROW_H + ROW_H - 18 * zoom, h: 255 * zoom, facing: 1 };
        canvas.drawPath(toPath(draw.humanFrontPath(look, f, 0.5)), ink);
      }
      row += 2;
    }
    for (const kind of ['perro', 'gato']) {
      for (let c = 0; c < COLS; c++) {
        const look = looks.randomPetLook(rand, kind);
        const t = { ox: c * CELL_W + CELL_W * 0.5, oy: row * ROW_H + ROW_H * 0.55, h: 360 * zoom, facing: 1 };
        const p = draw.petWalkPaths(look, 0.1 + c * 0.11, t);
        canvas.drawPath(toPath(p.far), dim);
        canvas.drawPath(toPath(p.main), ink);
        const s = { ox: c * CELL_W + CELL_W * 0.5, oy: row * ROW_H + ROW_H - 10 * zoom, h: 360 * zoom, facing: 1 };
        canvas.drawPath(toPath(draw.petSitPath(look, s)), ink);
      }
      row += 1;
    }
    const fs = require('fs');
    fs.writeFileSync(out as string, surface.makeImageSnapshot().encodeToBytes());
  },
  60000,
);

/**
 * The farewell composition for design review: the frame on the stage and random silhouettes beside it
 * with the hand resting on the garland, and a pet. SENDERO_PREVIEW_FAREWELL names the PNG.
 */
const farewellOut = process.env.SENDERO_PREVIEW_FAREWELL;
(farewellOut ? it : it.skip)(
  'writes the farewell sheet',
  async () => {
    const init = require('canvaskit-wasm/bin/full/canvaskit');
    const CK = await init({});
    (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = CK;
    const draw = require('../draw');
    const looks = require('../looks');
    const { computeLayout } = require('../../experience/layout');
    const { mulberry32 } = require('../../procedural');
    const rand = mulberry32(seed);
    const W = 2560;
    const H = 1600;
    const layout = computeLayout(W, H);
    const surface = CK.MakeSurface(W * 2, H * 2);
    const canvas = surface.getCanvas();
    canvas.clear(CK.Color(28, 22, 58, 1));
    const toPath = (p: { ref: { snapshot?: () => unknown; detach?: () => unknown } }) => p.ref.snapshot?.() ?? p.ref.detach?.() ?? p.ref;
    const kinds = ['abuela', 'abuelo', 'mujer', 'hombre'];
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * W;
      const oy = Math.floor(q / 2) * H;
      const { stage, stageScale, band, companion, petSpot } = layout;
      const frame = new CK.Paint();
      frame.setColor(CK.Color(235, 140, 30, 1));
      canvas.drawRect(CK.XYWHRect(ox + stage.x, oy + stage.y, stage.width, stage.height), frame);
      const cam = new CK.Paint();
      cam.setColor(CK.Color(90, 110, 130, 1));
      const inset = band * stageScale;
      canvas.drawRect(CK.XYWHRect(ox + stage.x + inset, oy + stage.y + inset, stage.width - 2 * inset, stage.height - 2 * inset), cam);
      const look = looks.randomLook(rand, kinds[q]);
      const ghostH = Math.min(companion.height, (companion.ground - 0.1 * H) / looks.silhouetteTop(look));
      const ink = new CK.Paint();
      ink.setColor(CK.Color(246, 236, 216, 1));
      ink.setAntiAlias(true);
      const rest = { x: ox + stage.x + band * stageScale * 0.35, y: oy + stage.y + stage.height * 0.66 };
      canvas.drawPath(toPath(draw.humanFrontPath(look, { ox: ox + companion.x, oy: oy + companion.ground, h: ghostH, facing: 1 }, 0.5, rest)), ink);
      const pet = looks.randomPetLook(rand, q % 2 === 0 ? 'perro' : 'gato');
      canvas.drawPath(toPath(draw.petSitPath(pet, { ox: ox + petSpot.x, oy: oy + petSpot.ground, h: ghostH, facing: 1 })), ink);
    }
    require('fs').writeFileSync(farewellOut as string, surface.makeImageSnapshot().encodeToBytes());
  },
  60000,
);
