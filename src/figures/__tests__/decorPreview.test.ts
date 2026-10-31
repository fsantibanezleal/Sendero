/**
 * Preview sheet of the dressed drawings, for design review, drawn with the real Skia engine (CanvasKit) into a PNG.
 * Runs only when SENDERO_DECOR_PREVIEW names the output file; SENDERO_DECOR_KINDS narrows it to some archetypes:
 *
 *   SENDERO_DECOR_PREVIEW=<temp root>/sendero/decor.png npx jest src/figures/__tests__/decorPreview.test.ts
 */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@shopify/react-native-skia', () =>
  require('@shopify/react-native-skia/lib/commonjs/mock').Mock((globalThis as unknown as { CanvasKit: unknown }).CanvasKit),
);

const out = process.env.SENDERO_DECOR_PREVIEW;

(out ? it : it.skip)(
  'writes the dressed sheet',
  async () => {
    const init = require('canvaskit-wasm/bin/full/canvaskit');
    const CK = await init({});
    (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = CK;
    const { ART } = require('../artData');
    const { artPath } = require('../art');
    const { decoratedPicture } = require('../decor');
    const kinds = (process.env.SENDERO_DECOR_KINDS ?? 'abuela,abuelo,mujer,hombre,perro,gato').split(',');
    const list = ART.filter((a: { archetype: string }) => kinds.includes(a.archetype));
    const COLS = Number(process.env.SENDERO_DECOR_COLS ?? '7');
    const CELL = Number(process.env.SENDERO_DECOR_CELL ?? '270');
    const rows = Math.ceil(list.length / COLS);
    const surface = CK.MakeSurface(COLS * CELL, rows * CELL);
    const canvas = surface.getCanvas();
    canvas.clear(CK.Color(28, 22, 58, 1));
    const ink = new CK.Paint();
    ink.setColor(CK.Color(255, 236, 200, 1));
    ink.setAntiAlias(true);
    list.forEach((a: { id: string }, i: number) => {
      const h = CELL * 0.82;
      canvas.save();
      canvas.translate((i % COLS) * CELL + CELL / 2, Math.floor(i / COLS) * CELL + CELL * 0.95);
      canvas.scale(h, h);
      const r = artPath(a.id).ref;
      canvas.drawPath(r.snapshot?.() ?? r.detach?.() ?? r, ink);
      canvas.drawPicture(decoratedPicture(a.id, 11 + i).ref);
      canvas.restore();
    });
    const png = surface.makeImageSnapshot().encodeToBytes();
    require('fs').writeFileSync(out, png);
  },
  120000,
);
