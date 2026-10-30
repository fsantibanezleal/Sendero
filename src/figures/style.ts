/** How a person's variant moves: older and stooped people lean, people carrying something swing less. */
import { HUMAN_PROFILE } from './catalog';
import type { Look } from './looks';
import type { RigStyle } from './rig';

/** The rig style of a person's variant, walking or standing. */
export function rigStyle(look: Look, standing: boolean): RigStyle {
  'worklet';
  const p = HUMAN_PROFILE[look.human];
  return {
    trunkLeanDeg: p.trunkLeanDeg * (standing ? 0.6 : 1) + look.build.stoop,
    amplitude: standing ? 1 : p.amplitude * (look.carry === 'cane' ? 0.92 : 1),
    armSwing: standing ? 0 : look.carry === 'none' || look.carry === 'bag' || look.carry === 'guitar' ? 0.8 : 0.45,
    headForward: (p.gaitGroup === 'older' ? 0.012 : 0) + look.build.stoop * 0.0008,
  };
}
