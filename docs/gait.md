# Gait curves

The silhouettes of grandparents and adults that walk toward the visitor are a 2D cutout rig. Its joint angles are
not invented: they come from measured human walking, reduced to a few numbers per curve that loop exactly.

## The dataset

Fukuchi CA, Fukuchi RK, Duarte M (2018) A public dataset of overground and treadmill walking kinematics and
kinetics in healthy individuals. PeerJ 6:e4640, https://doi.org/10.7717/peerj.4640 (paper:
https://pmc.ncbi.nlm.nih.gov/articles/PMC5922232/). Data: https://doi.org/10.6084/m9.figshare.5722711, licence
CC BY 4.0 (attribute the authors, the title, PeerJ and the DOI; `ASSETS.md` carries the attribution).

42 healthy adults walked overground at slow, comfortable and fast speeds (30 percent under and over the
comfortable one) and on a treadmill at eight speeds. Kinematics were captured at 150 Hz with a 26-marker set and
time-normalised to 101 points per gait cycle. Sendero uses the overground comfortable-speed joint angle files
`51subjs/WBDS<NN>walkOCang.txt` (tab separated, `Time` 0 to 100 percent, then X, Y, Z angle columns per segment and
joint in degrees; the folder name `51subjs` is the dataset's own, and 42 subjects have the overground angle file).

Groups, from the age in `WBDSinfo.csv`:

| Group | Rule | Subjects | Mean age |
|---|---|---|---|
| young | under 40 | 24 | 27.6 years |
| older | 50 and over | 18 | 62.7 years |

The older group is mid-aged, not 75 and over, so a grandparent look needs amplitude scaling and a stooped posture
in the rig on top of these curves; the curves are the honest measured baseline. No subject file had missing values
(0 skipped).

## Columns and sign convention

The sagittal (flexion and extension) component is the `Z` column of each right-side joint:
`RPelvisAngleZ`, `RHipAngleZ`, `RKneeAngleZ`, `RAnkleAngleZ`. X and Y are the frontal and transverse components
(the X and Y ranges of the hip and knee are a few degrees to about 24 degrees of rotation, with no flexion shape).
The dataset already uses the anatomical convention, so nothing is negated: hip and knee flexion positive, ankle
dorsiflexion positive, pelvis anterior tilt positive. Observed ranges of the group mean (degrees):

| Curve | Young | Older | Expected |
|---|---|---|---|
| hip flexion | -7.8 to 31.9 | -9.9 to 32.9 | about +30 at initial contact to about -10 near 50 percent |
| knee flexion | -1.4 to 62.2 | 1.7 to 64.2 | peak about 55 to 65 near 70 percent, no hyperextension in swing |
| ankle dorsiflexion | -13.0 to 13.2 | -9.8 to 14.1 | between about -20 and +15 |
| pelvis tilt | 9.5 to 11.4 | 8.0 to 9.9 | small oscillation about a mean anterior tilt |

`pipeline/gait/fit.py` fails when the hip is not flexed at initial contact and extended near 50 percent, when the
knee peak is outside 50 to 70 degrees or hyperextends, or when the ankle leaves -20 to +15 degrees, so a wrong sign
cannot be committed silently. The pelvis sign rests on the dataset's convention and the usual 8 to 11 degree
anterior tilt; the paper figures were not compared curve by curve.

## Fourier representation

Each curve over the phase p in [0, 1) is

    angle(p) = a0 + sum over k = 1..6 of ( a_k cos(2 pi k p) + b_k sin(2 pi k p) )

fitted by least squares on the 100 samples p = 0, 0.01, ..., 0.99 (the 101st sample repeats the first point of the
cycle). Order 6 is 13 numbers per curve and loops exactly at p = 1. Fit error (RMS, degrees; target under 1.5):

| Curve | Young | Older |
|---|---|---|
| pelvis tilt | 0.036 | 0.032 |
| hip flexion | 0.111 | 0.125 |
| knee flexion | 0.259 | 0.257 |
| ankle dorsiflexion | 0.597 | 0.688 |

The mean curve against the fitted curve, per group, is written to the data root as `gait/fit-check.csv` for
inspection. The output `data/gait/fukuchi2018-sagittal.json` has the shape fixed by the contract: `version`,
`source`, `order`, `units`, `convention`, and per group `subjects`, `ageMean`, `speedLabel` and the four curves
with `a0`, `a` (6), `b` (6) and `rmsDeg`. Floats are rounded to four decimals and keys sorted, so a re-run gives
the same bytes.

## How the rig uses it

For a walker with phase p (advanced by the walking speed and stride length), the rig evaluates the four series and
sets the pelvis tilt, the thigh angle (hip flexion), the shank angle (thigh plus knee flexion, the knee bending the
shank backwards) and the foot angle (ankle dorsiflexion). The left leg uses the same curves at p + 0.5. Young and
older groups give two measured styles; the older curves differ from the young ones by the ranges in the table above (for example a smaller ankle excursion, 23.9 against 26.2 degrees).

## Reproduce

```powershell
pipeline/.venv/Scripts/python.exe -m pipeline.gait.fit
```

Inputs and setup: `pipeline/README.md`.
