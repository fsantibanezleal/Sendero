import { Atlas, type SkImage, type SkRect, useRSXformBuffer } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue } from 'react-native-reanimated';

import { mulberry32 } from '../procedural';
import { CELL } from '../flowers/atlas';

/**
 * Small lights drifting up around a figure (research-visuals D5: drifting particles). Each one rises
 * through its own cycle and grows then shrinks, so no per-sprite alpha is needed. Additive.
 */
export function Sparkles({
  image,
  sprite,
  count,
  seed,
  cx,
  cy,
  spread,
  size,
  time,
  strength,
}: {
  image: SkImage;
  sprite: SkRect;
  count: number;
  seed: number;
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  /** Horizontal spread and rise height, pixels. */
  spread: SharedValue<number>;
  /** Sprite diameter at full size, pixels. */
  size: SharedValue<number>;
  time: SharedValue<number>;
  /** 0 hides every sparkle, 1 full size. */
  strength: SharedValue<number>;
}) {
  const params = useMemo(() => {
    const rng = mulberry32(seed);
    const ox: number[] = [];
    const phase: number[] = [];
    const speed: number[] = [];
    const scale: number[] = [];
    for (let i = 0; i < count; i++) {
      ox.push(rng() * 2 - 1);
      phase.push(rng());
      speed.push(0.12 + rng() * 0.18);
      scale.push(0.4 + rng() * 0.6);
    }
    return { ox, phase, speed, scale };
  }, [count, seed]);
  const sprites = useMemo(() => new Array(count).fill(sprite), [count, sprite]);
  const transforms = useRSXformBuffer(count, (val, i) => {
    'worklet';
    const frac = (time.value * params.speed[i] + params.phase[i]) % 1;
    const s = (size.value / CELL) * params.scale[i] * Math.sin(Math.PI * frac) * strength.value;
    const x = cx.value + params.ox[i] * spread.value * (0.6 + 0.4 * frac);
    const y = cy.value - frac * spread.value * 1.4;
    val.set(s, 0, x - (s * CELL) / 2, y - (s * CELL) / 2);
  });
  return <Atlas image={image} sprites={sprites} transforms={transforms} blendMode="plus" />;
}
