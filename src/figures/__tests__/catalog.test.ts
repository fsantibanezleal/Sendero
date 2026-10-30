import { displayText, MESSAGES } from '../../content/messages';
import { chooseGroup, chooseMessage, gatherGroups, HUMAN_PROFILE, HUMANS } from '../catalog';

/** A tiny deterministic generator for the tests (LCG). */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('figure catalog', () => {
  it('never chooses a child and never lets a pet walk alone', () => {
    const rand = lcg(7);
    for (let i = 0; i < 500; i++) {
      const g = chooseGroup(rand, null);
      expect(HUMANS).toContain(g.human);
      for (const extra of gatherGroups(rand, g)) {
        expect(HUMANS).toContain(extra.human);
      }
    }
    expect(HUMANS).not.toContain('nino' as never);
  });

  it('does not repeat the previous person kind', () => {
    const rand = lcg(3);
    let previous = chooseGroup(rand, null).human;
    for (let i = 0; i < 300; i++) {
      const next = chooseGroup(rand, previous).human;
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('gathers three to five groups with the chosen one first', () => {
    const rand = lcg(11);
    for (let i = 0; i < 200; i++) {
      const chosen = chooseGroup(rand, null);
      const groups = gatherGroups(rand, chosen);
      expect(groups[0]).toBe(chosen);
      expect(groups.length).toBeGreaterThanOrEqual(3);
      expect(groups.length).toBeLessThanOrEqual(5);
    }
  });

  it('chooses every person kind and pets sometimes', () => {
    const rand = lcg(5);
    const seen = new Set<string>();
    let pets = 0;
    for (let i = 0; i < 400; i++) {
      const g = chooseGroup(rand, null);
      seen.add(g.human);
      if (g.pet) pets++;
    }
    expect(seen.size).toBe(4);
    expect(pets / 400).toBeGreaterThan(0.2);
    expect(pets / 400).toBeLessThan(0.5);
  });

  it('matches the voice to the person', () => {
    expect(HUMAN_PROFILE.abuela.voice).toBe('mujer');
    expect(HUMAN_PROFILE.mujer.voice).toBe('mujer');
    expect(HUMAN_PROFILE.abuelo.voice).toBe('hombre');
    expect(HUMAN_PROFILE.hombre.voice).toBe('hombre');
  });
});

describe('messages', () => {
  it('keeps the seven messages verbatim', () => {
    expect(MESSAGES.map((m) => m.text)).toEqual([
      'siempre te recordaré',
      'siempre en mis pensamientos',
      'gracias',
      'sigue así',
      'lo estás haciendo bien',
      'descansa, lo estás haciendo bien',
      'también te extraño',
    ]);
  });

  it('capitalizes only the first letter for display', () => {
    expect(displayText(MESSAGES[0])).toBe('Siempre te recordaré');
    expect(displayText(MESSAGES[5])).toBe('Descansa, lo estás haciendo bien');
  });

  it('never repeats the previous message and covers all of them', () => {
    const rand = lcg(9);
    let previous: number | null = null;
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const next = chooseMessage(rand, MESSAGES.length, previous);
      expect(next).not.toBe(previous);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(MESSAGES.length);
      seen.add(next);
      previous = next;
    }
    expect(seen.size).toBe(MESSAGES.length);
  });
});
