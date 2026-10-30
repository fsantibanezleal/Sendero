import { Blur, Group, LinearGradient, Path, type SkPath, vec } from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { palette } from '../theme/palette';

/**
 * The soft, luminous look of a departed silhouette (research-visuals D5): a wide warm halo and a
 * tight halo added with the plus blend, a body filled with a vertical gradient that fades out at
 * the feet so the figure seems to float, and the far-side limbs dimmer behind it.
 */
export function Ghost({
  main,
  far,
  opacity,
  top,
  bottom,
  glow,
}: {
  main: SharedValue<SkPath>;
  far: SharedValue<SkPath>;
  opacity: SharedValue<number>;
  /** Screen y of the top of the head and of the feet, for the body gradient. */
  top: SharedValue<number>;
  bottom: SharedValue<number>;
  /** Blur radius of the wide halo, pixels. */
  glow: SharedValue<number>;
}) {
  const start = useDerivedValue(() => vec(0, top.value));
  const end = useDerivedValue(() => vec(0, bottom.value));
  const wide = useDerivedValue(() => glow.value);
  const tight = useDerivedValue(() => glow.value * 0.3);
  const farBlur = useDerivedValue(() => glow.value * 0.18);
  return (
    <Group opacity={opacity}>
      <Path path={far} color={palette.candle} opacity={0.4}>
        <Blur blur={farBlur} />
      </Path>
      <Path path={main} color={palette.marigoldLight} opacity={0.34} blendMode="plus">
        <Blur blur={wide} />
      </Path>
      <Path path={main} color="#FFE7B0" opacity={0.42} blendMode="plus">
        <Blur blur={tight} />
      </Path>
      <Path path={main}>
        <LinearGradient
          start={start}
          end={end}
          colors={['rgba(255, 244, 224, 0.82)', 'rgba(255, 213, 138, 0.55)', 'rgba(255, 213, 138, 0)']}
          positions={[0, 0.72, 1]}
        />
      </Path>
    </Group>
  );
}
