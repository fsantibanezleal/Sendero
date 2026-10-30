import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCameraPermission } from 'react-native-vision-camera';

import { useCameraFeed } from './src/camera/useCameraFeed';
import { Scene } from './src/scene/Scene';
import { palette } from './src/theme/palette';

export default function App() {
  useKeepAwake();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <NavigationBar hidden />
      {hasPermission ? <Experience /> : <CameraPermissionNeeded />}
    </GestureHandlerRootView>
  );
}

function Experience() {
  const feed = useCameraFeed(true);
  return <Scene feed={feed} />;
}

/** Shown only to staff during setup: the kiosk cannot work without the camera. */
function CameraPermissionNeeded() {
  return (
    <View style={styles.center}>
      <Text style={styles.notice}>Sendero necesita permiso para usar la cámara frontal.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.night },
  notice: { color: palette.warmWhite, fontSize: 22 },
});
