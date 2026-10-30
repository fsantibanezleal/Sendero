/**
 * The owner's own music on the tablet (never in the repository; ASSETS.md).
 *
 * Two ways in, both ending as plain files the player can open at any time:
 * 1. Staff panel: pick a folder (Storage Access Framework); every audio file in it is COPIED into
 *    the app's private storage, because persisted folder grants are not documented for
 *    expo-file-system (research-android D4).
 * 2. By cable: `scripts/push-music` copies files into the app's external files folder
 *    (Android/data/<package>/files/music), which the app reads without any permission.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { externalMusicDirectory } from '../kiosk/kiosk';
import { isAudioFile, titleFromFile, type Track } from './playlist';

function privateMusicDir(): Directory {
  const d = new Directory(Paths.document, 'music');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

function filesIn(dir: Directory): File[] {
  try {
    return dir.list().filter((e): e is File => e instanceof File && isAudioFile(e.name));
  } catch {
    return [];
  }
}

/** Every own track available now: private copies plus files pushed by cable. */
export function ownTracks(): Track[] {
  const out: Track[] = [];
  const seen = new Set<string>();
  const dirs: Directory[] = [privateMusicDir()];
  const external = externalMusicDirectory();
  if (external) {
    const ext = new Directory(external.startsWith('file://') ? external : `file://${external}`);
    if (ext.exists) dirs.push(ext);
  }
  for (const dir of dirs) {
    for (const f of filesIn(dir)) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      out.push({ id: `own:${f.name}`, title: titleFromFile(f.name), source: f.uri, origin: 'own' });
    }
  }
  return out;
}

export interface ImportResult {
  copied: number;
  skipped: number;
  failed: number;
}

/** Lets staff pick a folder and copies its audio files into private storage. */
export async function importFromPickedFolder(): Promise<ImportResult> {
  const picked = await Directory.pickDirectoryAsync();
  const target = privateMusicDir();
  const result: ImportResult = { copied: 0, skipped: 0, failed: 0 };
  for (const f of filesIn(picked)) {
    const dest = new File(target, f.name);
    if (dest.exists) {
      result.skipped += 1;
      continue;
    }
    try {
      await f.copy(dest);
      result.copied += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

/** Removes every private copy (staff panel). Files pushed by cable stay. */
export function clearImportedMusic(): number {
  const dir = privateMusicDir();
  const files = filesIn(dir);
  for (const f of files) f.delete();
  return files.length;
}
