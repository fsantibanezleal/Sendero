import { useFonts } from 'expo-font';
import { useKeepAwake } from 'expo-keep-awake';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCameraPermission } from 'react-native-vision-camera';

import pkg from './package.json';
import { BUNDLED_TRACKS } from './src/audio/assets.generated';
import { VOICE_CLIPS } from './src/audio/assets.generated';
import { clearImportedMusic, importFromPickedFolder, ownTracks } from './src/audio/importMusic';
import { buildRound, type Track } from './src/audio/playlist';
import { SoundEngine } from './src/audio/soundEngine';
import { type CameraFeed, useCameraFeed } from './src/camera/useCameraFeed';
import { MESSAGES } from './src/content/messages';
import { computeLayout } from './src/experience/layout';
import { useExperience, type Visit } from './src/experience/useExperience';
import { bakeFlowerAtlas } from './src/flowers/atlas';
import * as Kiosk from './src/kiosk/kiosk';
import { createStaffGesture } from './src/kiosk/staffGesture';
import { FONT_MESSAGE, FONT_TITLE, Hint, MessageOverlay } from './src/scene/Overlays';
import { Scene } from './src/scene/Scene';
import { loadSettings, saveSettings, type Settings } from './src/settings/settings';
import { StaffPanel, type StaffStatus } from './src/staff/StaffPanel';
import { palette } from './src/theme/palette';

/** Below this many masks per second the automatic mode shows a still cut-out instead of a live one. */
const LIVE_MASK_MIN_RATE = 6;

/** The display version (X.XX.XXX) from the manifest's semver. */
function displayVersion(semver: string): string {
  const [a, b, c] = semver.split('.').map((n) => Number(n) || 0);
  return `${a}.${String(b).padStart(2, '0')}.${String(c).padStart(3, '0')}`;
}

export default function App() {
  useKeepAwake();
  const [fontsLoaded] = useFonts({
    [FONT_MESSAGE]: require('./assets/fonts/CormorantGaramond-MediumItalic.ttf'),
    [FONT_TITLE]: require('./assets/fonts/CormorantGaramond-SemiBold.ttf'),
  });
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
      {hasPermission && fontsLoaded ? <Altar /> : <Waiting needsCamera={!hasPermission} />}
    </GestureHandlerRootView>
  );
}

function bundledPlaylist(): Track[] {
  return BUNDLED_TRACKS.map((t) => ({ id: t.id, title: `${t.title} (${t.performer}, ${t.year})`, source: t.source, origin: 'bundled' }));
}

function Altar() {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => computeLayout(width, height), [width, height]);
  const atlas = useMemo(() => bakeFlowerAtlas(), []);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  const feed = useCameraFeed(true);
  const feedRef = useRef<CameraFeed>(feed);
  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  const engine = useRef<SoundEngine | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [ownCount, setOwnCount] = useState(0);

  const roundFactory = useCallback(() => {
    const own = ownTracks();
    setOwnCount(own.length);
    return buildRound(own, bundledPlaylist(), settingsRef.current.mixTraditional, Math.random);
  }, []);

  useEffect(() => {
    const e = new SoundEngine();
    engine.current = e;
    e.setMusicVolume(settingsRef.current.musicVolume);
    e.setVoiceVolume(settingsRef.current.voiceVolume);
    e.start(roundFactory).catch(() => undefined);
    return () => e.dispose();
  }, [roundFactory]);

  const updateSettings = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    engine.current?.setMusicVolume(next.musicVolume);
    engine.current?.setVoiceVolume(next.voiceVolume);
  }, []);

  const events = useMemo(
    () => ({
      onMask: (on: boolean) => feedRef.current.setMaskActive(on),
      onReveal: () => {
        const mode = settingsRef.current.maskMode;
        const slow = feedRef.current.maskRate.value < LIVE_MASK_MIN_RATE;
        if (mode === 'still' || (mode === 'auto' && slow)) {
          feedRef.current.setFrozen(true);
        }
      },
      onMessage: () => engine.current?.duckMusic(),
      onWhisper: (v: Visit) => {
        const clip = VOICE_CLIPS[v.voice]?.[MESSAGES[v.messageIndex].id];
        if (clip != null) engine.current?.playVoice(clip);
      },
      onReturn: () => {
        engine.current?.releaseMusic();
        feedRef.current.setFrozen(false);
      },
      onEnd: () => undefined,
    }),
    [],
  );
  const experience = useExperience(events);

  const gesture = useMemo(() => createStaffGesture({ width, height }), [width, height]);
  const onTouch = useCallback(
    (e: GestureResponderEvent) => {
      if (panelOpen) return;
      const { locationX, locationY } = e.nativeEvent;
      if (gesture.tap(locationX, locationY)) {
        setPanelOpen(true);
        return;
      }
      // A touch in the staff corner never starts a visit, so the gesture is not interrupted.
      const corner = Math.min(width, height) * 0.12;
      if (locationX <= corner && locationY <= corner) return;
      experience.start();
    },
    [panelOpen, gesture, width, height, experience],
  );

  const status: StaffStatus = {
    version: displayVersion(pkg.version),
    kiosk: Kiosk.kioskState(),
    deviceOwner: Kiosk.isDeviceOwner(),
    model: feed.modelState === 'ready' ? 'lista' : feed.modelState === 'loading' ? 'cargando' : 'no disponible',
    maskRate: feed.maskRate.value,
    ownTracks: ownCount,
    bundledTracks: BUNDLED_TRACKS.length,
    nowPlaying: engine.current?.nowPlaying() ?? '',
  };

  const actions = {
    importMusic: async () => {
      const r = await importFromPickedFolder();
      engine.current?.refresh();
      return `Importadas: ${r.copied} · ya estaban: ${r.skipped} · con error: ${r.failed}`;
    },
    clearMusic: () => {
      const n = clearImportedMusic();
      engine.current?.refresh();
      return `Borradas: ${n}`;
    },
    enterKiosk: async () => {
      const state = await Kiosk.enterKiosk();
      return state === 'locked' ? 'Modo quiosco activo (dispositivo bloqueado en Sendero).' : 'Pantalla fijada (sin propietario del dispositivo: se puede salir con el gesto del sistema).';
    },
    exitKiosk: async () => {
      await Kiosk.exitKiosk();
      return 'Modo quiosco desactivado.';
    },
    releaseDevice: async () => {
      await Kiosk.releaseDeviceOwner();
      return 'Dispositivo liberado: Sendero ya no es el propietario del dispositivo.';
    },
    testVisit: () => {
      experience.start();
    },
  };

  return (
    <View style={styles.root} onTouchEnd={onTouch}>
      <Scene layout={layout} feed={feed} atlas={atlas} clock={experience.clock} time={experience.time} visit={experience.visit} />
      <Hint clock={experience.clock} time={experience.time} visible={settings.showHint} />
      <MessageOverlay visit={experience.visit} clock={experience.clock} />
      {panelOpen ? (
        <StaffPanel settings={settings} onSettings={updateSettings} status={status} actions={actions} onClose={() => setPanelOpen(false)} />
      ) : null}
    </View>
  );
}

/** Shown only during setup: fonts loading, or the camera permission still missing. */
function Waiting({ needsCamera }: { needsCamera: boolean }) {
  return (
    <View style={styles.center}>
      {needsCamera ? <Text style={styles.notice}>Sendero necesita permiso para usar la cámara frontal.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.night },
  notice: { color: palette.warmWhite, fontSize: 22 },
});
