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
   sensor rotation and applies the selfie mirror.
3. The result is copied to a CPU image (`makeNonTextureImage`) so it can cross threads, and published to a
   Reanimated shared value with `scheduleOnRN`; the previous image is disposed. Backpressure: at most one frame
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
