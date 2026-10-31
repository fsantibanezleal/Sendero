import { Circle, Group, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { Layout } from '../experience/layout';
import type { Visit } from '../experience/plan';
import { TIMELINE, windowProgress } from '../experience/timeline';
import { HUMAN_PROFILE } from '../figures/catalog';
import { artPath, placeArt } from '../figures/art';
import { humanFarPath, humanMainPath, petSitPath, petWalkPaths, type ScreenTransform } from '../figures/draw';
import { BASE_HEIGHT, PET_ART_HEIGHT } from '../figures/looks';
import { gaitCurves } from '../figures/gait';
import { standPose, walkPose } from '../figures/rig';
import { rigStyle } from '../figures/style';
import type { FlowerAtlas } from '../flowers/atlas';
import type { PetalPathData } from '../path/petalPath';
import { easeInOutSine, pointAtDistance, smoothstep } from '../procedural';
import { Ghost } from './Ghost';
import { Sparkles } from './Sparkles';

/**
 * Where the family waits around the far end of the path, in units of the far figure height:
 * four places for the people (a little apart, at slightly different depths) and two in front for
 * the pets. `k` scales the figure with its depth.
 */
const SPOTS = [
  { a: -0.62, b: -0.06, k: 0.93 },
  { a: -0.2, b: 0.05, k: 1.0 },
  { a: 0.24, b: -0.08, k: 0.92 },
  { a: 0.66, b: 0.03, k: 0.98 },
  { a: -0.42, b: 0.3, k: 1.04 },
  { a: 0.46, b: 0.32, k: 1.04 },
];

/** Fraction of the walk spent stepping from the waiting place onto the path. */
const STEP_OFF = 0.1;

/**
 * The silhouettes: the family of six (the four people and the two pets, each a new variant) that
 * appears in the upper left as the path starts and waits there; then one of the four people, and
 * the pet beside them when there is one, steps onto the path and walks toward the frame in about
 * seven seconds, growing with depth and stepping with real gait kinematics. The others stay until
 * the arrival.
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
  const table = path.table;
  const start = layout.pathStart;
  const far = layout.farHeight;
  const near = layout.arrivalHeight;
  const empty = useMemo(() => Skia.Path.Make(), []);

  const walkerLook = visit.people[visit.walker];
  const profile = HUMAN_PROFILE[walkerLook.human];
  const curves = useMemo(() => gaitCurves(profile.gaitGroup), [profile.gaitGroup]);
  const cadence = profile.cadenceHz / Math.sqrt(walkerLook.build.height);
  const walkStyle = useMemo(() => rigStyle(walkerLook, false), [walkerLook]);
  const companion = visit.companion == null ? null : visit.pets[visit.companion];

  // Screen place of each of the six figures (people 0 to 3, pets 4 and 5).
  const places = useMemo(
    () =>
      visit.spots.map((s) => {
        const spot = SPOTS[s];
        return { x: start.x + spot.a * far, y: start.y + spot.b * far, h: far * spot.k };
      }),
    [visit.spots, start.x, start.y, far],
  );
  const waiting = useMemo(
    () =>
      visit.people.map((look, i) => ({
        look,
        place: places[i],
        style: rigStyle(look, true),
        phase: i * 1.3 + visit.id,
        walker: i === visit.walker,
      })),
    [visit.people, visit.walker, visit.id, places],
  );
  const waitingPets = useMemo(
    () => visit.pets.map((look, i) => ({ look, place: places[4 + i], companion: i === visit.companion })),
    [visit.pets, visit.companion, places],
  );

  // The family that stays: everyone but the walker and the pet that walks with them. Built once per
  // visit (they stand still), so it costs nothing per frame; the glow breathes instead.
  const family = useMemo(() => {
    const main = Skia.PathBuilder.Make();
    const back = Skia.PathBuilder.Make();
    for (let i = 0; i < waiting.length; i++) {
      const w = waiting[i];
      if (w.walker) continue;
      if (w.look.art != null) {
        const h = w.place.h * BASE_HEIGHT[w.look.human] * w.look.build.height;
        main.addPath(placeArt(artPath(w.look.art), w.place.x, w.place.y, h, 1, 0));
        continue;
      }
      const tf: ScreenTransform = { ox: w.place.x, oy: w.place.y, h: w.place.h, facing: 1 };
      const pose = standPose(w.style, 1.2 * Math.sin(w.phase));
      back.addPath(humanFarPath(w.look, pose, tf));
      main.addPath(humanMainPath(w.look, pose, tf));
    }
    for (let i = 0; i < waitingPets.length; i++) {
      const p = waitingPets[i];
      if (p.companion) continue;
      if (p.look.still != null) {
        main.addPath(placeArt(artPath(p.look.still), p.place.x, p.place.y, p.place.h * PET_ART_HEIGHT * p.look.size, 1, 0));
        continue;
      }
      const tf: ScreenTransform = { ox: p.place.x, oy: p.place.y, h: p.place.h, facing: 1 };
      if (p.look.sits) {
        main.addPath(petSitPath(p.look, tf));
      } else {
        const paths = petWalkPaths(p.look, 0.1, tf);
        main.addPath(paths.main);
        back.addPath(paths.far);
      }
    }
    return { main: main.build(), back: back.build() };
  }, [waiting, waitingPets]);
  const familyMain = useDerivedValue(() => family.main);
  const familyFar = useDerivedValue(() => family.back);
  const familyOpacity = useDerivedValue(() => {
    const t = clock.value;
    const appear = smoothstep(TIMELINE.family.start, TIMELINE.family.end, t);
    const leave = 1 - smoothstep(TIMELINE.arrive.start, TIMELINE.arrive.end, t);
    return appear * leave * (0.86 + 0.06 * Math.sin(time.value * 0.9));
  });
  const familyGlow = useDerivedValue(() => far * 0.2 + (1 - familyOpacity.value) * far * 0.4);
  const familyTop = useDerivedValue(() => start.y - far * 1.2);
  const familyBottom = useDerivedValue(() => start.y + far * 0.35);

  // The walker: waiting at their place, then stepping onto the path and walking it.
  const walkerPlace = places[visit.walker];
  const petPlace = visit.companion == null ? null : places[4 + visit.companion];
  // The drawings of the walker and the pet beside them, united once on the JS thread.
  const walkerArt = useMemo(() => (walkerLook.art != null ? artPath(walkerLook.art) : null), [walkerLook.art]);
  const walkerArtScale = BASE_HEIGHT[walkerLook.human] * walkerLook.build.height;
  const companionArt = useMemo(() => (companion?.art != null ? artPath(companion.art) : null), [companion?.art]);
  const companionArtScale = companion != null ? PET_ART_HEIGHT * companion.size : 0;
  const walker = useDerivedValue(() => {
    const t = clock.value;
    if (t < TIMELINE.family.start || t >= TIMELINE.reveal.start) {
      return { main: empty, back: empty, x: walkerPlace.x, y: walkerPlace.y, h: walkerPlace.h };
    }
    const main = Skia.PathBuilder.Make();
    const back = Skia.PathBuilder.Make();
    const u = easeInOutSine(windowProgress(t, TIMELINE.walk));
    const p = pointAtDistance(table, u * table.total);
    const onPath = far + (near - far) * Math.pow(u, 1.3);
    // Step off: blend from the waiting place onto the path during the first part of the walk.
    const m = smoothstep(0, STEP_OFF, u);
    const x = walkerPlace.x + (p.x - walkerPlace.x) * m;
    const y = walkerPlace.y + (p.y - walkerPlace.y) * m;
    const h = walkerPlace.h + (onPath - walkerPlace.h) * m;
    const facing = m < 1 && p.x < walkerPlace.x ? -1 : p.tx < -0.25 ? -1 : 1;
    const tf: ScreenTransform = { ox: x, oy: y, h, facing };
    const walking = t >= TIMELINE.walk.start && t < TIMELINE.walk.end;
    // A drawing glides like a spirit: a soft rise and fall at each step and a gentle sway.
    const stepPhase = (t - TIMELINE.walk.start) * cadence * 2 * Math.PI;
    const bob = walking ? Math.abs(Math.sin(stepPhase)) * 0.012 * h : 0;
    const sway = walking ? 0.025 * Math.sin(stepPhase * 0.5) : 0.012 * Math.sin(time.value * 0.7);
    if (walkerArt != null) {
      main.addPath(placeArt(walkerArt, x, y - bob, h * walkerArtScale, facing, sway));
    } else {
      const pose = walking
        ? walkPose(curves, (t - TIMELINE.walk.start) * cadence, walkStyle)
        : standPose(rigStyle(walkerLook, true), 1.5 * Math.sin(time.value * 0.7));
      back.addPath(humanFarPath(walkerLook, pose, tf));
      main.addPath(humanMainPath(walkerLook, pose, tf));
    }
    if (companion != null && petPlace != null) {
      // The pet walks beside the person, on the viewer's side of the path, a little ahead.
      const nx = -p.ty;
      const ny = p.tx;
      const side = ny > 0 ? 1 : -1;
      const besideX = x + nx * side * 0.18 * h + p.tx * 0.12 * h;
      const besideY = y + ny * side * 0.18 * h + p.ty * 0.12 * h;
      const q = walking ? 1 : 0;
      const px = petPlace.x + (besideX - petPlace.x) * m;
      const py = petPlace.y + (besideY - petPlace.y) * m;
      const pt: ScreenTransform = { ox: px, oy: py, h: petPlace.h + (h - petPlace.h) * m, facing };
      if (companionArt != null) {
        const petBob = walking ? Math.abs(Math.sin(stepPhase * 1.6)) * 0.01 * pt.h : 0;
        main.addPath(placeArt(companionArt, px, py - petBob, pt.h * companionArtScale, facing, 0));
      } else if (!walking && companion.sits) {
        main.addPath(petSitPath(companion, pt));
      } else {
        const pet = petWalkPaths(companion, q > 0 ? (t - TIMELINE.walk.start) * 1.7 : 0.1, pt);
        main.addPath(pet.main);
        back.addPath(pet.far);
      }
    }
    return { main: main.build(), back: back.build(), x, y, h };
  });
  const walkerMain = useDerivedValue(() => walker.value.main);
  const walkerFar = useDerivedValue(() => walker.value.back);
  const walkerOpacity = useDerivedValue(() => {
    const t = clock.value;
    const appear = smoothstep(TIMELINE.family.start, TIMELINE.family.end, t);
    const leave = 1 - smoothstep(TIMELINE.arrive.start, TIMELINE.arrive.start + 0.9, t);
    return appear * leave * 0.94;
  });
  const walkerTop = useDerivedValue(() => walker.value.y - walker.value.h);
  const walkerBottom = useDerivedValue(() => walker.value.y);
  const walkerGlow = useDerivedValue(() => walker.value.h * 0.18);
  // The walker's light grows once they leave the family.
  const walking = useDerivedValue(() => smoothstep(TIMELINE.walk.start, TIMELINE.walk.start + 1.0, clock.value));

  // A soft warm light on the petals under the walker's feet, so the figure stands on the path.
  const groundTransform = useDerivedValue(() => [{ translateX: walker.value.x }, { translateY: walker.value.y }, { scaleY: 0.2 }]);
  const groundR = useDerivedValue(() => walker.value.h * 0.32);
  const groundOpacity = useDerivedValue(() => walkerOpacity.value * walking.value * 0.7);

  const sparkX = useDerivedValue(() => walker.value.x);
  const sparkY = useDerivedValue(() => walker.value.y - walker.value.h * 0.45);
  const sparkSpread = useDerivedValue(() => walker.value.h * 0.4);
  const sparkSize = useDerivedValue(() => walker.value.h * 0.05);
  const sparkStrength = useDerivedValue(() => walkerOpacity.value * walking.value);

  return (
    <Group>
      <Ghost main={familyMain} far={familyFar} opacity={familyOpacity} top={familyTop} bottom={familyBottom} glow={familyGlow} />
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
      <Group transform={groundTransform} opacity={groundOpacity} blendMode="plus">
        <Circle cx={0} cy={0} r={groundR}>
          <RadialGradient c={vec(0, 0)} r={groundR} colors={['rgba(255, 213, 138, 0.8)', 'rgba(255, 170, 60, 0.25)', 'rgba(255, 170, 60, 0)']} />
        </Circle>
      </Group>
      <Ghost main={walkerMain} far={walkerFar} opacity={walkerOpacity} top={walkerTop} bottom={walkerBottom} glow={walkerGlow} />
    </Group>
  );
}
