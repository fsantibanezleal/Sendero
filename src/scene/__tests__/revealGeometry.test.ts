import { coverRect } from '../revealGeometry';

const W = 2560;
const H = 1600;

describe('camera geometry', () => {
  it('covers the screen with a camera image of any shape, centred', () => {
    for (const [iw, ih] of [
      [1280, 720],
      [720, 1280],
      [640, 480],
    ]) {
      const r = coverRect(iw, ih, W, H);
      expect(r.width).toBeGreaterThanOrEqual(W - 1e-6);
      expect(r.height).toBeGreaterThanOrEqual(H - 1e-6);
      expect(r.x + r.width / 2).toBeCloseTo(W / 2, 6);
      expect(r.y + r.height / 2).toBeCloseTo(H / 2, 6);
      expect(r.width / r.height).toBeCloseTo(iw / ih, 6);
    }
    expect(coverRect(0, 0, W, H)).toEqual({ x: 0, y: 0, width: W, height: H });
  });
});
