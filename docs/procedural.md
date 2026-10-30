# Procedural core library

Everything Sendero draws is generated from the pure TypeScript library in `src/procedural/`
(import from `src/procedural/index.ts`). It has no React, Skia or native dependency, never calls the
unseeded global random source, and gives the same output for the same seed on every run and
platform. The methods and their sources were researched in the visual research dossier (sections D1 and
D2); this page states each method, its formula, why Sendero uses it and the function that implements it.

Two kinds of function exist. Per-frame functions (geometry, easing, arc-length lookup) start with the
`'worklet';` directive so Reanimated can run them on the UI thread. Generation-time functions (random,
noise, Vogel, splines, Poisson sampling, building an arc table) run once on the JS thread and are not
worklets; their results are plain arrays that a worklet can capture.

## Seeded random numbers

- What: mulberry32, a 32-bit state generator returning a float in [0, 1). Helpers draw ranges, integers,
  list members, shuffles (Fisher-Yates) and normal variates (Box-Muller). `hashSeed` is FNV-1a over the
  UTF-16 code units of a string, so a seed can be derived from a name.
- Formula: state `a += 0x6D2B79F5`, then two multiply-xorshift rounds, output `(t ^ (t >>> 14)) / 2^32`.
  Box-Muller: `z = sqrt(-2 ln u1) cos(2 pi u2)`.
- Why: layouts (flower heads, garland, petal scatter, figure variants) must be identical on every launch
  of the kiosk, so every random choice takes an explicit `rng`.
- Functions: `mulberry32`, `randRange`, `randInt`, `pick`, `shuffle`, `gaussian`, `hashSeed`.

## Gradient noise

- What: Perlin improved noise in 2D (Perlin 2002), with a permutation table shuffled by the seeded
  generator and eight unit gradient directions. Output is in [-1, 1] and exactly 0 at integer lattice
  points. `fbm2` sums octaves (frequency times `lacunarity`, amplitude times `gain`) and divides by the
  summed amplitude so the result stays in [-1, 1].
- Formula: fade curve `6t^5 - 15t^4 + 10t^3`; the value is the bilinear blend, with the fade weights, of
  the dot products between the corner gradients and the offsets to the sample point.
- Why: ruffled, irregular petal edges and slight variation in petal angle and length, so no two petals
  look stamped.
- Reference: Perlin, K. (2002), Improving noise, ACM Transactions on Graphics 21(3), DOI
  10.1145/566654.566636.
- Functions: `createNoise2D`, `fbm2`.

## Phyllotaxis (Vogel)

- What: the sunflower model. Floret n sits at polar angle `n * golden angle` and radius `c * sqrt(n)`.
  The square root gives uniform area density, so florets pack evenly.
- Formula: golden angle `= pi * (3 - sqrt 5) = 2 pi (1 - 1/phi)`, about 137.50776 degrees; `r_n = c sqrt(n)`,
  `theta_n = n * golden angle`.
- Why: the cempasuchil head is built from rings of ligules placed at Vogel angles, then perturbed by
  noise, which gives the dense pompom look of a double marigold.
- Reference: Vogel, H. (1979), A better way to construct the sunflower head, Mathematical Biosciences
  44(3-4):179-189, DOI 10.1016/0025-5564(79)90080-4.
- Functions: `GOLDEN_ANGLE`, `vogel`.

## Centripetal Catmull-Rom spline

- What: an interpolating spline through the control points whose knot spacing is
  `t_{i+1} = t_i + |P_{i+1} - P_i|^alpha` with `alpha = 0.5` (centripetal). Within a segment it forms no
  cusps and no self-intersections. The library converts each segment to an equivalent cubic Bezier
  (`p0, c1, c2, p3`) so a Skia path can draw it. End tangents come from reflected phantom points
  `P_{-1} = 2 P_0 - P_1` and `P_n = 2 P_{n-1} - P_{n-2}`. Consecutive identical points are removed first
  because a zero chord length would divide by zero.
- Formula: with `e_i = |P_{i+1} - P_i|^alpha` and the chords `e1, e2, e3` around segment `P1 P2`,
  `c1 = (e1^2 P2 - e2^2 P0 + (2 e1^2 + 3 e1 e2 + e2^2) P1) / (3 e1 (e1 + e2))`, and `c2` is the mirrored
  expression with `e3`. With equal chords it reduces to the uniform form `c1 = P1 + (P2 - P0) / 6`.
- Why: the petal path from the upper left corner to the frame must pass through its seeded control
  points and look hand-scattered without loops or kinks.
- Reference: Yuksel, C., Schaefer, S., Keyser, J. (2011), Parameterization and applications of
  Catmull-Rom curves, Computer-Aided Design 43(7):747-755, DOI 10.1016/j.cad.2010.08.008.
- Functions: `catmullRomBeziers`, `sampleBeziers`, `catmullRomPolyline`.

## Arc-length parametrization

- What: a table of cumulative chord lengths of a densely sampled polyline. A distance `s` maps to a point
  by binary search for the segment plus linear interpolation; the unit tangent is that segment's
  direction. Distances below 0 or above the total clamp to the ends; a zero-length table returns its
  single point with tangent (1, 0).
- Formula: `cum[i] = sum_{j<=i} |P_j - P_{j-1}|`; for `cum[i-1] <= s < cum[i]`,
  `P(s) = P_{i-1} + (s - cum[i-1]) / (cum[i] - cum[i-1]) * (P_i - P_{i-1})`.
- Why: a reveal driven by a plain curve parameter speeds up and slows down with the spacing of the
  control points. Driving it by arc length gives constant speed for the petal reveal and the walking
  figures, and lets petal i appear exactly when the head passes its distance `s_i`.
- Reference: Guenter, B., Parent, R. (1990), Computing the arc length of parametric curves, IEEE
  Computer Graphics and Applications 10(3), DOI 10.1109/38.55155 (the DOI comes from the Crossref
  lookup of the title; the printed page range was not confirmed).
- Functions: `buildArcTable`, `pointAtDistance`, `pointAtFraction` (both lookups are worklets).

## Poisson disk sampling (blue noise)

- What: Bridson's fast algorithm with a background grid of cell size `rMin / sqrt 2`, which holds at most
  one point per cell, and k = 30 candidates per active sample. It is generalized to a radius `r(x, y)`
  that varies with position: a candidate is drawn in the annulus `[r(p), 2 r(p)]` around the active
  sample `p` (uniform in area) and rejected when any accepted point lies closer than `r(candidate)`. The
  neighbour search widens to `ceil(r / cell)` cells so larger radii are checked correctly. `radiusAt` is
  clamped to at least `rMin`; a non-positive `rMin` throws a `RangeError`.
- Why: scattered petals must look natural, with no clumps and no regular grid. A smaller radius near the
  centre line of the path and a larger one at its edges gives the dense core and sparse strays of a real
  petal path. Cost is linear in the number of points.
- Reference: Bridson, R. (2007), Fast Poisson disk sampling in arbitrary dimensions, ACM SIGGRAPH 2007
  Sketches, DOI 10.1145/1278780.1278807.
- Function: `poissonDisk`.

## Easing and scalar helpers

- What: `clamp`, `lerp`, `invLerp`, `remap`, `smoothstep`, the cubic and sine easings, an ease-out with a
  slight overshoot (`easeOutBack`, back constant 1.2) and `pingPong` (a triangle wave of period 2). Easings
  map 0 to 0 and 1 to 1 and clamp inputs outside [0, 1].
- Formula: `easeInOutCubic(t) = 4 t^3` for `t < 0.5`, else `1 - (-2t + 2)^3 / 2`;
  `easeInOutSine(t) = -(cos(pi t) - 1) / 2`; `smoothstep = t^2 (3 - 2t)` on the clamped fraction.
- Why: the timeline (petal pop-in, the walk toward the viewer, candle glow) needs soft starts and stops
  and a small overshoot where a petal lands.
- Functions: `clamp`, `lerp`, `invLerp`, `remap`, `smoothstep`, `easeInCubic`, `easeOutCubic`,
  `easeInOutCubic`, `easeOutBack`, `easeInOutSine`, `pingPong` (all worklets).

## Geometry

- What: a `Point` type (`{ x, y }` in screen pixels, y down) with `add`, `sub`, `scale`, `length`,
  `distance`, `normalize` (the zero vector gives (1, 0)), `perpendicular` (left normal `(-y, x)`),
  `lerpPoint` and `rotate`. All are worklets.
- Why: placing garland heads and petals along a curve needs the tangent and normal at each point, per
  frame, on the UI thread.
- Module: `src/procedural/geometry.ts`.

## Tests and performance

The Jest suites under `src/procedural/__tests__/` (one file per module) check determinism, the
permutation and distribution properties, noise range, continuity and lattice zeros, Vogel radii and
angles, spline interpolation and C1 joins, arc-length totals and clamping, the Poisson minimum-distance
invariant on a constant and on a varying field and its density band, and easing endpoints and
monotonicity. Two timing tests (skipped when `CI` is set) hold the targets: Poisson sampling of
1600 x 900 at `rMin` 6 in under 300 ms and a 2000-sample arc table in under 20 ms. Generation-time
modules read `Math` functions through module-level constants, because global `Math` lookups are slow
inside Jest's sandbox.
