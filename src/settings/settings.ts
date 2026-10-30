/**
 * Staff settings, kept in the app's private storage (settings.json in the document directory).
 * Nothing here leaves the tablet. The PIN is stored only as a salted SHA-256 hash (src/kiosk/pin.ts).
 */
import { File, Paths } from 'expo-file-system';

export type MaskMode = 'auto' | 'live' | 'still';

export interface Settings {
  version: 1;
  pin: { salt: string; hash: string } | null;
  musicVolume: number;
  voiceVolume: number;
  maskMode: MaskMode;
  mixTraditional: boolean;
  /** Show the gentle "Toca la pantalla" hint while waiting. */
  showHint: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  pin: null,
  musicVolume: 0.8,
  voiceVolume: 0.9,
  maskMode: 'auto',
  mixTraditional: true,
  showHint: true,
};

/** Merges a parsed object over the defaults, keeping only known, well-typed fields. */
export function sanitize(raw: unknown): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (raw == null || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  const unit = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
  s.musicVolume = unit(r.musicVolume, s.musicVolume);
  s.voiceVolume = unit(r.voiceVolume, s.voiceVolume);
  if (r.maskMode === 'auto' || r.maskMode === 'live' || r.maskMode === 'still') s.maskMode = r.maskMode;
  if (typeof r.mixTraditional === 'boolean') s.mixTraditional = r.mixTraditional;
  if (typeof r.showHint === 'boolean') s.showHint = r.showHint;
  const pin = r.pin as Record<string, unknown> | null | undefined;
  if (pin != null && typeof pin.salt === 'string' && typeof pin.hash === 'string') {
    s.pin = { salt: pin.salt, hash: pin.hash };
  }
  return s;
}

function settingsFile(): File {
  return new File(Paths.document, 'settings.json');
}

export function loadSettings(): Settings {
  try {
    const f = settingsFile();
    if (!f.exists) return { ...DEFAULT_SETTINGS };
    return sanitize(JSON.parse(f.textSync()));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  const f = settingsFile();
  if (!f.exists) f.create();
  f.write(JSON.stringify(s, null, 2));
}
