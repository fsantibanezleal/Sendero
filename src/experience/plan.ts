/**
 * The pure parts of a visit (plans/sendero plan.md section 3): choosing the next visit while the
 * altar waits, and the marks of the timeline that carry side effects. No React, no native runtime,
 * so they are tested directly.
 */
import { MESSAGES } from '../content/messages';
import { chooseCompanion, chooseMessage, chooseWalker, HUMAN_PROFILE, HUMANS, type HumanKind, type PetKind, PETS, type Rand, type VoiceId } from '../figures/catalog';
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
}

export function emptyHistory(): History {
  return { human: null, message: null, count: 0, messageBag: [] };
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
  const people = HUMANS.map((kind) => randomLook(random, kind));
  const pets = PETS.map((kind) => randomPetLook(random, kind));
  const walkerKind = chooseWalker(random, h.human);
  const companionKind: PetKind | null = chooseCompanion(random);
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
