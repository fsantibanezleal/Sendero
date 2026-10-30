# The scene

Everything visible is drawn in one Skia canvas (`src/scene/Scene.tsx`), back to front:

| Layer | File | Visible |
|---|---|---|
| Night between the worlds | `NightLayer.tsx` | Always, under everything |
| Petal path | `PathLayer.tsx` | Path to arrival |
| Silhouettes | `FiguresLayer.tsx` | Gather to arrival |
| Framed camera and reveal | `FrameLayer.tsx`, `RevealLayer.tsx` | Always; shrinks and returns |
| Bloom | `Scene.tsx` | Around the arrival |

The message and the waiting hint are React Native text over the canvas (`Overlays.tsx`), so Spanish text wraps and
renders with the bundled Cormorant Garamond.

## Palette

`src/theme/palette.ts` (research-visuals D6): night indigo `#14102B`, deep violet `#2B1B4E`, soft violet `#5B3A8C`,
marigold `#FFC20E`, `#F58A07`, `#E8650A`, core `#B84A00`, rosa mexicano `#E4007C` (sRGB 228, 0, 124; decoration
only), candle `#FFD58A`, warm white `#FFF4E0`. Warm white on the night veil measures 16.9:1 (WCAG relative
luminance), far above the 4.5:1 floor for text.

## Cempasuchil heads

`src/flowers/marigold.ts` and `src/flowers/atlas.ts`. A double marigold head is a pompom of ruffled ligulate florets.
The florets are placed by Vogel's phyllotaxis model, floret n at angle n times the golden angle pi (3 - sqrt 5) and
radius c sqrt(n) (Vogel 1979, https://doi.org/10.1016/0025-5564(79)90080-4), which packs them at uniform density.
Each floret is a spatula-shaped ligule (narrow base, widest at 70 percent of its length, a tip of three shallow
lobes) pointing outward, longer toward the rim, with its angle, length and width ruffled by gradient noise (Perlin
2002, https://doi.org/10.1145/566654.566636). They are drawn from the rim inward so inner florets overlap outer ones,
each with a gradient from a deep core to a light rim, over a soft contact shadow, with a candlelight highlight. Eight
head variants, four loose petals, two pinnate leaves and a round glow are baked once, at start, into one atlas image
(`bakeFlowerAtlas`), so hundreds of sprites draw in one call.

## The garland

`src/flowers/garland.ts`. The heads follow the centre line of the border band, a rounded rectangle inset by half the
band (`borderPoint`), spaced by arc length, so the density is the same on any tablet: two rows (a larger outer row and
a smaller inner row offset by half a step), small jitter in position, size and rotation, and leaves tucked on the inner
side. Band thickness: 11 percent of the short side.

## Papel picado and candles

`src/scene/papelPicado.ts`: a row of tissue-paper banners, each one even-odd path so the motifs are holes, a scalloped
lower edge, a border of diamonds and a central eight-petal flower, mirrored as if the paper were folded before cutting.
No skulls. Each banner sways about its top centre by a few hundredths of a radian. The candles (`FrameLayer.tsx`) are
a cream body, a teardrop flame and an additive warm glow, flickering with three summed sines at 7 to 17 Hz
(amplitude about 6 percent).

## The petal path

`src/path/petalPath.ts`. Seven control points wander alternately on each side of the straight line from the far corner
to the frame; a centripetal Catmull-Rom spline through them (Yuksel, Schaefer and Keyser 2011,
https://doi.org/10.1016/j.cad.2010.08.008) curves without cusps or loops. An arc-length table (Guenter and Parent
1990, https://doi.org/10.1109/38.55155) maps distance to position, so the path draws at constant speed. Petals are
Poisson disk samples (Bridson 2007, https://doi.org/10.1145/1278780.1278807) in the strip around the curve, the radius
growing with depth, kept inside the band and thinned toward its edges. Depth z = s / L runs from 0 at the far corner to
1 at the frame; the band's half-width grows as z^1.5 and the petal size as z^1.3, a pseudo-perspective. While drawing,
a glowing guide is trimmed to the drawing head and each petal pops in (an ease-out-back over 60 pixels) once the head
passes it.

## The silhouettes

`src/figures/rig.ts`, `draw.ts`, `gait.ts`.

- Rig: a 2D cutout skeleton in profile. Segment lengths are fractions of body height from Drillis and Contini (1966)
  as drawn in Winter, Biomechanics and Motor Control of Human Movement, 4th ed., Figure 4.1: hip 0.530, knee 0.285,
  ankle 0.039, shoulder 0.818, head 0.130, upper arm 0.186, forearm 0.146, foot 0.152.
- Gait: the sagittal joint angles (pelvis tilt, hip flexion, knee flexion, ankle dorsiflexion) of young and older
  adults walking overground at their comfortable speed, as order-6 Fourier series (`docs/gait.md`). Forward kinematics
  place the knee, ankle, heel and toe; the pelvis height is solved each frame so the lowest foot point touches the
  ground, which produces the natural bob. Arms swing against the opposite leg. Older people walk with the older group's
  curves, a smaller excursion, a slower cadence (0.78 to 0.8 cycles per second against 0.9) and a forward lean.
- Figures (research-culture D5): abuela with a rebozo over the head and shoulders and a long skirt; abuelo with a
  wide-brimmed sombrero and a cane planted ahead of the hand; mujer with long hair and a dress; hombre with a hat. The
  dog has the Xoloitzcuintle's lean body, long neck and large upright ears; the cat a round head and a raised tail. Both
  walk a lateral-sequence walk (hind left, fore left, hind right, fore right; phase offsets 0, 0.25, 0.5, 0.75,
  following Hildebrand's framework).
- Every primitive is wound clockwise on screen, so the nonzero fill merges them into one silhouette.
- Ghost look (`Ghost.tsx`, research-visuals D5): a wide warm halo and a tight halo added with the plus blend, the body
  filled with a vertical gradient that fades out at the feet, the far-side limbs dimmer behind, and small lights
  drifting up around the figure (`Sparkles.tsx`).
- The walk: position along the path by arc length with an ease-in-out, height from the far size to 92 percent of the
  mini frame as z^1.3, the pet beside the person on the viewer's side, a little ahead.

## The frame and the reveal

`FrameLayer.tsx` draws the camera, cropped to cover the screen, clipped to a rounded rectangle, under the garland, the
papel picado and the candles; the whole group shrinks to the mini frame and returns. During the reveal the camera gives
way to `RevealLayer.tsx`, inside the same garland (see `docs/reveal.md`).
