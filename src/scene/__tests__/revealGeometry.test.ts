import { coverInto, coverRect, PERSON_SCALE, personRect, PORTRAIT, portraitRect } from '../revealGeometry';

const W = 2560;
const H = 1600;
/** Centre of the reveal silhouette, as a fraction of the width (RevealLayer). */
const GHOST_X = 0.565;

describe('reveal geometry', () => {
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

  it('shrinks the visitor about the bottom centre', () => {
    const c = coverRect(1280, 720, W, H);
    const r = personRect(c, W, H, PERSON_SCALE);
    expect(r.width).toBeCloseTo(c.width * PERSON_SCALE, 6);
    expect(r.x + r.width / 2).toBeCloseTo(W / 2, 6);
    expect(r.y + r.height).toBeCloseTo(H + (c.y + c.height - H) * PERSON_SCALE, 6);
  });

  it('places the no-mask portrait inside the screen, left of the silhouette, which stays visible beside it', () => {
    const p = portraitRect(W, H);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
    expect(p.y + p.height).toBeCloseTo(H * (1 - PORTRAIT.bottom), 6);
    expect(p.x + p.width).toBeLessThan(GHOST_X * W);
    expect(p.width * p.height).toBeLessThan(0.3 * W * H);
  });

  it('crops the camera image to fill the portrait', () => {
    const p = portraitRect(W, H);
    const c = coverInto(1280, 720, p);
    expect(c.x).toBeLessThanOrEqual(p.x + 1e-6);
    expect(c.y).toBeLessThanOrEqual(p.y + 1e-6);
    expect(c.x + c.width).toBeGreaterThanOrEqual(p.x + p.width - 1e-6);
    expect(c.y + c.height).toBeGreaterThanOrEqual(p.y + p.height - 1e-6);
    expect(c.x + c.width / 2).toBeCloseTo(p.x + p.width / 2, 6);
  });
});
