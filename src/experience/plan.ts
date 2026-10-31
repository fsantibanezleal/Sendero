/**
 * The pure parts of a visit (plans/sendero plan.md section 3): choosing the next visit while the
 * altar waits, and the marks of the timeline that carry side effects. No React, no native runtime,
 * so they are tested directly.
 */
import { MESSAGES } from '../content/messages';
import { chooseCompanion, chooseMessage, chooseWalker, HUMAN_PROFILE, HUMANS, type HumanKind, type PetKind, PETS, type Rand, type VoiceId } from '../figures/catalog';
import { ART, artOf, FRONT_ART } from '../figures/artData';
import { type Look, type PetLook, randomLook, randomPetLook } from '../figures/looks';
import { TIMELINE } from './timeline';

export interface Visit {
  id: number;
  /** The four people of this visit, in the order of HUMANS, each a new random variant. */
  people: Look[];
  /** The dog and the cat of this visit, in the order of PETS. */
  pets: PetLook[];
  /** Who walks the path (an index into people). */
  walker: number;
  /** The pet that walks beside them (an index into pets), or null. */
  companion: number | null;
  /** Where each figure waits in the upper left: a spot index for people 0 to 3 and pets 4 and 5. */
  spots: number[];
  messageIndex: number;
  voice: VoiceId;
  /** Seed of this visit's petal path, so every visit draws a different path. */
  pathSeed: number;
}

/** The marks of the timeline that have side effects, in order (stage k = marks 1..k passed). */
export const MARKS = [TIMELINE.mask.start, TIMELINE.reveal.start, TIMELINE.message.start, TIMELINE.whisperAt, TIMELINE.return.start] as const;
export const MARK_NAMES = ['mask on', 'reveal', 'message', 'whisper', 'return'] as const;
export const LAST_STAGE = MARKS.length;

/** -1 while idle; otherwise the number of marks the clock has passed. */
export function stageAt(t: number): number {
  'worklet';
  if (t < 0) return -1;
  let n = 0;
  for (let i = 0; i < MARKS.length; i++) {
    if (t >= MARKS[i]) n = i + 1;
  }
  return n;
}

export interface History {
  human: HumanKind | null;
  message: number | null;
  count: number;
  /** Messages not shown yet in the current round (a shuffle bag). */
  messageBag: number[];
  /** The drawing each figure showed last, so the next visit shows another one. */
  lastArt: Record<string, string>;
}

/** A drawing for a figure, chosen at random among those given, never the one it showed last. */
function pickFrom(random: Rand, all: string[], last: string | undefined): string | null {
  if (all.length === 0) return null;
  const pool = all.length > 1 && last != null ? all.filter((id) => id !== last) : all;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** A walking drawing for a figure: seen from the side where the figure has such drawings. */
export function pickArt(random: Rand, kind: HumanKind | PetKind, last: string | undefined): string | null {
  const front = FRONT_ART[kind] ?? [];
  const all = artOf(kind, 'walk').map((a) => a.id);
  const side = all.filter((id) => !front.includes(id));
  return pickFrom(random, side.length > 0 ? side : all, last);
}

/** A drawing of a person from the front, for the farewell. */
function pickFront(random: Rand, kind: HumanKind, last: string | undefined): string | null {
  return pickFrom(random, [...(FRONT_ART[kind] ?? [])], last);
}

/** A drawing for a pet that waits with the family: any of its drawings, sitting or standing. */
function pickStillArt(random: Rand, kind: PetKind, last: string | undefined): string | null {
  return pickFrom(random, ART.filter((a) => a.archetype === kind).map((a) => a.id), last);
}

export function emptyHistory(): History {
  return { human: null, message: null, count: 0, messageBag: [], lastArt: {} };
}

/** Number of places in the upper left: four for the people, two in front for the pets. */
export const PEOPLE_SPOTS = 4;
export const PET_SPOTS = 2;

function shuffledIndices(random: Rand, n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Plans the next visit: a new random variant of each of the six figures, their places in the upper
 * left, who walks (one of the four people, never the same kind twice in a row), whether a pet
 * walks beside them, the message (never the same twice in a row) and the seed of the petal path.
 */
export function planVisit(h: History, random: Rand = Math.random): Visit {
  const people = HUMANS.map((kind) => ({
    ...randomLook(random, kind),
    art: pickArt(random, kind, h.lastArt[kind]),
    front: pickFront(random, kind, h.lastArt[`${kind}:front`]),
  }));
  for (const p of people) {
    if (p.front != null) h.lastArt[`${p.human}:front`] = p.front;
  }
  const pets = PETS.map((kind) => ({
    ...randomPetLook(random, kind),
    art: pickArt(random, kind, h.lastArt[kind]),
    still: pickStillArt(random, kind, h.lastArt[`${kind}:still`]),
  }));
  for (const f of [...people.map((p) => ({ k: p.human as string, a: p.art })), ...pets.map((p) => ({ k: p.kind as string, a: p.art }))]) {
    if (f.a != null) h.lastArt[f.k] = f.a;
  }
  const walkerKind = chooseWalker(random, h.human);
  // The person who walks is the same drawing in the family, on the path and beside the frame (the owner, 2026-10-31).
  const walkerLook = people[HUMANS.indexOf(walkerKind)];
  if (walkerLook.front != null) walkerLook.art = walkerLook.front;
  const companionKind: PetKind | null = chooseCompanion(random);
  for (const p of pets) {
    if (p.still != null) h.lastArt[`${p.kind}:still`] = p.still;
    // The pet that walks is the same drawing while it waits, on the path and beside the frame.
    if (p.kind === companionKind) p.still = p.art;
  }
  const messageIndex = chooseMessage(random, MESSAGES.length, h.messageBag, h.message);
  const spots = [...shuffledIndices(random, PEOPLE_SPOTS), ...shuffledIndices(random, PET_SPOTS).map((i) => PEOPLE_SPOTS + i)];
  h.human = walkerKind;
  h.message = messageIndex;
  h.count += 1;
  return {
    id: h.count,
    people,
    pets,
    walker: HUMANS.indexOf(walkerKind),
    companion: companionKind == null ? null : PETS.indexOf(companionKind),
    spots,
    messageIndex,
    voice: HUMAN_PROFILE[walkerKind].voice,
    pathSeed: Math.floor(random() * 2 ** 31),
  };
}
