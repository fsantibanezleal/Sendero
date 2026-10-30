import * as Crypto from 'expo-crypto';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { hashPin, isValidPin, newSalt, verifyPin } from '../kiosk/pin';
import type { MaskMode, Settings } from '../settings/settings';
import { palette } from '../theme/palette';
import { FONT_TITLE } from '../scene/Overlays';

export interface StaffStatus {
  version: string;
  kiosk: string;
  deviceOwner: boolean;
  model: string;
  maskRate: number;
  ownTracks: number;
  bundledTracks: number;
  nowPlaying: string;
}

export interface StaffActions {
  importMusic(): Promise<string>;
  clearMusic(): string;
  enterKiosk(): Promise<string>;
  exitKiosk(): Promise<string>;
  releaseDevice(): Promise<string>;
  testVisit(): void;
}

const digest = (input: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
const randomBytes = (n: number) => Crypto.getRandomBytes(n);

/**
 * The staff panel (docs/kiosk.md): reached only by the hidden gesture, then a PIN. On first use the
 * PIN is created (entered twice); it is stored as a salted SHA-256 hash.
 */
export function StaffPanel({
  settings,
  onSettings,
  status,
  actions,
  onClose,
}: {
  settings: Settings;
  onSettings(next: Settings): void;
  status: StaffStatus;
  actions: StaffActions;
  onClose(): void;
}) {
  const [stage, setStage] = useState<'pin' | 'new' | 'confirm' | 'open'>(settings.pin == null ? 'new' : 'pin');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [note, setNote] = useState(settings.pin == null ? 'Crea un PIN de 4 a 8 dígitos para el personal.' : 'Ingresa el PIN.');
  const [busy, setBusy] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const submit = useCallback(async () => {
    if (stage === 'pin' && settings.pin != null) {
      const ok = await verifyPin(entry, settings.pin, digest);
      setEntry('');
      if (ok) {
        setStage('open');
        setNote('');
      } else {
        setNote('PIN incorrecto.');
      }
    } else if (stage === 'new') {
      if (!isValidPin(entry)) {
        setNote('El PIN debe tener de 4 a 8 dígitos.');
        setEntry('');
        return;
      }
      setFirst(entry);
      setEntry('');
      setStage('confirm');
      setNote('Repite el PIN.');
    } else if (stage === 'confirm') {
      if (entry !== first) {
        setStage('new');
        setEntry('');
        setFirst('');
        setNote('No coincide. Crea el PIN otra vez.');
        return;
      }
      const salt = newSalt(randomBytes);
      const hash = await hashPin(entry, salt, digest);
      onSettings({ ...settings, pin: { salt, hash } });
      setEntry('');
      setStage('open');
      setNote('PIN guardado.');
    }
  }, [stage, entry, first, settings, onSettings]);

  const run = useCallback(async (fn: () => Promise<string> | string) => {
    setBusy(true);
    try {
      setNote(await fn());
    } catch (e) {
      setNote(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  if (stage !== 'open') {
    return (
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Personal</Text>
          <Text style={styles.note}>{note}</Text>
          <Text style={styles.pin}>{entry.replace(/./g, '•') || ' '}</Text>
          <View style={styles.pad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Borrar', '0', 'OK'].map((k) => (
              <Pressable
                key={k}
                style={styles.key}
                onPress={() => {
                  if (k === 'Borrar') setEntry((e) => e.slice(0, -1));
                  else if (k === 'OK') submit();
                  else if (entry.length < 8) setEntry((e) => e + k);
                }}>
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Cerrar" onPress={onClose} />
        </View>
      </View>
    );
  }

  const set = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch });
  const step = (v: number, d: number) => Math.round(Math.max(0, Math.min(1, v + d)) * 100) / 100;
  const modes: { mode: MaskMode; label: string }[] = [
    { mode: 'auto', label: 'Automático' },
    { mode: 'live', label: 'En vivo' },
    { mode: 'still', label: 'Foto fija' },
  ];

  return (
    <View style={styles.backdrop}>
      <ScrollView style={styles.card} contentContainerStyle={styles.cardContent}>
        <Text style={styles.title}>Sendero {status.version}</Text>
        <Text style={styles.status}>
          Quiosco: {status.kiosk} · Propietario del dispositivo: {status.deviceOwner ? 'sí' : 'no'}
          {'\n'}Silueta de la persona: {status.model} · Máscara: {status.maskRate.toFixed(1)} por segundo
          {'\n'}Música propia: {status.ownTracks} · Tradicional: {status.bundledTracks}
          {status.nowPlaying ? `\nSonando: ${status.nowPlaying}` : ''}
        </Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <Section title="Música">
          <Button label="Importar música de una carpeta" disabled={busy} onPress={() => run(actions.importMusic)} />
          <Button label="Borrar la música importada" disabled={busy} onPress={() => run(actions.clearMusic)} />
          <Toggle label="Mezclar música tradicional" value={settings.mixTraditional} onChange={(v) => set({ mixTraditional: v })} />
          <Stepper label="Volumen de la música" value={settings.musicVolume} onChange={(d) => set({ musicVolume: step(settings.musicVolume, d) })} />
          <Stepper label="Volumen de la voz" value={settings.voiceVolume} onChange={(d) => set({ voiceVolume: step(settings.voiceVolume, d) })} />
        </Section>

        <Section title="Experiencia">
          <View style={styles.row}>
            {modes.map((m) => (
              <Button key={m.mode} label={m.label} selected={settings.maskMode === m.mode} onPress={() => set({ maskMode: m.mode })} />
            ))}
          </View>
          <Toggle label="Mostrar 'Toca la pantalla'" value={settings.showHint} onChange={(v) => set({ showHint: v })} />
          <Button
            label="Probar una visita"
            onPress={() => {
              actions.testVisit();
              onClose();
            }}
          />
        </Section>

        <Section title="Modo quiosco">
          <Button label="Activar el modo quiosco" disabled={busy} onPress={() => run(actions.enterKiosk)} />
          <Button label="Salir del modo quiosco" disabled={busy} onPress={() => run(actions.exitKiosk)} />
          {confirmRelease ? (
            <Button label="Confirmar: liberar el dispositivo" disabled={busy} onPress={() => run(actions.releaseDevice)} />
          ) : (
            <Button label="Liberar el dispositivo" onPress={() => setConfirmRelease(true)} />
          )}
          <Button
            label="Cambiar el PIN"
            onPress={() => {
              setStage('new');
              setNote('Crea el nuevo PIN.');
            }}
          />
        </Section>

        <Button label="Cerrar" onPress={onClose} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Button({ label, onPress, disabled, selected }: { label: string; onPress(): void; disabled?: boolean; selected?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, selected && styles.selected, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return <Button label={`${label}: ${value ? 'sí' : 'no'}`} onPress={() => onChange(!value)} selected={value} />;
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange(delta: number): void }) {
  return (
    <View style={styles.row}>
      <Button label="-" onPress={() => onChange(-0.05)} />
      <Text style={styles.stepper}>
        {label}: {Math.round(value * 100)}%
      </Text>
      <Button label="+" onPress={() => onChange(0.05)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(20, 16, 43, 0.92)', alignItems: 'center', justifyContent: 'center' },
  card: { maxHeight: '92%', width: '62%', backgroundColor: palette.deepViolet, borderRadius: 18, padding: 20 },
  cardContent: { paddingBottom: 12 },
  title: { fontFamily: FONT_TITLE, fontSize: 34, color: palette.marigoldLight, marginBottom: 8 },
  status: { color: palette.warmWhite, fontSize: 16, lineHeight: 24, marginBottom: 8 },
  note: { color: palette.candle, fontSize: 17, marginVertical: 8 },
  pin: { color: palette.warmWhite, fontSize: 40, letterSpacing: 12, textAlign: 'center', marginVertical: 8 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 },
  key: { width: '30%', margin: '1.5%', paddingVertical: 14, borderRadius: 12, backgroundColor: palette.softViolet, alignItems: 'center' },
  keyText: { color: palette.warmWhite, fontSize: 24 },
  section: { marginTop: 14 },
  sectionTitle: { color: palette.marigold, fontSize: 20, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  button: { backgroundColor: palette.softViolet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginVertical: 4, marginRight: 8 },
  selected: { backgroundColor: palette.marigoldDeep },
  disabled: { opacity: 0.5 },
  buttonText: { color: palette.warmWhite, fontSize: 17 },
  stepper: { color: palette.warmWhite, fontSize: 17, marginHorizontal: 8 },
});
