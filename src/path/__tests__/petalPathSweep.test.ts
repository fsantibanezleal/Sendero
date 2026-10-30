import { computeLayout } from '../../experience/layout';
import { buildPetalPath } from '../petalPath';

describe('petal path on real tablet sizes, many seeds', () => {
  for (const [w, h] of [
    [2560, 1600],
    [1600, 2560],
    [1280, 800],
    [2000, 1200],
  ]) {
    it(`builds a usable path for ${w} x ${h}`, () => {
      const layout = computeLayout(w, h);
      for (let seed = 0; seed < 300; seed++) {
        const s = Math.floor(((seed * 2654435761) >>> 0) % 2147483647);
        const data = buildPetalPath({ start: layout.pathStart, end: layout.pathEnd, width: w, height: h, seed: s, petalVariants: 4 });
        expect(data.table.total).toBeGreaterThan(0);
        expect(data.petals.length).toBeGreaterThan(60);
        expect(data.petals.length).toBeLessThan(4000);
        for (const p of data.polyline) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
      }
    });
  }
});
