# Architecture

Sendero is an Expo (SDK 58) React Native app for Android tablets, built as a standalone APK. It has one screen and
no network.

## One canvas

Everything the visitor sees is drawn in a single `@shopify/react-native-skia` canvas (`src/scene/Scene.tsx`): the
camera image, the flower frame, the petal path, the figures, the reveal and the message. One canvas means one
coordinate system and one draw order, which the reveal needs: the visitor must be drawn in front of the ghost, and the
ghost in front of the background.

## The camera feed

`src/camera/useCameraFeed.ts` follows the pattern of `<SkiaCamera />` from `react-native-vision-camera-skia`,
without its own canvas:

1. `useCamera` opens the front camera with `mirrorMode: 'on'` and one frame output (`useFrameOutput`,
   `pixelFormat: 'rgb'`, frames dropped while busy, buffers sized for the preview). RGB, because `'native'`
   resolves to PRIVATE, which some devices refuse for image analysis, and YUV hardware buffers imported as black
   frames on the emulator.
2. On the camera thread, `renderToTexture` draws each frame upright on an offscreen GPU surface: it cancels the
   sensor rotation and applies the selfie mirror. The frame reaches Skia as a GPU texture imported from the camera's
   hardware buffer; some GPUs return a black texture for that import (the Android emulator does, while its camera
   delivers images). The first 8 frames are probed: when the GPU copy is black (mean channel value under 2) while
   the frame's own pixels are lit (over 6), the feed switches to a raster image built from the frame's pixel buffer
   and draws that instead. The pixels are read from the frame's single plane, else from its pixel buffer; a device
   can refuse both (the emulator reports its camera buffers as CPU-readable, then refuses the read), and then the GPU
   path is kept. No read failure stops the camera. The choice is logged once (`[Sendero] camera: gpu frames ...` or
   `cpu frames ...`), and so is the first error of a frame (`frame failed: ...`).
3. The result is copied to a CPU image (`makeNonTextureImage`) so it can cross threads, and published to a
   Reanimated shared value with `scheduleOnRN`. A replaced image is disposed a few publishes later, not at once:
   the shared value reaches the UI thread asynchronously, so the canvas may still use the previous image for a
   frame (disposing it at once crashed the app with "Attempted to access a disposed object"). The frame size is
   published as plain numbers (`size`), which is what the layers measure; they never call the image object for
   layout. Backpressure: at most one frame
   is in flight to the JS thread (a cross-thread flag); the camera thread skips frames while one is pending.
   Without it a slow device queued several-megabyte copies faster than JS drained them, and touches and React
   updates starved.
4. The scene canvas draws that shared value, cropped to cover the screen.

The person mask of the reveal is computed in the same camera worklet from this upright, mirrored image, so the mask
lines up with the image on screen without any extra transform.

```
camera thread                         JS thread                 UI thread (canvas)
frame -> renderToTexture -> CPU copy -> shared value image  ->  Image layer (cover)
```

## Hidden layers are not drawn

React Native Skia replays every mounted node on every frame, and its player has no shortcut for an opacity of 0: a
hidden layer costs as much as a visible one. The scene keeps the next visit's layers mounted (so the touch shows them
at once) and wraps every layer that is hidden part of the time in a `Gate` (`src/scene/Gate.tsx`): an empty clip
while the layer is hidden, so Skia rejects every draw inside, including the offscreen layers of blurs and blend
groups. Gated: the petal path and the figures (outside the walk), the reveal (outside the reveal), the camera under
the full reveal, and the bloom of the arrival. The silhouettes' paths are built only while they are shown.

## Privacy

- Camera frames exist only in memory; nothing is written or sent.
- The build blocks `android.permission.INTERNET` (`app.config.ts` and `plugins/privacy.js`). A developer can keep
  it for a Metro debug session with `SENDERO_DEV_NETWORK=1`; it is never requested by the release APK.

## Screen

Any orientation (the layout, the garland and the path are derived from the screen size; Android 16 ignores
orientation locks on large screens, and a fixed orientation triggered the camera compatibility treatment, which
rotated and letterboxed the app), keep-awake, status and navigation bars hidden. The manifest opts out of camera
compatibility force rotation and refresh (`plugins/with-kiosk.js`). The kiosk module (lock task mode as device owner)
keeps the visitor inside the app.
