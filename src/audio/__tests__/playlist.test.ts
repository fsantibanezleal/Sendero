import { buildRound, dbToGain, equalPower, isAudioFile, titleFromFile, type Track } from '../playlist';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const own: Track[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id, source: `file:///${id}.mp3`, origin: 'own' }));
const bundled: Track[] = ['x', 'y', 'z'].map((id, i) => ({ id, title: id, source: i + 1, origin: 'bundled' }));

describe('playlist', () => {
  it('plays the bundled set when nothing was imported', () => {
    const round = buildRound([], bundled, true, lcg(1));
    expect(round.map((t) => t.id).sort()).toEqual(['x', 'y', 'z']);
  });

  it('leads with the owner tracks and adds one traditional after every two', () => {
    const round = buildRound(own, bundled, true, lcg(2));
    expect(round.filter((t) => t.origin === 'own')).toHaveLength(5);
    expect(round.filter((t) => t.origin === 'bundled')).toHaveLength(2);
    expect(round[0].origin).toBe('own');
    expect(round[1].origin).toBe('own');
    expect(round[2].origin).toBe('bundled');
    for (let i = 1; i < round.length; i++) {
      expect(round[i].origin === 'bundled' && round[i - 1].origin === 'bundled').toBe(false);
    }
  });

  it('plays only the owner tracks when mixing is off', () => {
    const round = buildRound(own, bundled, false, lcg(3));
    expect(round.every((t) => t.origin === 'own')).toBe(true);
    expect(round).toHaveLength(5);
  });

  it('crossfades at constant power', () => {
    for (let i = 0; i <= 20; i++) {
      const [out, inc] = equalPower(i / 20);
      expect(out * out + inc * inc).toBeCloseTo(1, 9);
    }
    expect(equalPower(0)).toEqual([1, 0]);
    expect(equalPower(1)[0]).toBeCloseTo(0, 9);
  });

  it('converts decibels to gain', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(dbToGain(-20)).toBeCloseTo(0.1, 6);
  });

  it('accepts audio files and makes readable titles', () => {
    expect(isAudioFile('Recuerdame.MP3')).toBe(true);
    expect(isAudioFile('cover.jpg')).toBe(false);
    expect(isAudioFile('.hidden')).toBe(false);
    expect(titleFromFile('01_Recuerdame-Carlos_Rivera.m4a')).toBe('01 Recuerdame Carlos Rivera');
  });
});
