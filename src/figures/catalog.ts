/**
 * The family that waits at the far end of the path: always the four people (a grandmother, a
 * grandfather, a woman and a man) and the two pets (a dog and a cat), each drawn as a new random
 * variant at every visit (looks.ts). One of the four people walks the path, sometimes with one of
 * the pets beside them; a pet never walks alone. No children (owner's decision).
 */

export type HumanKind = 'abuela' | 'abuelo' | 'mujer' | 'hombre';
export type PetKind = 'perro' | 'gato';
export type VoiceId = 'mujer' | 'hombre' | 'mujer-2' | 'hombre-2';

/** The voices of each gender; a visit takes one at random, so the same person does not always sound the same. */
export const VOICES: Record<'mujer' | 'hombre', VoiceId[]> = { mujer: ['mujer', 'mujer-2'], hombre: ['hombre', 'hombre-2'] };

export const HUMANS: readonly HumanKind[] = ['abuela', 'abuelo', 'mujer', 'hombre'];
export const PETS: readonly PetKind[] = ['perro', 'gato'];

/** Probability that the chosen person walks with a pet. */
export const PET_PROBABILITY = 0.35;

/** Gait data group and character per person (research-visuals D4, research-culture D5). */
export const HUMAN_PROFILE: Record<
  HumanKind,
  { gaitGroup: 'young' | 'older'; voice: VoiceId; cadenceHz: number; trunkLeanDeg: number; amplitude: number }
> = {
  abuela: { gaitGroup: 'older', voice: 'mujer', cadenceHz: 0.78, trunkLeanDeg: 9, amplitude: 0.82 },
  abuelo: { gaitGroup: 'older', voice: 'hombre', cadenceHz: 0.8, trunkLeanDeg: 7, amplitude: 0.85 },
  mujer: { gaitGroup: 'young', voice: 'mujer', cadenceHz: 0.92, trunkLeanDeg: 2, amplitude: 1 },
  hombre: { gaitGroup: 'young', voice: 'hombre', cadenceHz: 0.9, trunkLeanDeg: 2, amplitude: 1 },
};

/** A random source in [0, 1): Math.random in the app, a seeded generator in tests. */
export type Rand = () => number;

function pickFrom<T>(rand: Rand, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))];
}

/**
 * Chooses who walks the path: one of the four people of the family, at random, never the same kind
 * of person twice in a row. A pet never walks alone.
 */
export function chooseWalker(rand: Rand, previous: HumanKind | null): HumanKind {
  const pool = previous == null ? HUMANS : HUMANS.filter((h) => h !== previous);
  return pickFrom(rand, pool);
}

/** Chooses the pet that walks beside the person, in about a third of visits; null for none. */
export function chooseCompanion(rand: Rand): PetKind | null {
  return rand() < PET_PROBABILITY ? pickFrom(rand, PETS) : null;
}

/**
 * Draws from a shuffle bag: every item comes out once, in random order, before any comes out again,
 * and a new round never starts with the item that ended the previous one. `bag` holds what is left
 * of the round and is updated in place.
 */
export function drawFromBag<T>(rand: Rand, items: readonly T[], bag: T[], previous: T | null): T {
  for (let i = bag.length - 1; i >= 0; i--) {
    if (!items.includes(bag[i])) bag.splice(i, 1);
  }
  if (bag.length === 0) {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(rand() * (i + 1)));
      [next[i], next[j]] = [next[j], next[i]];
    }
    // The bag is drawn from its end: keep the previous item away from the first draw.
    if (next.length > 1 && next[next.length - 1] === previous) {
      [next[0], next[next.length - 1]] = [next[next.length - 1], next[0]];
    }
    bag.push(...next);
  }
  return bag.pop() as T;
}

/** Chooses a message index from a shuffle bag: every message appears once before any repeats. */
export function chooseMessage(rand: Rand, count: number, bag: number[], previous: number | null): number {
  if (count <= 1) {
    return 0;
  }
  return drawFromBag(
    rand,
    Array.from({ length: count }, (_, i) => i),
    bag,
    previous,
  );
}
