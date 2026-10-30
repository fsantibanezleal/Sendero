import { Circle, Group, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { Layout } from '../experience/layout';
import type { Visit } from '../experience/plan';
import { TIMELINE } from '../experience/timeline';
import type { FlowerAtlas } from '../flowers/atlas';
import { humanFrontPath, petSitPath, type ScreenTransform } from '../figures/draw';
import { silhouetteTop } from '../figures/looks';
import { mulberry32, smoothstep } from '../procedural';
import { palette } from '../theme/palette';
import { Ghost } from './Ghost';
import { Sparkles } from './Sparkles';

/**
 * The farewell (the owner's design of 2026-10-30): the frame with the visitor stands on the right
 * (the stage), and the soft silhouette of the person who walked the path stands beside it on the
 * left, facing the viewer, one hand resting on the frame's garland, never over the picture; their
 * pet, when one came, sits at their other side. Warm lights drift around them.
 */
export function FarewellLayer({
  visit,
  layout,
  atlas,
  clock,
  time,
}: {
  visit: Visit;
  layout: Layout;
  atlas: FlowerAtlas;
  clock: SharedValue<number>;
  time: SharedValue<number>;
}) {
  const { height: H } = layout.screen;
  const look = visit.people[visit.walker];
  const pet = visit.companion == null ? null : visit.pets[visit.companion];
  const { companion, petSpot, stage, stageScale, band } = layout;

  // As tall as a person beside the frame, with the head and any hat below the top of the screen.
  const ghostH = Math.min(companion.height, (companion.ground - 0.1 * H) / silhouetteTop(look));
  // The hand rests on the garland along the frame's left side, below the middle, the elbow bent.
  const rest = useMemo(
    () => ({ x: stage.x + band * stageScale * 0.35, y: stage.y + stage.height * 0.66 }),
    [stage.x, stage.y, stage.height, band, stageScale],
  );

  const bokeh = useMemo(() => {
    const rng = mulberry32(visit.id * 31 + 5);
    return new Array(8).fill(0).map(() => ({
      x: rng() * stage.x,
      y: H * (0.15 + rng() * 0.75),
      r: H * (0.04 + rng() * 0.08),
      phase: rng() * 6.28,
    }));
  }, [visit.id, stage.x, H]);

  const appear = useDerivedValue(() => {
    const t = clock.value;
    return smoothstep(TIMELINE.reveal.start - 0.3, TIMELINE.reveal.start + 1.4, t) * (1 - smoothstep(TIMELINE.return.start, TIMELINE.return.end - 0.3, t));
  });
  const empty = useMemo(() => Skia.Path.Make(), []);
  const ghostMain = useDerivedValue(() => {
    // Built only while shown (it breathes, so it is rebuilt every frame then).
    if (appear.value <= 0) return empty;
    const tf: ScreenTransform = { ox: companion.x, oy: companion.ground, h: ghostH, facing: 1 };
    const breath = 0.5 + 0.5 * Math.sin(time.value * 1.25);
    const person = humanFrontPath(look, tf, breath, rest);
    if (pet == null) return person;
    const pt: ScreenTransform = { ox: petSpot.x, oy: petSpot.ground, h: ghostH, facing: 1 };
    const both = Skia.PathBuilder.Make();
    both.addPath(person);
    both.addPath(petSitPath(pet, pt));
    return both.build();
  });
  const ghostFar = useDerivedValue(() => empty);
  const ghostOpacity = useDerivedValue(() => appear.value * (0.84 + 0.08 * Math.sin(time.value * 1.25)));
  const ghostTop = useDerivedValue(() => companion.ground - ghostH * silhouetteTop(look));
  const ghostBottom = useDerivedValue(() => companion.ground - ghostH * 0.1);
  const ghostGlow = useDerivedValue(() => H * 0.04 + (1 - appear.value) * H * 0.06);

  const sparkX = useDerivedValue(() => companion.x);
  const sparkY = useDerivedValue(() => companion.ground - ghostH * 0.55);
  const sparkSpread = useDerivedValue(() => ghostH * 0.35);
  const sparkSize = useDerivedValue(() => H * 0.025);

  return (
    <Group>
      {bokeh.map((b, i) => (
        <Bokeh key={i} x={b.x} y={b.y} r={b.r} phase={b.phase} time={time} strength={appear} />
      ))}
      <Ghost main={ghostMain} far={ghostFar} opacity={ghostOpacity} top={ghostTop} bottom={ghostBottom} glow={ghostGlow} />
      <Sparkles
        image={atlas.image}
        sprite={atlas.glow}
        count={32}
        seed={visit.id + 100}
        cx={sparkX}
        cy={sparkY}
        spread={sparkSpread}
        size={sparkSize}
        time={time}
        strength={appear}
      />
    </Group>
  );
}

function Bokeh({
  x,
  y,
  r,
  phase,
  time,
  strength,
}: {
  x: number;
  y: number;
  r: number;
  phase: number;
  time: SharedValue<number>;
  strength: SharedValue<number>;
}) {
  const opacity = useDerivedValue(() => strength.value * (0.22 + 0.12 * Math.sin(time.value * 0.5 + phase)));
  return (
    <Circle cx={x} cy={y} r={r} opacity={opacity} blendMode="plus">
      <RadialGradient c={vec(x, y)} r={r} colors={[palette.candle, 'rgba(255, 213, 138, 0)']} />
    </Circle>
  );
}
