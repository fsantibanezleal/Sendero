/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Functions in these modules are called from UI-thread callbacks (derived values, frame callbacks).
 * A plain function called there crashes the app ("Tried to synchronously call a Remote Function"),
 * which Jest cannot see because it runs everything on one thread. So every function in these modules
 * must start with the 'worklet' directive, except the few that only run once on the JS thread.
 */
const MODULES = [
  'src/figures/draw.ts',
  'src/figures/style.ts',
  'src/figures/rig.ts',
  'src/figures/fourier.ts',
  'src/experience/layout.ts',
  'src/experience/timeline.ts',
  'src/scene/revealGeometry.ts',
  'src/procedural/easing.ts',
  'src/procedural/arclength.ts',
];
/** Functions that only run on the JS thread (in useMemo), never inside a UI-thread callback. */
const JS_ONLY = new Set(['computeLayout', 'buildArcTable']);

describe('UI-thread modules', () => {
  it('mark every function as a worklet', () => {
    const fs = require('fs');
    const missing: string[] = [];
    for (const file of MODULES) {
      const text: string = fs.readFileSync(file, 'utf8');
      const re = /^(?:export )?function (\w+)\([^)]*\)[^{]*\{\n(.*)/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) != null) {
        if (!JS_ONLY.has(m[1]) && m[2].trim() !== "'worklet';") missing.push(`${file}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps silhouetteTop a worklet (the farewell's height uses it)", () => {
    const text: string = require('fs').readFileSync('src/figures/looks.ts', 'utf8');
    expect(text).toMatch(/export function silhouetteTop\(look: Look\): number \{\n {2}'worklet';/);
  });
});
