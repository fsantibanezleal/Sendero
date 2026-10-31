import { Atlas, Blur, Circle, Group, Image, Line, Path, RadialGradient, rrect, Skia, vec, type Transforms3d } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { CameraFeed } from '../camera/useCameraFeed';
import { visitorCrown } from '../figures/decor';
import type { Layout } from '../experience/layout';
import { frameAt } from '../experience/layout';
import { TIMELINE, windowProgress } from '../experience/timeline';
import { CELL, type FlowerAtlas, HEAD_VARIANTS, LEAF_VARIANTS } from '../flowers/atlas';
import { garlandSprites } from '../flowers/garland';
import { easeInOutCubic, easeOutCubic } from '../procedural';
import { palette } from '../theme/palette';
import { bannerRow, type Banner } from './papelPicado';
import { coverRect } from './revealGeometry';

/**
 * The framed camera: the live mirrored camera inside the cempasuchil garland, with papel picado
 * along the top and two candles in the lower corners. The whole frame shrinks to the lower right
 * corner during the walk and returns for the reveal; while the reveal is on, the camera gives way to
 * the reveal composite and the garland stays around it ("with the same border background of
 * flowers").
 */
/** Where the frame is at clock t: full screen, the corner, the stage, back. Shared with the native camera view. */
export function frameNow(layout: Layout, t: number): { tx: number; ty: number; s: number } {
  'worklet';
  if (t < 0) return { tx: 0, ty: 0, s: 1 };
  const shrink = easeInOutCubic(windowProgress(t, TIMELINE.shrink));
  const arrive = easeOutCubic(windowProgress(t, TIMELINE.arrive));
  const back = easeInOutCubic(windowProgress(t, TIMELINE.return));
  return frameAt(layout, shrink, arrive, back);
}

export function FrameLayer({
  layout,
  feed,
  atlas,
  clock,
  time,
}: {
  layout: Layout;
  feed: CameraFeed;
  atlas: FlowerAtlas;
  clock: SharedValue<number>;
  time: SharedValue<number>;
}) {
  const { width: W, height: H } = layout.screen;

  // Full screen while waiting; to the lower right corner for the walk; to the stage on the right at
  // the arrival, where it stays for the farewell and the message; back to full screen at the return.
  const transform = useDerivedValue(() => {
    const f = frameNow(layout, clock.value);
    return [{ translateX: f.tx }, { translateY: f.ty }, { scale: f.s }];
  });

  const clip = useMemo(() => rrect(Skia.XYWHRect(0, 0, W, H), layout.radius, layout.radius), [W, H, layout.radius]);
  const cover = useDerivedValue(() => {
    const f = feed.size.value;
    return coverRect(f.width, f.height, W, H);
  });

  // The flowers in the visitor's hair: a little wider than the head, the arc resting on its top.
  const crown = useMemo(() => visitorCrown(), []);
  const crownTransform = useDerivedValue((): Transforms3d => {
    const c = cover.value;
    const head = feed.head.value;
    const s = head.width * c.width * 1.25;
    return [{ translateX: c.x + head.x * c.width - s / 2 }, { translateY: c.y + head.y * c.height - s * 0.3 }, { scale: s }];
  });
  const crownOpacity = useDerivedValue(() => feed.head.value.seen);

  const garland = useMemo(() => {
    const sprites = garlandSprites({ width: W, height: H, band: layout.band, seed: 1102, headVariants: HEAD_VARIANTS, leafVariants: LEAF_VARIANTS });
    return {
      rects: sprites.map((s) => (s.kind === 'head' ? atlas.heads[s.variant] : atlas.leaves[s.variant])),
      transforms: sprites.map((s) => {
        const scale = s.size / (CELL * (s.kind === 'head' ? 0.84 : 0.9));
        return Skia.RSXformFromRadians(scale, s.rotation, s.x, s.y, CELL / 2, CELL / 2);
      }),
    };
  }, [W, H, layout.band, atlas]);

  const banners = useMemo(() => bannerRow(W, -H * 0.01, Math.max(64, W * 0.058), 2), [W, H]);
  const string = useMemo(() => ({ y: banners[0]?.y ?? 0 }), [banners]);

  return (
    <Group transform={transform}>
      <Group clip={clip}>
        <Image image={crown} x={0} y={0} width={1} height={1} transform={crownTransform} opacity={crownOpacity} fit="fill" />
      </Group>
      <Atlas image={atlas.image} sprites={garland.rects} transforms={garland.transforms} />
      <Line p1={vec(0, string.y + 2)} p2={vec(W, string.y + 2)} color="rgba(255, 244, 224, 0.5)" strokeWidth={2} />
      {banners.map((b, i) => (
        <PapelPicado key={i} banner={b} time={time} />
      ))}
      <Candle x={layout.band * 0.9} y={H - layout.band * 0.55} size={layout.band} time={time} phase={0} />
      <Candle x={W - layout.band * 0.9} y={H - layout.band * 0.55} size={layout.band} time={time} phase={2.1} />
    </Group>
  );
}

function PapelPicado({ banner, time }: { banner: Banner; time: SharedValue<number> }) {
  const transform = useDerivedValue(() => {
    const a = 0.035 * Math.sin(time.value * 0.8 + banner.phase);
    return [
      { translateX: banner.x + banner.width / 2 },
      { translateY: banner.y },
      { rotate: a },
      { translateX: -banner.width / 2 },
    ];
  });
  return (
    <Group transform={transform}>
      <Path path={banner.path} color={banner.color} opacity={0.9} />
    </Group>
  );
}

/** A veladora: a cream candle, a flickering flame and its warm glow (research-visuals D3 item 7). */
function Candle({ x, y, size, time, phase }: { x: number; y: number; size: number; time: SharedValue<number>; phase: number }) {
  const body = useMemo(() => Skia.Path.RRect(rrect(Skia.XYWHRect(x - size * 0.16, y - size * 0.1, size * 0.32, size * 0.5), size * 0.05, size * 0.05)), [x, y, size]);
  const flicker = useDerivedValue(() => {
    const t = time.value + phase;
    return 1 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 11.9) + 0.03 * Math.sin(t * 17.1);
  });
  const flame = useDerivedValue(() => {
    const f = flicker.value;
    const fx = x;
    const fy = y - size * 0.12;
    const h = size * 0.5 * f;
    const w = size * 0.11;
    const p = Skia.PathBuilder.Make();
    p.moveTo(fx, fy - h);
    p.cubicTo(fx + w * 1.4, fy - h * 0.45, fx + w, fy, fx, fy);
    p.cubicTo(fx - w, fy, fx - w * 1.4, fy - h * 0.45, fx, fy - h);
    p.close();
    return p.build();
  });
  const glowR = useDerivedValue(() => size * 1.3 * flicker.value);
  const glowOpacity = useDerivedValue(() => 0.85 * flicker.value);
  return (
    <Group>
      <Circle cx={x} cy={y - size * 0.25} r={glowR} opacity={glowOpacity} blendMode="plus">
        <RadialGradient c={vec(x, y - size * 0.25)} r={size * 1.1} colors={['rgba(255, 213, 138, 0.75)', 'rgba(255, 170, 60, 0.25)', 'rgba(255, 213, 138, 0)']} />
      </Circle>
      <Path path={body} color="#F3E7D0" />
      <Path path={flame} color={palette.marigoldLight}>
        <Blur blur={size * 0.015} />
      </Path>
    </Group>
  );
}
