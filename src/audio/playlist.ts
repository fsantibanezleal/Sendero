/**
 * The playlist: the owner's own tracks (imported on the tablet, never in the repository) and the
 * bundled public-domain recordings (assets/music). When the owner has imported music it leads,
 * with one traditional recording after every OWN_PER_TRADITIONAL of the owner's tracks, so the
 * film music and "similar deep related music" sound all the time (plans/sendero plan.md).
 */

export interface Track {
  id: string;
  title: string;
  /** A bundled asset (require id) or a file URI. */
  source: number | string;
  origin: 'own' | 'bundled';
}

export const OWN_PER_TRADITIONAL = 2;

/** Fisher-Yates shuffle with an injected random source. */
export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * One full round of the playlist. With no own tracks: the bundled set, shuffled. With own tracks
 * and `mixTraditional`: own tracks shuffled, a bundled one after every OWN_PER_TRADITIONAL. With
 * own tracks and no mixing: own tracks only.
 */
export function buildRound(own: readonly Track[], bundled: readonly Track[], mixTraditional: boolean, rand: () => number): Track[] {
  const b = shuffled(bundled, rand);
  if (own.length === 0) {
    return b;
  }
  const o = shuffled(own, rand);
  if (!mixTraditional || b.length === 0) {
    return o;
  }
  const out: Track[] = [];
  let bi = 0;
  for (let i = 0; i < o.length; i++) {
    out.push(o[i]);
    if ((i + 1) % OWN_PER_TRADITIONAL === 0) {
      out.push(b[bi % b.length]);
      bi++;
    }
  }
  return out;
}

/** Equal-power crossfade gains at progress u in [0, 1]: [outgoing, incoming]. */
export function equalPower(u: number): [number, number] {
  const x = Math.max(0, Math.min(1, u));
  return [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)];
}

/** Linear gain for a level in decibels. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** File extensions the importer accepts. */
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac'];

export function isAudioFile(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot > 0 && AUDIO_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}

/** A readable title from a file name: no extension, underscores and dashes as spaces. */
export function titleFromFile(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
