import { Group, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { Layout } from '../experience/layout';
import { mulberry32, poissonDisk } from '../procedural';
import { palette } from '../theme/palette';

/**
 * The night between the worlds, revealed behind the shrinking frame and behind the reveal: an
 * indigo-to-violet sky, two layers of stars that twinkle out of phase, and a warm glow along the
 * ground where the candles of the altar would be.
 */
export function NightLayer({ layout, time }: { layout: Layout; time: SharedValue<number> }) {
  const { width: W, height: H } = layout.screen;
  const stars = useMemo(() => {
    const rng = mulberry32(77);
    const points = poissonDisk({ width: W, height: H * 0.75, rMin: Math.max(18, W * 0.025), rng });
    const a = Skia.PathBuilder.Make();
    const b = Skia.PathBuilder.Make();
    points.forEach((p, i) => {
      const r = 0.6 + rng() * 1.4;
      (i % 2 === 0 ? a : b).addCircle(p.x, p.y, r);
    });
    return { a: a.build(), b: b.build() };
  }, [W, H]);
  const twinkleA = useDerivedValue(() => 0.45 + 0.35 * Math.sin(time.value * 0.9));
  const twinkleB = useDerivedValue(() => 0.45 + 0.35 * Math.sin(time.value * 0.9 + Math.PI));
  return (
    <Group>
      <Rect x={0} y={0} width={W} height={H}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, H)}
          colors={[palette.night, palette.deepViolet, '#3A2152']}
          positions={[0, 0.7, 1]}
        />
      </Rect>
      <Path path={stars.a} color={palette.warmWhite} opacity={twinkleA} />
      <Path path={stars.b} color={palette.candle} opacity={twinkleB} />
      <Rect x={0} y={H * 0.78} width={W} height={H * 0.22}>
        <LinearGradient
          start={vec(0, H * 0.78)}
          end={vec(0, H)}
          colors={['rgba(245, 138, 7, 0)', 'rgba(245, 138, 7, 0.16)']}
        />
      </Rect>
    </Group>
  );
}
