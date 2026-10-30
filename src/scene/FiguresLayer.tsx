import { type FlowerAtlas } from '../flowers/atlas';
import { Group, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { Visit } from '../experience/useExperience';
import type { Layout } from '../experience/layout';
import { TIMELINE, windowProgress } from '../experience/timeline';
import { HUMAN_PROFILE } from '../figures/catalog';
import { humanFarPath, humanMainPath, petWalkPaths, type ScreenTransform } from '../figures/draw';
import { gaitCurves } from '../figures/gait';
import { standPose, walkPose } from '../figures/rig';
import type { PetalPathData } from '../path/petalPath';
import { easeInOutSine, pointAtDistance, smoothstep } from '../procedural';
import { Ghost } from './Ghost';
import { Sparkles } from './Sparkles';

/** Offsets of the gathered groups around the far end of the path, in screen fractions, and depth. */
const GATHER_SPOTS = [
  { dx: 0, dy: 0, k: 1 },
  { dx: -0.05, dy: -0.025, k: 0.9 },
  { dx: 0.05, dy: -0.04, k: 0.86 },
  { dx: -0.085, dy: 0.012, k: 0.82 },
  { dx: 0.088, dy: 0.004, k: 0.8 },
];

/**
 * The silhouettes: the group that gathers at the far end of the path (dissolving in, standing with
 * a gentle sway), then the chosen person, and their pet when they have one, walking the path toward
 * the frame in about seven seconds, growing with depth and stepping with real gait kinematics.
 */
export function FiguresLayer({
  visit,
  layout,
  path,
  atlas,
  clock,
  time,
}: {
  visit: Visit;
  layout: Layout;
  path: PetalPathData;
  atlas: FlowerAtlas;
  clock: SharedValue<number>;
  time: SharedValue<number>;
}) {
  const { width: W, height: H } = layout.screen;
  const table = path.table;
  const chosen = visit.group;
  const profile = HUMAN_PROFILE[chosen.human];
  const curves = useMemo(() => gaitCurves(profile.gaitGroup), [profile.gaitGroup]);
  const style = useMemo(
    () => ({
      trunkLeanDeg: profile.trunkLeanDeg,
      amplitude: profile.amplitude,
      armSwing: chosen.human === 'abuelo' ? 0.45 : 0.8,
      headForward: profile.gaitGroup === 'older' ? 0.012 : 0,
    }),
    [profile, chosen.human],
  );
  const gather = useMemo(
    () =>
      visit.gather.map((g, i) => {
        const p = HUMAN_PROFILE[g.human];
        return {
          group: g,
          spot: GATHER_SPOTS[i % GATHER_SPOTS.length],
          style: { trunkLeanDeg: p.trunkLeanDeg, amplitude: 1, armSwing: 0, headForward: p.gaitGroup === 'older' ? 0.012 : 0 },
          phase: i * 1.3,
        };
      }),
    [visit.gather],
  );
  const start = layout.pathStart;
  const far = layout.farHeight;
  const near = layout.arrivalHeight;

  // The group standing at the far end (all but the chosen one fade when the walk starts).
  const gathered = useDerivedValue(() => {
    const t = clock.value;
    const main = Skia.Path.Make();
    const back = Skia.Path.Make();
    if (t < TIMELINE.gather.start || t >= TIMELINE.othersFade.end) return { main, back };
    for (let i = 1; i < gather.length; i++) {
      const g = gather[i];
      const h = far * g.spot.k;
      const tf: ScreenTransform = { ox: start.x + g.spot.dx * W, oy: start.y + g.spot.dy * H, h, facing: 1 };
      const pose = standPose(g.style, 1.5 * Math.sin(time.value * 0.7 + g.phase));
      back.addPath(humanFarPath(pose, tf));
      main.addPath(humanMainPath(g.group.human, pose, tf));
      if (g.group.pet != null) {
        const pt: ScreenTransform = { ox: tf.ox + 0.22 * h, oy: tf.oy + 0.02 * h, h, facing: 1 };
        const pet = petWalkPaths(g.group.pet, 0.1, pt);
        main.addPath(pet.main);
        back.addPath(pet.far);
      }
    }
    return { main, back };
  });
  const gatheredMain = useDerivedValue(() => gathered.value.main);
  const gatheredFar = useDerivedValue(() => gathered.value.back);
  const gatheredOpacity = useDerivedValue(() => {
    const t = clock.value;
    const appear = smoothstep(TIMELINE.gather.start, TIMELINE.gather.end, t);
    const leave = 1 - windowProgress(t, TIMELINE.othersFade);
    return appear * leave * 0.85;
  });
  const gatheredGlow = useDerivedValue(() => far * 0.35 + (1 - gatheredOpacity.value) * far * 0.5);

  // The chosen one: standing at the start during the gathering, then walking.
  const walker = useDerivedValue(() => {
    const t = clock.value;
    const main = Skia.Path.Make();
    const back = Skia.Path.Make();
    if (t < TIMELINE.gather.start || t >= TIMELINE.reveal.start) {
      return { main, back, x: start.x, y: start.y, h: far };
    }
    const u = easeInOutSine(windowProgress(t, TIMELINE.walk));
    const s = u * table.total;
    const p = pointAtDistance(table, s);
    const z = u;
    const h = far + (near - far) * Math.pow(z, 1.3);
    const facing = p.tx < -0.25 ? -1 : 1;
    const tf: ScreenTransform = { ox: p.x, oy: p.y, h, facing };
    const walking = t >= TIMELINE.walk.start && t < TIMELINE.walk.end;
    const pose = walking
      ? walkPose(curves, (t - TIMELINE.walk.start) * profile.cadenceHz, style)
      : standPose(style, 1.5 * Math.sin(time.value * 0.7));
    back.addPath(humanFarPath(pose, tf));
    main.addPath(humanMainPath(chosen.human, pose, tf));
    if (chosen.pet != null) {
      // The pet walks beside the person, on the viewer's side of the path, a little ahead.
      const nx = -p.ty;
      const ny = p.tx;
      const side = ny > 0 ? 1 : -1;
      const pt: ScreenTransform = {
        ox: p.x + nx * side * 0.18 * h + p.tx * 0.12 * h,
        oy: p.y + ny * side * 0.18 * h + p.ty * 0.12 * h,
        h,
        facing,
      };
      const pet = petWalkPaths(chosen.pet, walking ? (t - TIMELINE.walk.start) * 1.7 : 0.1, pt);
      main.addPath(pet.main);
      back.addPath(pet.far);
    }
    return { main, back, x: p.x, y: p.y, h };
  });
  const walkerMain = useDerivedValue(() => walker.value.main);
  const walkerFar = useDerivedValue(() => walker.value.back);
  const walkerOpacity = useDerivedValue(() => {
    const t = clock.value;
    const appear = smoothstep(TIMELINE.gather.start, TIMELINE.gather.end, t);
    const leave = 1 - smoothstep(TIMELINE.arrive.start, TIMELINE.arrive.start + 0.9, t);
    return appear * leave * 0.92;
  });
  const walkerTop = useDerivedValue(() => walker.value.y - walker.value.h);
  const walkerBottom = useDerivedValue(() => walker.value.y);
  const walkerGlow = useDerivedValue(() => walker.value.h * 0.18);
  const gatherTop = useDerivedValue(() => start.y - far);
  const gatherBottom = useDerivedValue(() => start.y + far * 0.05);

  const sparkX = useDerivedValue(() => walker.value.x);
  const sparkY = useDerivedValue(() => walker.value.y - walker.value.h * 0.45);
  const sparkSpread = useDerivedValue(() => walker.value.h * 0.4);
  const sparkSize = useDerivedValue(() => walker.value.h * 0.05);
  const sparkStrength = useDerivedValue(() => walkerOpacity.value);

  return (
    <Group>
      <Ghost main={gatheredMain} far={gatheredFar} opacity={gatheredOpacity} top={gatherTop} bottom={gatherBottom} glow={gatheredGlow} />
      <Sparkles
        image={atlas.image}
        sprite={atlas.glow}
        count={24}
        seed={visit.id}
        cx={sparkX}
        cy={sparkY}
        spread={sparkSpread}
        size={sparkSize}
        time={time}
        strength={sparkStrength}
      />
      <Ghost main={walkerMain} far={walkerFar} opacity={walkerOpacity} top={walkerTop} bottom={walkerBottom} glow={walkerGlow} />
    </Group>
  );
}
