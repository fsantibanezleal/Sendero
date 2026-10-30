import { displayText, MESSAGES } from '../../content/messages';
import { chooseCompanion, chooseMessage, chooseWalker, drawFromBag, HUMAN_PROFILE, HUMANS, PETS } from '../catalog';

/** A tiny deterministic generator for the tests (LCG). */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('who walks', () => {
  it('is always one of the four people, never a child, never the same kind twice in a row', () => {
    const rand = lcg(3);
    let previous = chooseWalker(rand, null);
    const seen = new Set<string>([previous]);
    for (let i = 0; i < 400; i++) {
      const next = chooseWalker(rand, previous);
      expect(HUMANS).toContain(next);
      expect(next).not.toBe(previous);
      seen.add(next);
      previous = next;
    }
    expect(seen.size).toBe(4);
    expect(HUMANS).not.toContain('nino' as never);
  });

  it('has a pet beside them in about a third of visits, never a pet alone', () => {
    const rand = lcg(5);
    let pets = 0;
    for (let i = 0; i < 1000; i++) {
      const p = chooseCompanion(rand);
      if (p != null) {
        expect(PETS).toContain(p);
        pets++;
      }
    }
    expect(pets / 1000).toBeGreaterThan(0.25);
    expect(pets / 1000).toBeLessThan(0.45);
  });

  it('matches the voice to the person', () => {
    expect(HUMAN_PROFILE.abuela.voice).toBe('mujer');
    expect(HUMAN_PROFILE.mujer.voice).toBe('mujer');
    expect(HUMAN_PROFILE.abuelo.voice).toBe('hombre');
    expect(HUMAN_PROFILE.hombre.voice).toBe('hombre');
  });
});

describe('messages', () => {
  it("keeps the owner's seven messages verbatim and has at least fifty, all different", () => {
    expect(MESSAGES.slice(0, 7).map((m) => m.text)).toEqual([
      'siempre te recordaré',
      'siempre en mis pensamientos',
      'gracias',
      'sigue así',
      'lo estás haciendo bien',
      'descansa, lo estás haciendo bien',
      'también te extraño',
    ]);
    expect(MESSAGES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(MESSAGES.map((m) => m.text)).size).toBe(MESSAGES.length);
    expect(new Set(MESSAGES.map((m) => m.id)).size).toBe(MESSAGES.length);
  });

  it('never uses the forms the culture research excluded, nor gendered words about the visitor', () => {
    for (const m of MESSAGES) {
      expect(m.text).not.toMatch(/te espero|nos vemos pronto|perdóname/);
      expect(m.text).not.toMatch(/\b(querid[oa]|solit[oa]|bonit[oa] estás|orgullos[oa])\b/);
      expect(m.text.length).toBeLessThanOrEqual(40);
    }
  });

  it('capitalizes only the first letter for display', () => {
    expect(displayText(MESSAGES[0])).toBe('Siempre te recordaré');
    expect(displayText(MESSAGES[5])).toBe('Descansa, lo estás haciendo bien');
  });

  it('shows every message once before any repeats, never the same twice in a row', () => {
    const rand = lcg(9);
    const bag: number[] = [];
    let previous: number | null = null;
    for (let round = 0; round < 5; round++) {
      const seen = new Set<number>();
      for (let i = 0; i < MESSAGES.length; i++) {
        const next = chooseMessage(rand, MESSAGES.length, bag, previous);
        expect(next).not.toBe(previous);
        expect(seen.has(next)).toBe(false);
        seen.add(next);
        previous = next;
      }
      expect(seen.size).toBe(MESSAGES.length);
    }
  });

  it('drops items no longer offered from a bag', () => {
    const bag = [0, 1, 9];
    const next = drawFromBag(lcg(1), [0, 1, 2], bag, null);
    expect([0, 1]).toContain(next);
    expect(bag).not.toContain(9);
  });
});
