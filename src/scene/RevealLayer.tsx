import { BlurMask, Circle, Group, Image, RadialGradient, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { CameraFeed } from '../camera/useCameraFeed';
import type { Layout } from '../experience/layout';
import type { Visit } from '../experience/useExperience';
import { TIMELINE } from '../experience/timeline';
import type { FlowerAtlas } from '../flowers/atlas';
import { humanFrontPath, petSitPath, type ScreenTransform } from '../figures/draw';
import { mulberry32, smoothstep } from '../procedural';
import { palette } from '../theme/palette';
import { Gate } from './Gate';
import { Ghost } from './Ghost';
import { NightLayer } from './NightLayer';
import { coverInto, coverRect, PERSON_SCALE, personRect, portraitRect } from './revealGeometry';
import { Sparkles } from './Sparkles';

/**
 * The magic (plan.md section 3, REVEAL): the night between the worlds, the soft front-view
 * silhouette of the same person standing behind the visitor (with their pet sitting beside), and
 * the visitor in front, cut out of the live camera by the person mask and shown smaller. Without a
 * mask (model unavailable), the visitor is shown smaller inside a soft rounded frame, with the
 * silhouette glowing around it.
 */
export function RevealLayer({
  visit,
  layout,
  feed,
  atlas,
  clock,
  time,
}: {
  visit: Visit;
  layout: Layout;
  feed: CameraFeed;
  atlas: FlowerAtlas;
  clock: SharedValue<number>;
  time: SharedValue<number>;
}) {
  const { width: W, height: H } = layout.screen;
  const human = visit.group.human;
  const pet = visit.group.pet;

  const bokeh = useMemo(() => {
    const rng = mulberry32(visit.id * 31 + 5);
    return new Array(9).fill(0).map(() => ({
      x: rng() * W,
      y: H * (0.25 + rng() * 0.7),
      r: H * (0.05 + rng() * 0.09),
      phase: rng() * 6.28,
    }));
  }, [visit.id, W, H]);

  // Tall enough to stand behind the visitor (shown at 0.82), low enough that the head stays below the
  // papel picado and the top garland (the owner saw it covered by the flowers at 0.98).
  const ghostH = H * 0.82;
  const ghostX = W * 0.565;
  const ghostGround = H * 1.0;
  const appear = useDerivedValue(() => smoothstep(TIMELINE.reveal.start, TIMELINE.reveal.start + 1.6, clock.value));
  const empty = useMemo(() => Skia.Path.Make(), []);
  const ghostMain = useDerivedValue(() => {
    // Built only during the reveal (it breathes, so it is rebuilt every frame while shown).
    if (clock.value < TIMELINE.reveal.start) return empty;
    const tf: ScreenTransform = { ox: ghostX, oy: ghostGround, h: ghostH, facing: 1 };
    const breath = 0.5 + 0.5 * Math.sin(time.value * 1.25);
    const person = humanFrontPath(human, tf, breath);
    if (pet == null) return person;
    const pt: ScreenTransform = { ox: W * 0.27, oy: H * 1.0, h: H * 0.62, facing: 1 };
    const both = Skia.PathBuilder.Make();
    both.addPath(person);
    both.addPath(petSitPath(pet, pt));
    return both.build();
  });
  const ghostFar = useDerivedValue(() => empty);
  const ghostOpacity = useDerivedValue(() => appear.value * (0.82 + 0.08 * Math.sin(time.value * 1.25)));
  const ghostTop = useDerivedValue(() => ghostGround - ghostH);
  const ghostBottom = useDerivedValue(() => ghostGround - ghostH * 0.1);
  const ghostGlow = useDerivedValue(() => H * 0.05 + (1 - appear.value) * H * 0.08);

  // Camera and mask share one rectangle, so the cut-out lines up with the visitor.
  const rect = useDerivedValue(() => {
    const f = feed.size.value;
    return personRect(coverRect(f.width, f.height, W, H), W, H, PERSON_SCALE);
  });
  const rx = useDerivedValue(() => rect.value.x);
  const ry = useDerivedValue(() => rect.value.y);
  const rw = useDerivedValue(() => rect.value.width);
  const rh = useDerivedValue(() => rect.value.height);
  const hasMask = useDerivedValue(() => (feed.mask.value != null ? 1 : 0));
  const noMask = useDerivedValue(() => 1 - hasMask.value);
  const maskOn = useDerivedValue(() => feed.mask.value != null);
  const maskOff = useDerivedValue(() => feed.mask.value == null);
  const portrait = useMemo(() => portraitRect(W, H), [W, H]);
  // The camera image crops to fill the portrait, so the visitor (in the middle of the camera view) stays in it.
  const crop = useDerivedValue(() => {
    const f = feed.size.value;
    return coverInto(f.width, f.height, portrait);
  });
  const px = useDerivedValue(() => crop.value.x);
  const py = useDerivedValue(() => crop.value.y);
  const pw = useDerivedValue(() => crop.value.width);
  const ph = useDerivedValue(() => crop.value.height);

  const sparkX = useDerivedValue(() => ghostX);
  const sparkY = useDerivedValue(() => H * 0.55);
  const sparkSpread = useDerivedValue(() => W * 0.25);
  const sparkSize = useDerivedValue(() => H * 0.03);

  return (
    <Group>
      <NightLayer layout={layout} time={time} />
      {bokeh.map((b, i) => (
        <Bokeh key={i} x={b.x} y={b.y} r={b.r} phase={b.phase} time={time} />
      ))}
      <Ghost main={ghostMain} far={ghostFar} opacity={ghostOpacity} top={ghostTop} bottom={ghostBottom} glow={ghostGlow} />
      <Sparkles
        image={atlas.image}
        sprite={atlas.glow}
        count={40}
        seed={visit.id + 100}
        cx={sparkX}
        cy={sparkY}
        spread={sparkSpread}
        size={sparkSize}
        time={time}
        strength={appear}
      />
      {/* The visitor cut out by the person mask. */}
      <Gate on={maskOn} width={W} height={H}>
        <Group opacity={hasMask} layer>
          <Image image={feed.image} x={rx} y={ry} width={rw} height={rh} fit="fill" />
          <Image image={feed.mask} x={rx} y={ry} width={rw} height={rh} fit="fill" blendMode="dstIn" />
        </Group>
      </Gate>
      {/* Without a mask: the visitor as a soft-edged portrait, the silhouette behind and beside it. */}
      <Gate on={maskOff} width={W} height={H}>
        <Group opacity={noMask} layer>
          <Group clip={Skia.XYWHRect(portrait.x, portrait.y, portrait.width, portrait.height)}>
            <Image image={feed.image} x={px} y={py} width={pw} height={ph} fit="fill" />
          </Group>
          <RoundedRect
            x={portrait.x + H * 0.03}
            y={portrait.y + H * 0.03}
            width={portrait.width - H * 0.06}
            height={portrait.height - H * 0.06}
            r={H * 0.05}
            color="white"
            blendMode="dstIn"
          >
            <BlurMask blur={H * 0.025} style="normal" />
          </RoundedRect>
        </Group>
      </Gate>
    </Group>
  );
}

function Bokeh({ x, y, r, phase, time }: { x: number; y: number; r: number; phase: number; time: SharedValue<number> }) {
  const opacity = useDerivedValue(() => 0.22 + 0.12 * Math.sin(time.value * 0.5 + phase));
  return (
    <Circle cx={x} cy={y} r={r} opacity={opacity} blendMode="plus">
      <RadialGradient c={vec(x, y)} r={r} colors={[palette.candle, 'rgba(255, 213, 138, 0)']} />
    </Circle>
  );
}
