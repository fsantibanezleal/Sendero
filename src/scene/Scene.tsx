import { Canvas, Fill, Image } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';

import type { CameraFeed } from '../camera/useCameraFeed';
import { palette } from '../theme/palette';

/**
 * The single canvas of the experience. Layers are added unit by unit (frame, path, figures,
 * reveal, message); the camera layer fills the screen, cropped to cover it.
 */
export function Scene({ feed }: { feed: CameraFeed }) {
  const { width, height } = useWindowDimensions();
  return (
    <Canvas style={styles.fill}>
      <Fill color={palette.night} />
      <Image image={feed.image} x={0} y={0} width={width} height={height} fit="cover" />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
