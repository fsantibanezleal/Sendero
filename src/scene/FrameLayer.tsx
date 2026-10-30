import { Atlas, Blur, Circle, Group, Image, Line, Path, RadialGradient, rrect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { CameraFeed } from '../camera/useCameraFeed';
import type { Layout } from '../experience/layout';
import { frameTransform } from '../experience/layout';
import type { Visit } from '../experience/useExperience';
import { TIMELINE, windowProgress } from '../experience/timeline';
import { CELL, type FlowerAtlas, HEAD_VARIANTS, LEAF_VARIANTS } from '../flowers/atlas';
import { garlandSprites } from '../flowers/garland';
import { easeInOutCubic, easeOutCubic, smoothstep } from '../procedural';
import { palette } from '../theme/palette';
import { bannerRow, type Banner } from './papelPicado';
import { LayerBoundary } from './LayerBoundary';
import { coverRect, RevealLayer } from './RevealLayer';

/**
 * The framed camera: the live mirrored camera inside the cempasuchil garland, with papel picado
 * along the top and two candles in the lower corners. The whole frame shrinks to the lower right
 * corner during the walk and returns for the reveal; while the reveal is on, the camera gives way to
 * the reveal composite and the garland stays around it ("with the same border background of
 * flowers").
 */
export function FrameLayer({
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
  const { width: W, height: H } = layout.screen;

  const k = useDerivedValue(() => {
    const t = clock.value;
    if (t < 0) return 0;
    if (t < TIMELINE.arrive.start) return easeInOutCubic(windowProgress(t, TIMELINE.shrink));
    return 1 - easeOutCubic(windowProgress(t, TIMELINE.arrive));
  });
  const transform = useDerivedValue(() => {
    const f = frameTransform(layout, k.value);
    return [{ translateX: f.tx }, { translateY: f.ty }, { scale: f.s }];
  });
  const revealMix = useDerivedValue(() => {
    const t = clock.value;
    if (t < TIMELINE.reveal.start) return 0;
    if (t < TIMELINE.return.start) return smoothstep(TIMELINE.reveal.start, TIMELINE.reveal.start + 0.9, t);
    return 1 - smoothstep(TIMELINE.return.start, TIMELINE.return.end, t);
  });
  const cameraOpacity = useDerivedValue(() => 1 - revealMix.value);

  const clip = useMemo(() => rrect(Skia.XYWHRect(0, 0, W, H), layout.radius, layout.radius), [W, H, layout.radius]);
  const cover = useDerivedValue(() => {
    const img = feed.image.value;
    return coverRect(img?.width() ?? W, img?.height() ?? H, W, H);
  });
  const cx = useDerivedValue(() => cover.value.x);
  const cy = useDerivedValue(() => cover.value.y);
  const cw = useDerivedValue(() => cover.value.width);
  const ch = useDerivedValue(() => cover.value.height);

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
        <Group opacity={cameraOpacity}>
          <Image image={feed.image} x={cx} y={cy} width={cw} height={ch} fit="fill" />
        </Group>
        {visit != null ? (
          <Group opacity={revealMix}>
            <LayerBoundary name="reveal" resetKey={visit.id}>
              <RevealLayer visit={visit} layout={layout} feed={feed} atlas={atlas} clock={clock} time={time} />
            </LayerBoundary>
          </Group>
        ) : null}
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
