/**
 * Procedural papel picado (research-visuals D3 item 6): a row of tissue-paper banners hanging from
 * a string. Each banner is one even-odd path, so the cut motifs are holes: a scalloped lower edge,
 * a border of small diamonds and a central flower, mirrored left to right as if the paper had been
 * folded before cutting. No skulls (research-culture D3 rule 1: calm, never grotesque).
 */
import { FillType, Skia, type SkPath } from '@shopify/react-native-skia';

import { palette } from '../theme/palette';

export const BANNER_COLORS = [palette.rosaMexicano, palette.marigold, palette.softViolet, palette.marigoldLight, '#2BB3A7'];

export interface Banner {
  /** Top-left corner and size, pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  /** Phase of the sway, radians. */
  phase: number;
  path: SkPath;
}

function addCircleHole(path: SkPath, cx: number, cy: number, r: number) {
  path.addCircle(cx, cy, r);
}

function addDiamond(path: SkPath, cx: number, cy: number, rx: number, ry: number) {
  path.moveTo(cx, cy - ry);
  path.lineTo(cx + rx, cy);
  path.lineTo(cx, cy + ry);
  path.lineTo(cx - rx, cy);
  path.close();
}

/** The outline and holes of one banner, in its own frame (top-left at the origin). */
export function bannerPath(w: number, h: number): SkPath {
  const path = Skia.Path.Make();
  path.setFillType(FillType.EvenOdd);
  // Outline with a scalloped lower edge.
  const scallops = 7;
  const body = h * 0.86;
  path.moveTo(0, 0);
  path.lineTo(w, 0);
  path.lineTo(w, body);
  for (let i = scallops; i > 0; i--) {
    const x0 = (i / scallops) * w;
    const x1 = ((i - 1) / scallops) * w;
    path.quadTo((x0 + x1) / 2, h, x1, body);
  }
  path.close();

  // Border of small diamonds, mirrored.
  const border = Math.max(3, Math.round(w / (h * 0.16)));
  for (let i = 0; i < border; i++) {
    const cx = ((i + 0.5) / border) * w;
    addDiamond(path, cx, h * 0.11, (w / border) * 0.22, h * 0.035);
    addCircleHole(path, cx, body - h * 0.09, Math.min(w / border, h) * 0.12);
  }

  // Central flower: eight petals around a round heart, plus four leaves.
  const cx = w / 2;
  const cy = h * 0.47;
  const R = Math.min(w, h) * 0.22;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const px = cx + Math.cos(a) * R * 0.62;
    const py = cy + Math.sin(a) * R * 0.62;
    const ex = Math.cos(a) * R * 0.34;
    const ey = Math.sin(a) * R * 0.34;
    const ox = -Math.sin(a) * R * 0.16;
    const oy = Math.cos(a) * R * 0.16;
    path.moveTo(px - ex, py - ey);
    path.quadTo(px + ox, py + oy, px + ex, py + ey);
    path.quadTo(px - ox, py - oy, px - ex, py - ey);
    path.close();
  }
  addCircleHole(path, cx, cy, R * 0.18);
  for (const side of [-1, 1]) {
    addDiamond(path, cx + side * R * 1.3, cy + R * 0.55, R * 0.22, R * 0.12);
    addDiamond(path, cx + side * R * 1.3, cy - R * 0.55, R * 0.22, R * 0.12);
  }
  return path;
}

/** A string of banners across a width, starting at y. */
export function bannerRow(width: number, y: number, bannerWidth: number, seed: number): Banner[] {
  const n = Math.max(3, Math.floor(width / (bannerWidth * 1.12)));
  const gap = (width - n * bannerWidth) / (n + 1);
  const h = bannerWidth * 1.18;
  const shape = bannerPath(bannerWidth, h);
  const banners: Banner[] = [];
  for (let i = 0; i < n; i++) {
    banners.push({
      x: gap + i * (bannerWidth + gap),
      y,
      width: bannerWidth,
      height: h,
      color: BANNER_COLORS[(i + seed) % BANNER_COLORS.length],
      phase: i * 1.7 + seed,
      path: shape,
    });
  }
  return banners;
}
