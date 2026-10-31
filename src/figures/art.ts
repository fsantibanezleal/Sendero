/**
 * The silhouette drawings (public domain, CC0 or CC BY art; licences in ASSETS.md), normalized by
 * `pipeline/silhouettes/build.py`: each figure stands with its feet at y = 0, is 1 tall (the top at y = -1,
 * y down), is centred at x = 0 and faces right. A drawing can have several filled parts; they are united
 * once into one Skia path, then placed on screen with a transform every frame (a cheap copy).
 */
import { FillType, PathOp, Skia, type SkPath } from '@shopify/react-native-skia';

import { artById } from './artData';

export type { ArtEntry, ArtView } from './artData';
export { ART, artById, artOf } from './artData';

const paths = new Map<string, SkPath>();

/** The drawing's parts united into one path (cached). Runs on the JS thread. */
export function artPath(id: string): SkPath {
  const cached = paths.get(id);
  if (cached != null) return cached;
  const entry = artById(id);
  let acc: SkPath | null = null;
  for (const part of entry?.parts ?? []) {
    let p = Skia.Path.MakeFromSVGString(part.d);
    if (p == null) continue;
    if (part.evenodd) {
      const b = Skia.PathBuilder.MakeFromPath(p);
      b.setFillType(FillType.EvenOdd);
      p = b.build();
    }
    acc = acc == null ? p : (Skia.Path.MakeFromOp(acc, p, PathOp.Union) ?? acc);
  }
  const result = acc ?? Skia.Path.Make();
  paths.set(id, result);
  return result;
}

/**
 * A drawing placed on screen: feet at (ox, oy), `h` pixels tall, facing +1 right or -1 left, tilted by
 * `tilt` radians about the feet (a gentle sway). Runs as a worklet.
 */
export function placeArt(base: SkPath, ox: number, oy: number, h: number, facing: number, tilt: number): SkPath {
  'worklet';
  const m = Skia.Matrix();
  m.translate(ox, oy);
  if (tilt !== 0) m.rotate(tilt);
  m.scale(facing * h, h);
  const b = Skia.PathBuilder.Make();
  b.addPath(base, m);
  return b.build();
}
