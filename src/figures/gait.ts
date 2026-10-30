/**
 * Gait curves: sagittal joint angles over one gait cycle, as Fourier series fitted to the group
 * means of Fukuchi, Fukuchi and Duarte (2018), PeerJ 6:e4640, DOI 10.7717/peerj.4640, data
 * CC BY 4.0 (pipeline/gait/fit.py writes data/gait/fukuchi2018-sagittal.json; docs/gait.md).
 *
 * Phase p in [0, 1) starts at the right heel strike. Angles in degrees, anatomical convention:
 * hip and knee flexion positive, ankle dorsiflexion positive, pelvis anterior tilt positive.
 */
import gaitData from '../../data/gait/fukuchi2018-sagittal.json';

import type { GaitCurves } from './fourier';

export type { FourierCurve, GaitCurves } from './fourier';
export { evalFourier } from './fourier';

export type GaitGroup = 'young' | 'older';

interface GaitFile {
  groups: Record<GaitGroup, { curves: GaitCurves }>;
}

const DATA = gaitData as unknown as GaitFile;

export function gaitCurves(group: GaitGroup): GaitCurves {
  return DATA.groups[group].curves;
}
