import { StyleSheet } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { NativePreviewView } from 'react-native-vision-camera';

import type { Layout } from '../experience/layout';
import { frameNow } from '../scene/FrameLayer';
import type { CameraFeed } from './useCameraFeed';

/**
 * The live camera as the system's own preview layer, under the scene canvas, moved with the frame. The phone could
 * afford to copy every frame into the canvas; the TCL Tab A1 Plus could not (10 to 18 frames a second, seen as frozen).
 * Here no frame passes through the app.
 */
export function CameraView({ feed, layout, clock }: { feed: CameraFeed; layout: Layout; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const f = frameNow(layout, clock.value);
    return { transform: [{ translateX: f.tx }, { translateY: f.ty }, { scale: f.s }] };
  });
  return (
    <Animated.View style={[styles.window, { width: layout.screen.width, height: layout.screen.height }, style]} pointerEvents="none">
      <NativePreviewView style={StyleSheet.absoluteFill} previewOutput={feed.preview} resizeMode="cover" implementationMode="compatible" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  window: { position: 'absolute', left: 0, top: 0, transformOrigin: 'left top' },
});
