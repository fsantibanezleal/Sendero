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
import { FarewellLayer } from './FarewellLayer';
import { FiguresLayer } from './FiguresLayer';
import { FrameLayer } from './FrameLayer';
import { Gate } from './Gate';
import { LayerBoundary } from './LayerBoundary';
import { NightLayer } from './NightLayer';
import { PathLayer } from './PathLayer';

/**
 * The single canvas of the experience (docs/architecture.md). Draw order, back to front:
 * the night between the worlds, the petal path, the framed camera (which also holds the reveal), the
 * silhouettes, and the bloom of the arrival.
 *
 * `visit` is the visit the next touch starts: its path and figures are mounted while the altar waits
 * and gated off (Gate), so the touch shows them without waiting for a React render.
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
  visit: Visit;
}) {
  const { width: W, height: H } = layout.screen;
  const path = useMemo(
    () =>
      buildPetalPath({
        start: layout.pathStart,
        end: layout.pathEnd,
        width: W,
        height: H,
        seed: visit.pathSeed,
        petalVariants: atlas.petals.length,
      }),
    [visit, layout, W, H, atlas.petals.length],
  );
  const pathOn = useDerivedValue(() => clock.value >= TIMELINE.path.start && clock.value < TIMELINE.reveal.start);
  const figuresOn = useDerivedValue(() => clock.value >= TIMELINE.family.start && clock.value < TIMELINE.reveal.start);
  const farewellOn = useDerivedValue(() => clock.value >= TIMELINE.reveal.start - 0.3);
  return (
    <Canvas style={styles.fill}>
      <NightLayer layout={layout} time={time} />
      <Gate on={pathOn} width={W} height={H}>
        <LayerBoundary name="path" resetKey={visit.id}>
          <PathLayer data={path} atlas={atlas} clock={clock} height={H} />
        </LayerBoundary>
      </Gate>
      <FrameLayer layout={layout} feed={feed} atlas={atlas} clock={clock} time={time} />
      <Gate on={figuresOn} width={W} height={H}>
        <LayerBoundary name="figures" resetKey={visit.id}>
          <FiguresLayer visit={visit} layout={layout} path={path} atlas={atlas} clock={clock} time={time} />
        </LayerBoundary>
      </Gate>
      <Gate on={farewellOn} width={W} height={H}>
        <LayerBoundary name="farewell" resetKey={visit.id}>
          <FarewellLayer visit={visit} layout={layout} atlas={atlas} clock={clock} time={time} />
        </LayerBoundary>
      </Gate>
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
  const on = useDerivedValue(() => p.value > 0 && p.value < 1);
  return (
    <Gate on={on} width={screen.width} height={screen.height}>
      <Group opacity={opacity} blendMode="plus">
        <Circle c={c} r={r}>
          <RadialGradient c={c} r={screen.width} colors={[palette.warmWhite, 'rgba(255, 194, 14, 0.35)', 'rgba(255, 194, 14, 0)']} positions={[0, 0.3, 0.75]} />
        </Circle>
      </Group>
    </Gate>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
