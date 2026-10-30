import { Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { CameraFeed } from '../camera/useCameraFeed';
import type { Layout } from '../experience/layout';
import type { Visit } from '../experience/useExperience';
import { TIMELINE, windowProgress } from '../experience/timeline';
import type { FlowerAtlas } from '../flowers/atlas';
import { buildPetalPath } from '../path/petalPath';
import { palette } from '../theme/palette';
import { FiguresLayer } from './FiguresLayer';
import { FrameLayer } from './FrameLayer';
import { NightLayer } from './NightLayer';
import { PathLayer } from './PathLayer';

/**
 * The single canvas of the experience (docs/architecture.md). Draw order, back to front:
 * the night between the worlds, the petal path, the gathered silhouettes, the framed camera (which
 * also holds the reveal), the walking silhouette, and the bloom of the arrival.
 */
export function Scene({
  layout,
  feed,
  atlas,
  clock,
  time,
  visit,
}: {
  layout: Layout;
  feed: CameraFeed;
  atlas: FlowerAtlas;
  clock: SharedValue<number>;
  time: SharedValue<number>;
  visit: Visit | null;
}) {
  const path = useMemo(
    () =>
      visit == null
        ? null
        : buildPetalPath({
            start: layout.pathStart,
            end: layout.pathEnd,
            width: layout.screen.width,
            height: layout.screen.height,
            seed: visit.pathSeed,
            petalVariants: atlas.petals.length,
          }),
    [visit, layout, atlas.petals.length],
  );
  return (
    <Canvas style={styles.fill}>
      <NightLayer layout={layout} time={time} />
      {visit != null && path != null ? <PathLayer data={path} atlas={atlas} clock={clock} height={layout.screen.height} /> : null}
      <FrameLayer layout={layout} feed={feed} atlas={atlas} clock={clock} time={time} visit={visit} />
      {visit != null && path != null ? (
        <FiguresLayer visit={visit} layout={layout} path={path} atlas={atlas} clock={clock} time={time} />
      ) : null}
      <Bloom layout={layout} clock={clock} />
    </Canvas>
  );
}

/** The warm light of the arrival, swelling from the frame as it returns to full screen. */
function Bloom({ layout, clock }: { layout: Layout; clock: SharedValue<number> }) {
  const { mini, screen } = layout;
  const c = vec(mini.x + mini.width / 2, mini.y + mini.height / 2);
  const p = useDerivedValue(() => windowProgress(clock.value, { start: TIMELINE.arrive.start - 0.4, end: TIMELINE.reveal.start + 0.6 }));
  const r = useDerivedValue(() => mini.width * 0.3 + p.value * screen.width * 0.9);
  const opacity = useDerivedValue(() => Math.sin(Math.PI * p.value) * 0.75);
  return (
    <Group opacity={opacity} blendMode="plus">
      <Circle c={c} r={r}>
        <RadialGradient c={c} r={screen.width} colors={[palette.warmWhite, 'rgba(255, 194, 14, 0.35)', 'rgba(255, 194, 14, 0)']} positions={[0, 0.3, 0.75]} />
      </Circle>
    </Group>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
