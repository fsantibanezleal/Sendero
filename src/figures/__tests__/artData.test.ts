import { ART } from '../artData';
import { HUMANS, PETS } from '../catalog';

describe('the silhouette drawings', () => {
  it('has at least ten drawings of each archetype and each carries its source and licence', () => {
    for (const kind of [...HUMANS, ...PETS]) {
      expect(ART.filter((a) => a.archetype === kind).length).toBeGreaterThanOrEqual(10);
    }
    for (const a of ART) {
      expect(a.source).toMatch(/^https:/);
      expect(a.licence).not.toBe('');
      expect(a.parts.length).toBeGreaterThan(0);
    }
  });

  it('gives every person a walking drawing and every pet at least two to walk with', () => {
    for (const kind of HUMANS) expect(ART.some((a) => a.archetype === kind && a.view === 'walk')).toBe(true);
    for (const kind of PETS) expect(ART.filter((a) => a.archetype === kind && a.view === 'walk').length).toBeGreaterThanOrEqual(2);
  });
});
