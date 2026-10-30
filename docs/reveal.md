# The farewell

The moment the walk ends. The owner first asked for the visitor "smaller, and behind a soft silhouette of the random
person"; after seeing it, on 2026-10-30, he asked for the silhouettes "at the sides of the frames, like resting on it,
not overlapping it". This page describes the farewell as built since 0.01.001.

## The composition

`src/scene/FarewellLayer.tsx`, `src/experience/layout.ts` (`stage`, `companion`, `petSpot`).

- At the arrival the frame grows from the lower right corner to the stage: 60 percent of the screen, on the right,
  its top at 20 percent of the height, with its garland, papel picado, candles and the live camera inside. The visitor
  sees themselves in it, live.
- The silhouette of the person who walked the path stands beside the frame on the left (the side the walk came from),
  facing the viewer, feet on the ground at 94 percent of the height, as tall as 74 percent of the screen for a person of
  height 1 (and never taller than the top of the screen allows with a hat or a bun). One hand rests on the garland along
  the frame's left side, below the middle, the elbow bent (`humanFrontPath` with a resting point: a two-segment arm with
  the rig's upper arm and forearm lengths). Nothing of the silhouette covers the picture.
- The pet, when one walked with them, sits at the silhouette's other side.
- Warm lights drift around them; the silhouette breathes slowly and glows (`Ghost.tsx`).
- The message then covers the screen; at the return the frame goes back to full screen and the silhouette fades.

## Why there is no cut-out any more

The first farewell cut the visitor out of the camera with a person mask (the MediaPipe selfie segmenter) and drew them in
front of a silhouette standing behind. The silhouette then overlapped the garland and the picture ("messy", the owner's
review). Beside the frame, no mask is needed: the person is seen as the camera sees them, whatever the light, however
many people stand there. The mask code stays in `src/camera/useCameraFeed.ts` and is not run.

A later mode may place the silhouette close to the visitor, at their scale (an arm around their shoulders), using the
mask to find one clear head and shoulders, and falling back to this composition when the mask is not reliable (several
people, someone half out of the picture, a dark room).

## Privacy

Frames exist only in memory. Nothing is written to storage or sent; the app has no internet permission.
