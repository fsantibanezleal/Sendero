# The figures

The family is drawn from 69 licensed silhouette drawings, at least ten per archetype (grandmother, grandfather, woman,
man, dog, cat); the source and licence of each are in `ASSETS.md`. Each visit picks a new drawing per figure, never the one
it showed last.

## The look

The owner's direction of 2026-10-31, after seeing painted masks and colored clothes: "you destroyed all the warm and
spiritual" appearance. A figure is a silhouette of warm light that fades toward the feet, with a soft glow. On it:

- no face details at all (the owner, 2026-10-31: "no face details please"): the head is pure light;
- a few flowers in the hair or at the hat, and small ones at the collar and sometimes the waist;
- at the farewell, a frontal drawing of the person holding a white candle with a marigold band, whose light breathes;
- for a pet, its outline and two flowers at the neck.

The flowers come from how people appear on Día de Muertos: cempasúchil and roses in the hair (https://hiplatina.com/dia-de-los-muertos-6-things-you-should-know-before-painting-your-face/,
https://rancholapuerta.com/2016/10/28/how-to-apply-la-catrina-makeup-a-day-of-the-dead-tutorial/).

## How it is made

`pipeline/silhouettes/build.py` measures each drawing on a raster and stores its anchors: head, neck, shoulders, waist and
hem for a person, head and body for a pet. The manifest can correct an anchor by hand where a parasol or a raised arm
fools the measurement. `src/figures/decor.ts` paints in figure units (height 1, feet at y = 0, facing right), and each
figure is rendered once on the CPU into an image, so that drawing it costs one image per frame (`dressedFigure`); the glow
of `Ghost.tsx` stays behind it as light only.

A drawing is one pose: the walker glides with a soft rise and fall and a gentle sway, it does not move its legs. The
candle is placed by the body anchors, not on a real hand, so two painted hands hold it.

## Flowers on the visitor

During a visit the app runs the person mask (`src/camera/useCameraFeed.ts`, MediaPipe selfie segmenter, on the device,
nothing stored or sent) and `findHead` takes the top of the head and its width from it. `FrameLayer.tsx` rests a little arc
of flowers there, follows the person gently and fades it out when nobody is found. It uses the hair outline, which a face
detector would not give. With several people it follows the highest head.

## Preview

```powershell
$env:SENDERO_DECOR_PREVIEW = "<temp root>/sendero/decor.png"
$env:SENDERO_DECOR_KINDS = "abuela,mujer"
npx jest src/figures/__tests__/decorPreview.test.ts
```
