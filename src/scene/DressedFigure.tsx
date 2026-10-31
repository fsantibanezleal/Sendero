import { Circle, Group, Image, RadialGradient, type Transforms3d, vec } from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { Dressed } from '../figures/decor';

/** A dressed figure placed by a transform that maps figure units to the screen; its candle's light breathes. */
export function DressedFigure({
  figure,
  transform,
  opacity,
  time,
}: {
  figure: Dressed | null;
  transform: Transforms3d | SharedValue<Transforms3d>;
  opacity?: SharedValue<number>;
  time: SharedValue<number>;
}) {
  if (figure == null) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <Image image={figure.image} x={figure.x} y={figure.y} width={figure.width} height={figure.height} fit="fill" />
      {figure.flame != null ? <CandleLight x={figure.flame.x} y={figure.flame.y} time={time} /> : null}
    </Group>
  );
}

function CandleLight({ x, y, time }: { x: number; y: number; time: SharedValue<number> }) {
  const r = useDerivedValue(() => 0.09 + 0.012 * Math.sin(time.value * 7.1 + x * 40) + 0.008 * Math.sin(time.value * 11.3));
  const c = vec(x, y);
  return (
    <Circle cx={x} cy={y} r={r} blendMode="plus">
      <RadialGradient c={c} r={r} colors={['rgba(255, 214, 120, 0.75)', 'rgba(255, 170, 60, 0.22)', 'rgba(255, 170, 60, 0)']} />
    </Circle>
  );
}
