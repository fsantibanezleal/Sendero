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
   `pixelFormat: 'native'`, frames dropped while busy, buffers sized for the preview).
2. On the camera thread, `renderToTexture` draws each frame upright on an offscreen GPU surface: it cancels the
   sensor rotation and applies the selfie mirror.
3. The result is copied to a CPU image (`makeNonTextureImage`) so it can cross threads, and published to a
   Reanimated shared value with `scheduleOnRN`; the previous image is disposed.
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

Landscape only, keep-awake, status and navigation bars hidden. The kiosk module (lock task mode as device owner)
keeps the visitor inside the app.
