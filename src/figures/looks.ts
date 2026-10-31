/**
 * Variants of the six archetypes (grandmother, grandfather, woman, man, dog, cat). A variant is
 * generated at random for every visit from the parts below, so the family in the upper left is
 * never the same twice: age, height, body shape, hair cut and style, headwear (only sometimes),
 * clothes and what they carry for people; size, build, legs, ears, tail, snout and coat for pets.
 *
 * The parts and their weights per archetype are tables here; the drawing is in draw.ts. Children
 * never appear (owner's decision).
 */
import type { HumanKind, PetKind, Rand } from './catalog';

export type Hair = 'bald' | 'short' | 'long' | 'bun' | 'braids' | 'ponytail' | 'curly' | 'bob' | 'shoulder' | 'pompadour';
export type Headwear = 'none' | 'sombrero' | 'palma' | 'texana' | 'fedora' | 'boina' | 'gorra' | 'rebozo' | 'panuelo' | 'flor';
export type Top = 'plain' | 'jacket' | 'coat' | 'poncho' | 'shawl' | 'rebozo' | 'apron';
export type Bottom = 'trousers' | 'skirt-long' | 'skirt-mid' | 'skirt-knee' | 'skirt-wide' | 'skirt-tight';
export type Carry = 'none' | 'cane' | 'flowers' | 'guitar' | 'bag' | 'basket' | 'candle';

export interface Build {
  /** Height relative to the archetype's base height. */
  height: number;
  /** Torso width and depth (0.85 slim to 1.35 heavy). */
  girth: number;
  /** Extra belly in front, body-height units. */
  belly: number;
  /** Shoulder width factor. */
  shoulders: number;
  /** Limb thickness factor. */
  limbs: number;
  /** Extra forward lean of the trunk, degrees (age). */
  stoop: number;
}

export interface Look {
  human: HumanKind;
  age: number;
  build: Build;
  hair: Hair;
  headwear: Headwear;
  top: Top;
  bottom: Bottom;
  carry: Carry;
  /** The silhouette drawing that shows this person (artData.ts), or null to draw the procedural figure. */
  art: string | null;
  /** The drawing of this person seen from the front, for the farewell. */
  front: string | null;
}

export type Ears = 'up' | 'bat' | 'flop' | 'small';
export type Tail = 'curl' | 'straight' | 'low' | 'stub' | 'plume';

export interface PetLook {
  kind: PetKind;
  /** Size relative to a person's height units (a dog of 0.6 is small, 1.15 large; a cat about 0.58). */
  size: number;
  /** Body length factor. */
  length: number;
  /** Leg length factor (a dachshund is short-legged). */
  legs: number;
  /** Body thickness factor. */
  girth: number;
  ears: Ears;
  tail: Tail;
  /** Snout length factor (cats: muzzle). */
  snout: number;
  /** Long fur: fur tufts on the back, chest and tail. */
  fluffy: boolean;
  /** Sitting or standing while the family waits. */
  sits: boolean;
  /** The silhouette drawing that shows this pet walking, or null to draw the procedural figure. */
  art: string | null;
  /** The drawing that shows it while the family waits, sitting or standing, or null for the procedural figure. */
  still: string | null;
}

/** Height of a pet drawing per unit of size, in person-height units (a size-1 dog stands about 0.4 tall). */
export const PET_ART_HEIGHT = 0.4;

/** Base height of each archetype relative to the tallest (the man). */
export const BASE_HEIGHT: Record<HumanKind, number> = { abuela: 0.92, abuelo: 0.96, mujer: 0.95, hombre: 1 };

type Weights<T extends string> = Partial<Record<T, number>>;

interface HumanTable {
  age: [number, number];
  hair: Weights<Hair>;
  headwear: Weights<Headwear>;
  top: Weights<Top>;
  bottom: Weights<Bottom>;
  carry: Weights<Carry>;
  shoulders: [number, number];
}

/** Parts per archetype and their weights (a weight is a relative chance). */
export const HUMAN_TABLES: Record<HumanKind, HumanTable> = {
  abuela: {
    age: [62, 92],
    hair: { bun: 3, short: 2, curly: 2, braids: 2, bob: 1, long: 1, ponytail: 1, shoulder: 1 },
    headwear: { none: 7, rebozo: 2, panuelo: 1.5, palma: 0.7, flor: 1 },
    top: { plain: 2, shawl: 2, rebozo: 2, jacket: 1.5, coat: 1, poncho: 0.7, apron: 1.5 },
    bottom: { 'skirt-long': 3, 'skirt-mid': 3, 'skirt-wide': 1.5, 'skirt-knee': 1, trousers: 1.5 },
    carry: { none: 4, flowers: 2, basket: 1.5, bag: 1.5, candle: 1 },
    shoulders: [0.9, 1.0],
  },
  abuelo: {
    age: [62, 92],
    hair: { bald: 3, short: 3, curly: 1, ponytail: 0.5, pompadour: 0.5, shoulder: 0.5 },
    headwear: { none: 6, sombrero: 1.2, boina: 1, texana: 0.8, fedora: 0.8, gorra: 0.6 },
    top: { plain: 2, jacket: 2.5, coat: 1.5, poncho: 1.2 },
    bottom: { trousers: 1 },
    carry: { none: 4, flowers: 1.5, guitar: 0.8, bag: 0.6, basket: 0.6, candle: 0.6 },
    shoulders: [0.96, 1.08],
  },
  mujer: {
    age: [22, 58],
    hair: { long: 3, ponytail: 2, bob: 2, curly: 2, braids: 2, bun: 1.5, short: 1, shoulder: 2 },
    headwear: { none: 7, flor: 2, palma: 0.6, panuelo: 0.5, gorra: 0.4 },
    top: { plain: 3, jacket: 2, coat: 1, poncho: 1, rebozo: 1, shawl: 0.5, apron: 0.5 },
    bottom: { 'skirt-knee': 2, 'skirt-wide': 1.5, 'skirt-mid': 1.5, 'skirt-tight': 1, 'skirt-long': 1, trousers: 3 },
    carry: { none: 4, flowers: 2, bag: 2, basket: 1.2, guitar: 0.6, candle: 0.8 },
    shoulders: [0.92, 1.02],
  },
  hombre: {
    age: [22, 58],
    hair: { short: 4, curly: 1.5, pompadour: 1.5, bald: 1, ponytail: 1, long: 1, shoulder: 1 },
    headwear: { none: 6, gorra: 1, sombrero: 0.8, texana: 0.8, fedora: 0.8, boina: 0.5 },
    top: { plain: 3, jacket: 2.5, coat: 1, poncho: 1 },
    bottom: { trousers: 1 },
    carry: { none: 4, flowers: 1.5, guitar: 1.2, bag: 1.2, basket: 0.6, candle: 0.6 },
    shoulders: [1.0, 1.12],
  },
};

function between(rand: Rand, lo: number, hi: number): number {
  return lo + (hi - lo) * rand();
}

/** Picks a key by weight. */
export function weighted<T extends string>(rand: Rand, weights: Weights<T>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}

/** A random variant of a person: age, build, hair, headwear, clothes and what they carry. */
export function randomLook(rand: Rand, human: HumanKind): Look {
  const table = HUMAN_TABLES[human];
  const age = Math.round(between(rand, table.age[0], table.age[1]));
  const elder = human === 'abuela' || human === 'abuelo';
  // Body type: slim, average or heavy; older people stoop more with age.
  const type = weighted(rand, { slim: 3, average: 4.5, heavy: 2.5 });
  const girth = type === 'slim' ? between(rand, 0.84, 0.94) : type === 'average' ? between(rand, 0.95, 1.08) : between(rand, 1.15, 1.35);
  const belly = type === 'heavy' ? between(rand, 0.02, 0.05) : type === 'average' ? between(rand, 0, age > 40 ? 0.025 : 0.01) : 0;
  const stoop = elder ? Math.max(0, ((age - 60) / 32) * 10 + between(rand, -2, 2)) : between(rand, 0, 2);
  const shrink = elder ? 1 - Math.max(0, age - 70) * 0.002 : 1;
  const build: Build = {
    height: Math.min(1.08, Math.max(0.86, (1 + (rand() + rand() + rand() - 1.5) * 0.06) * shrink)),
    girth,
    belly,
    shoulders: between(rand, table.shoulders[0], table.shoulders[1]) * (type === 'heavy' ? 1.05 : 1),
    limbs: 0.86 + (girth - 0.84) * 0.75,
    stoop,
  };
  const carry = elder && rand() < Math.max(0.12, (age - 70) / 25) ? 'cane' : weighted(rand, table.carry);
  return {
    human,
    age,
    build,
    hair: weighted(rand, table.hair),
    headwear: weighted(rand, table.headwear),
    top: weighted(rand, table.top),
    bottom: weighted(rand, table.bottom),
    carry,
    art: null,
    front: null,
  };
}

/** A random variant of a pet: from a chihuahua to a large dog, a slim or a round cat. */
export function randomPetLook(rand: Rand, kind: PetKind): PetLook {
  if (kind === 'perro') {
    const size = between(rand, 0.6, 1.15);
    const shortLegs = rand() < 0.15;
    return {
      kind,
      size,
      length: between(rand, 0.9, 1.15) * (shortLegs ? 1.15 : 1),
      legs: shortLegs ? between(rand, 0.55, 0.7) : between(rand, 0.88, 1.12),
      girth: between(rand, 0.85, 1.3),
      ears: weighted(rand, { up: 2, bat: size < 0.75 ? 3 : 1, flop: 3, small: 1 }),
      tail: weighted(rand, { curl: 2, straight: 2, low: 2, stub: 0.8, plume: 1.5 }),
      snout: between(rand, 0.7, 1.3),
      fluffy: rand() < 0.35,
      sits: rand() < 0.4,
      art: null,
      still: null,
    };
  }
  return {
    kind,
    size: between(rand, 0.5, 0.66),
    length: between(rand, 0.9, 1.15),
    legs: between(rand, 0.85, 1.1),
    girth: between(rand, 0.85, 1.35),
    ears: weighted(rand, { up: 3, small: 1.5 }),
    tail: weighted(rand, { curl: 2, straight: 2, low: 1, plume: 1.5 }),
    snout: between(rand, 0.85, 1.15),
    fluffy: rand() < 0.35,
    sits: rand() < 0.6,
    art: null,
    still: null,
  };
}

/** One line describing a person's variant (for the system log). */
export function describeLook(l: Look): string {
  return `${l.human} ${l.age} (${l.hair}, ${l.headwear}, ${l.top}, ${l.bottom}, ${l.carry}, girth ${l.build.girth.toFixed(2)})`;
}

/** One line describing a pet's variant (for the system log). */
export function describePet(p: PetLook): string {
  return `${p.kind} (size ${p.size.toFixed(2)}, ears ${p.ears}, tail ${p.tail}${p.fluffy ? ', fluffy' : ''})`;
}

/**
 * The height of a person's silhouette with what is on their head, as a multiple of the transform's
 * height: the archetype's base height, the variant's height, and the crown of a hat or the volume of
 * the hair above the head (draw.ts).
 */
export function silhouetteTop(look: Look): number {
  'worklet';
  const hat =
    look.headwear === 'sombrero' ? 0.08 : look.headwear === 'texana' || look.headwear === 'fedora' || look.headwear === 'palma' ? 0.068 : look.headwear === 'gorra' || look.headwear === 'boina' ? 0.025 : 0;
  const hair = look.hair === 'curly' ? 0.03 : look.hair === 'bun' || look.hair === 'pompadour' ? 0.038 : 0;
  const cover = look.headwear === 'rebozo' || look.headwear === 'panuelo' ? 0.022 : look.headwear === 'flor' ? 0.012 : 0;
  const carried = look.carry === 'guitar' ? 0.07 : 0;
  // A drawing is normalized to height 1, hat and hair included.
  if (look.art != null) return BASE_HEIGHT[look.human] * look.build.height;
  return BASE_HEIGHT[look.human] * look.build.height * (1 + Math.max(hat, hair, cover, carried));
}
