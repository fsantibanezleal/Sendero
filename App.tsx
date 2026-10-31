import { useFonts } from 'expo-font';
import { useKeepAwake } from 'expo-keep-awake';
import { NavigationBar } from 'expo-navigation-bar';
import { setStatusBarHidden, StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, useTapGesture } from 'react-native-gesture-handler';
import { useCameraPermission } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import pkg from './package.json';
import { BUNDLED_TRACKS, VOICE_CLIPS } from './src/audio/assets.generated';
import { clearImportedMusic, importFromPickedFolder, ownTracks } from './src/audio/importMusic';
import { buildRound, type Track } from './src/audio/playlist';
import { SoundEngine } from './src/audio/soundEngine';
import { useCameraFeed } from './src/camera/useCameraFeed';
import { MESSAGES } from './src/content/messages';
import { log } from './src/diagnostics/log';
import { computeLayout } from './src/experience/layout';
import { useExperience, type Visit } from './src/experience/useExperience';
import { bakeFlowerAtlas } from './src/flowers/atlas';
import * as Kiosk from './src/kiosk/kiosk';
import { CORNER_FRACTION, createStaffGesture } from './src/kiosk/staffGesture';
import { FONT_MESSAGE, FONT_TITLE, Hint, MessageOverlay } from './src/scene/Overlays';
import { Scene } from './src/scene/Scene';
import { loadSettings, saveSettings, type Settings } from './src/settings/settings';
import { StaffPanel, type StaffStatus } from './src/staff/StaffPanel';
import { palette } from './src/theme/palette';


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
    // The component alone left the status bar visible with edge-to-edge; hide it explicitly too (in kiosk
    // mode the device owner disables the status bar entirely).
    setStatusBarHidden(true, 'none');
  }, []);

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
    e.start(roundFactory).catch((err: unknown) => log(`music: failed to start: ${String(err)}`));
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
      // The farewell shows the visitor in the frame and the silhouette beside it: no person mask is needed.
      onMask: () => undefined,
      onReveal: () => undefined,
      onMessage: () => engine.current?.duckMusic(),
      onWhisper: (v: Visit) => {
        const clip = VOICE_CLIPS[v.voice]?.[MESSAGES[v.messageIndex].id];
        if (clip != null) engine.current?.playVoice(clip);
        else log(`voice: no clip for ${v.voice} ${MESSAGES[v.messageIndex].id}`);
      },
      onReturn: () => {
        engine.current?.releaseMusic();
      },
      onEnd: () => undefined,
    }),
    [],
  );
  const experience = useExperience(events);

  const staff = useMemo(() => createStaffGesture({ width, height }), [width, height]);
  // The panel shows a snapshot of the status taken when it opens and after each action.
  const [status, setStatus] = useState<StaffStatus | null>(null);
  const readStatus = useCallback(
    (): StaffStatus => ({
      version: displayVersion(pkg.version),
      kiosk: Kiosk.kioskState(),
      deviceOwner: Kiosk.isDeviceOwner(),
      ownTracks: ownCount,
      bundledTracks: BUNDLED_TRACKS.length,
      nowPlaying: engine.current?.nowPlaying() ?? '',
    }),
    [ownCount],
  );
  const onStaffTap = useCallback(
    (x: number, y: number) => {
      if (staff.tap(x, y)) {
        log('staff panel opened');
        setStatus(readStatus());
        setPanelOpen(true);
      }
    },
    [staff, readStatus],
  );
  const onTouched = useCallback((x: number, y: number, started: boolean, at: number) => {
    const why = at === -2 ? 'staff corner' : at >= 0 ? `ignored, a visit is running (${at.toFixed(1)} s)` : 'the next visit is being prepared: it starts as soon as it is ready';
    log(`touch at ${Math.round(x)},${Math.round(y)}: ${started ? 'visit starts' : why}`);
  }, []);

  // The touch is handled on the UI thread: the planned visit starts in the same frame, whatever the JS
  // thread is doing. A touch in the staff corner never starts a visit, so the gesture is not
  // interrupted. Pressing, holding or sliding a finger all count as a touch.
  const corner = Math.min(width, height) * CORNER_FRACTION;
  const begin = experience.begin;
  const clock = experience.clock;
  // One stable gesture configuration: recreating it on every render re-attached the native handler.
  const tapConfig = useMemo(
    () => ({
      maxDuration: 60000,
      maxDistance: 100000,
      onActivate: (e: { x: number; y: number }) => {
        'worklet';
        const inCorner = e.x <= corner && e.y <= corner;
        const started = inCorner ? false : begin();
        scheduleOnRN(onStaffTap, e.x, e.y);
        scheduleOnRN(onTouched, e.x, e.y, started, inCorner ? -2 : clock.value);
      },
    }),
    [corner, begin, onStaffTap, onTouched, clock],
  );
  const touch = useTapGesture(tapConfig);

  const actions = {
    importMusic: async () => {
      const r = await importFromPickedFolder();
      engine.current?.refresh();
      setStatus(readStatus());
      return `Importadas: ${r.copied} · ya estaban: ${r.skipped} · con error: ${r.failed}`;
    },
    clearMusic: () => {
      const n = clearImportedMusic();
      engine.current?.refresh();
      setStatus(readStatus());
      return `Borradas: ${n}`;
    },
    enterKiosk: async () => {
      const state = await Kiosk.enterKiosk();
      setStatus(readStatus());
      return state === 'locked' ? 'Modo quiosco activo (dispositivo bloqueado en Sendero).' : 'Pantalla fijada (sin propietario del dispositivo: se puede salir con el gesto del sistema).';
    },
    exitKiosk: async () => {
      await Kiosk.exitKiosk();
      setStatus(readStatus());
      return 'Modo quiosco desactivado.';
    },
    releaseDevice: async () => {
      await Kiosk.releaseDeviceOwner();
      setStatus(readStatus());
      return 'Dispositivo liberado: Sendero ya no es el propietario del dispositivo.';
    },
    testVisit: () => {
      log(`test visit from the staff panel: ${experience.start() ? 'starts' : 'ignored (a visit is running)'}`);
    },
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={touch}>
        <View style={styles.root} collapsable={false}>
          <Scene layout={layout} feed={feed} atlas={atlas} clock={experience.clock} time={experience.time} visit={experience.visit} shown={experience.shown} />
          <Hint clock={experience.clock} time={experience.time} visible={settings.showHint} />
          <MessageOverlay visit={experience.shown} clock={experience.clock} />
        </View>
      </GestureDetector>
      {/* Outside the touch detector, so the panel's buttons never start a visit. */}
      {panelOpen && status != null ? (
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
