import * as api from '../index';

describe('procedural index', () => {
  it('re-exports the public API', () => {
    const names = [
      'add',
      'mulberry32',
      'hashSeed',
      'createNoise2D',
      'fbm2',
      'GOLDEN_ANGLE',
      'vogel',
      'catmullRomBeziers',
      'sampleBeziers',
      'catmullRomPolyline',
      'buildArcTable',
      'pointAtDistance',
      'pointAtFraction',
      'poissonDisk',
      'smoothstep',
      'pingPong',
    ];
    for (const name of names) {
      expect(api).toHaveProperty(name);
    }
  });
});
