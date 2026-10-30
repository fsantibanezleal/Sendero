import { gaussian, hashSeed, mulberry32, pick, randInt, randRange, shuffle } from '../random';

// Computed once from the reference mulberry32 implementation (seed 1) and fixed here.
const FIRST_THREE_SEED_1: number[] = [0.6270739405881613, 0.002735721180215478, 0.5274470399599522];

describe('random', () => {
  it('mulberry32 is deterministic and fixed for seed 1', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    const va = [a(), a(), a()];
    const vb = [b(), b(), b()];
    expect(va).toEqual(vb);
    expect(va).toEqual(FIRST_THREE_SEED_1);
  });

  it('different seeds differ and values are in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randRange and randInt stay in range, randInt is inclusive', () => {
    const r = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const f = randRange(r, 2, 3);
      expect(f).toBeGreaterThanOrEqual(2);
      expect(f).toBeLessThan(3);
      seen.add(randInt(r, 1, 3));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('pick throws on empty and returns members', () => {
    expect(() => pick(mulberry32(1), [])).toThrow(RangeError);
    expect(['a', 'b']).toContain(pick(mulberry32(1), ['a', 'b']));
  });

  it('shuffle is a permutation and does not mutate', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const copy = [...items];
    const out = shuffle(mulberry32(3), items);
    expect(items).toEqual(copy);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
    expect(out).not.toEqual(items);
  });

  it('gaussian has mean 0 and sd 1', () => {
    const r = mulberry32(11);
    const n = 20000;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const g = gaussian(r);
      sum += g;
      sq += g * g;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });

  it('hashSeed is FNV-1a 32-bit', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('foobar')).toBe(0xbf9cf968);
    expect(hashSeed('x')).toBe(hashSeed('x'));
    expect(hashSeed('x')).not.toBe(hashSeed('y'));
  });
});
