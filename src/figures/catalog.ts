/**
 * The figures that walk the petal path. Grandparents and adults only: no children (owner's
 * decision). Pets never walk alone: a dog or a cat always walks beside a person.
 */

export type HumanKind = 'abuela' | 'abuelo' | 'mujer' | 'hombre';
export type PetKind = 'perro' | 'gato';
export type VoiceId = 'mujer' | 'hombre';

export interface CompanionGroup {
  human: HumanKind;
  pet: PetKind | null;
}

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

/** Chooses the group that walks, never repeating the previous person kind. */
export function chooseGroup(rand: Rand, previous: HumanKind | null): CompanionGroup {
  const pool = previous == null ? HUMANS : HUMANS.filter((h) => h !== previous);
  const human = pickFrom(rand, pool);
  const pet = rand() < PET_PROBABILITY ? pickFrom(rand, PETS) : null;
  return { human, pet };
}

/**
 * The silhouettes that gather at the far end of the path: the chosen group first, then two to
 * four more groups of other people (pets only beside a person).
 */
export function gatherGroups(rand: Rand, chosen: CompanionGroup): CompanionGroup[] {
  const extra = 2 + Math.floor(rand() * 3);
  const groups: CompanionGroup[] = [chosen];
  for (let i = 0; i < extra; i++) {
    const human = pickFrom(rand, HUMANS);
    const pet = rand() < PET_PROBABILITY * 0.6 ? pickFrom(rand, PETS) : null;
    groups.push({ human, pet });
  }
  return groups;
}

/** Chooses a message index, never repeating the previous one. */
export function chooseMessage(rand: Rand, count: number, previous: number | null): number {
  if (count <= 1) {
    return 0;
  }
  let i = Math.floor(rand() * (previous == null ? count : count - 1));
  if (previous != null && i >= previous) {
    i += 1;
  }
  return Math.min(i, count - 1);
}
