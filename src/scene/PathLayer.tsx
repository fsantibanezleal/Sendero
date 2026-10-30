import { Atlas, Blur, Group, Path, Skia, useRSXformBuffer } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { TIMELINE, windowProgress } from '../experience/timeline';
import { CELL, type FlowerAtlas } from '../flowers/atlas';
import type { PetalPathData } from '../path/petalPath';
import { easeInOutSine, easeOutBack } from '../procedural';
import { palette } from '../theme/palette';

/** Arc length over which a petal grows from nothing once the drawing head passes it, pixels. */
const POP_DISTANCE = 60;

/**
 * The petal path drawing itself from the far corner to the frame (research-visuals D2): a soft
 * glowing guide trimmed to the drawing head, and the Poisson-scattered petals popping in behind the
 * head, far ones small and near ones large. Visible from the path phase to the end of the arrival.
 */
export function PathLayer({
  data,
  atlas,
  clock,
  height,
}: {
  data: PetalPathData;
  atlas: FlowerAtlas;
  clock: SharedValue<number>;
  height: number;
}) {
  const guide = useMemo(() => {
    const p = Skia.Path.Make();
    data.polyline.forEach((pt, i) => (i === 0 ? p.moveTo(pt.x, pt.y) : p.lineTo(pt.x, pt.y)));
    return p;
  }, [data]);

  const n = data.petals.length;
  const arrays = useMemo(
    () => ({
      s: data.petals.map((p) => p.s),
      x: data.petals.map((p) => p.x),
      y: data.petals.map((p) => p.y),
      r: data.petals.map((p) => p.rotation),
      size: data.petals.map((p) => p.size),
    }),
    [data],
  );
  const sprites = useMemo(() => data.petals.map((p) => atlas.petals[p.variant % atlas.petals.length]), [data, atlas]);
  const total = data.table.total;

  const head = useDerivedValue(() => {
    const t = clock.value;
    if (t < 0) return 0;
    return easeInOutSine(windowProgress(t, TIMELINE.path)) * total;
  });
  const visible = useDerivedValue(() => {
    const t = clock.value;
    if (t < TIMELINE.path.start || t >= TIMELINE.reveal.start) return 0;
    return 1;
  });
  const guideEnd = useDerivedValue(() => (total > 0 ? head.value / total : 0));

  const transforms = useRSXformBuffer(n, (val, i) => {
    'worklet';
    const grow = (head.value - arrays.s[i]) / POP_DISTANCE;
    const g = grow <= 0 ? 0 : grow >= 1 ? 1 : easeOutBack(grow);
    const scale = ((arrays.size[i] / (CELL * 0.68)) * g) * visible.value;
    const c = Math.cos(arrays.r[i]) * scale;
    const s = Math.sin(arrays.r[i]) * scale;
    const half = CELL / 2;
    val.set(c, s, arrays.x[i] - (c * half - s * half), arrays.y[i] - (s * half + c * half));
  });

  return (
    <Group opacity={visible}>
      <Path path={guide} style="stroke" strokeWidth={height * 0.03} strokeCap="round" color={palette.marigold} opacity={0.32} start={0} end={guideEnd} blendMode="plus">
        <Blur blur={height * 0.02} />
      </Path>
      <Path path={guide} style="stroke" strokeWidth={height * 0.006} strokeCap="round" color={palette.candle} opacity={0.5} start={0} end={guideEnd} />
      <Atlas image={atlas.image} sprites={sprites} transforms={transforms} />
    </Group>
  );
}
