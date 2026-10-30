import type { SkImage } from '@shopify/react-native-skia';
import { useCallback, useEffect } from 'react';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { useCamera, useFrameOutput, useOrientation } from 'react-native-vision-camera';
import { renderToTexture } from 'react-native-vision-camera-skia';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * The live front camera as a stream of upright, mirrored Skia images.
 *
 * Every frame is drawn upright onto an offscreen GPU surface (`renderToTexture` cancels the sensor
 * rotation and applies the selfie mirror), copied to a CPU image so it can cross threads, and
 * published to a shared value that the scene canvas draws. This is the pattern of
 * `<SkiaCamera />`, without its own canvas, so the whole experience is drawn in ONE canvas.
 *
 * Frames live only in memory: nothing is written to storage or sent anywhere.
 */
export interface CameraFeed {
  /** The latest upright, mirrored camera frame, or null before the first frame. */
  image: SharedValue<SkImage | null>;
}

export function useCameraFeed(active: boolean): CameraFeed {
  const image = useSharedValue<SkImage | null>(null);

  const publish = useCallback(
    (next: SkImage) => {
      const previous = image.get();
      image.set(next);
      previous?.dispose();
    },
    [image],
  );

  const frameOutput = useFrameOutput({
    pixelFormat: 'native',
    dropFramesWhileBusy: true,
    allowDeferredStart: false,
    enablePreviewSizedOutputBuffers: true,
    onFrame: (frame) => {
      'worklet';
      let snapshot: SkImage | undefined;
      try {
        snapshot = renderToTexture(frame, ({ canvas, frameTexture }) => {
          canvas.drawImage(frameTexture, 0, 0);
        });
        const cpuImage = snapshot.makeNonTextureImage();
        if (cpuImage != null) {
          scheduleOnRN(publish, cpuImage);
        }
      } finally {
        snapshot?.dispose();
        frame.dispose();
      }
    },
  });

  useCamera({
    isActive: active,
    device: 'front',
    outputs: [frameOutput],
    mirrorMode: 'on',
    orientationSource: 'custom',
  });

  const orientation = useOrientation('interface') ?? 'up';
  useEffect(() => {
    // outputOrientation is a setter on the native frame output (VisionCamera API), not React state.
    // eslint-disable-next-line react-hooks/immutability
    frameOutput.outputOrientation = orientation;
  }, [frameOutput, orientation]);

  return { image };
}
