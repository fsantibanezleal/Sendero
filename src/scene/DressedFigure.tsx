import { Group, Image, type Transforms3d } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import type { Dressed } from '../figures/decor';

/** A dressed figure placed by a transform that maps figure units to the screen. */
export function DressedFigure({
  figure,
  transform,
  opacity,
}: {
  figure: Dressed | null;
  transform: Transforms3d | SharedValue<Transforms3d>;
  opacity?: SharedValue<number>;
}) {
  if (figure == null) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <Image image={figure.image} x={figure.x} y={figure.y} width={figure.width} height={figure.height} fit="fill" />
    </Group>
  );
}
