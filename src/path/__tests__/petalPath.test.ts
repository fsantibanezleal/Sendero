import { borderLength, borderPoint, garlandSprites } from '../../flowers/garland';
import { bandHalfWidth, buildPetalPath, petalSize } from '../petalPath';

const W = 1600;
const H = 1000;
const OPTIONS = { start: { x: 160, y: 160 }, end: { x: 1080, y: 820 }, width: W, height: H, seed: 42, petalVariants: 4 };

describe('petal path', () => {
  const data = buildPetalPath(OPTIONS);

  it('starts at the far corner and ends at the frame', () => {
    const first = data.polyline[0];
    const last = data.polyline[data.polyline.length - 1];
    expect(first.x).toBeCloseTo(160, 6);
    expect(first.y).toBeCloseTo(160, 6);
    expect(last.x).toBeCloseTo(1080, 6);
    expect(last.y).toBeCloseTo(820, 6);
  });

  it('curves: it is longer than the straight line, but not wildly', () => {
    const straight = Math.hypot(1080 - 160, 820 - 160);
    expect(data.table.total).toBeGreaterThan(straight * 1.05);
    expect(data.table.total).toBeLessThan(straight * 1.8);
  });

  it('stays on the screen', () => {
    for (const p of data.polyline) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(H);
    }
  });

  it('scatters many petals, ordered far to near, larger near the frame', () => {
    expect(data.petals.length).toBeGreaterThan(150);
    for (let i = 1; i < data.petals.length; i++) {
      expect(data.petals[i].z).toBeGreaterThanOrEqual(data.petals[i - 1].z);
    }
    const far = data.petals.filter((p) => p.z < 0.2);
    const near = data.petals.filter((p) => p.z > 0.8);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(near.map((p) => p.size))).toBeGreaterThan(2 * mean(far.map((p) => p.size)));
  });

  it('widens the band and grows the petals with depth', () => {
    expect(bandHalfWidth(1, H)).toBeGreaterThan(4 * bandHalfWidth(0, H));
    expect(petalSize(1, H)).toBeGreaterThan(3 * petalSize(0, H));
    expect(bandHalfWidth(2, H)).toBe(bandHalfWidth(1, H));
  });

  it('is deterministic for a seed and different for another', () => {
    const again = buildPetalPath(OPTIONS);
    expect(again.petals.length).toBe(data.petals.length);
    expect(again.petals[10]).toEqual(data.petals[10]);
    const other = buildPetalPath({ ...OPTIONS, seed: 7 });
    expect(other.control[3]).not.toEqual(data.control[3]);
  });
});

describe('garland', () => {
  const band = 110;

  it('walks the rounded border continuously', () => {
    const L = borderLength(W, H, band / 2, band);
    let prev = borderPoint(W, H, band / 2, band, 0);
    for (let i = 1; i <= 400; i++) {
      const p = borderPoint(W, H, band / 2, band, (i / 400) * L);
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan((L / 400) * 1.01 + 1e-6);
      expect(Math.hypot(p.nx, p.ny)).toBeCloseTo(1, 9);
      prev = p;
    }
  });

  it('keeps every sprite inside the band and scales with the perimeter', () => {
    const sprites = garlandSprites({ width: W, height: H, band, seed: 3, headVariants: 8, leafVariants: 2 });
    for (const s of sprites) {
      const edge = Math.min(s.x, W - s.x, s.y, H - s.y);
      expect(edge).toBeGreaterThan(-0.05 * band);
      expect(edge).toBeLessThan(1.2 * band);
    }
    const wide = garlandSprites({ width: 2 * W, height: H, band, seed: 3, headVariants: 8, leafVariants: 2 });
    const ratio = wide.length / sprites.length;
    const perimeterRatio = borderLength(2 * W, H, band / 2, band) / borderLength(W, H, band / 2, band);
    expect(ratio).toBeCloseTo(perimeterRatio, 1);
  });
});
