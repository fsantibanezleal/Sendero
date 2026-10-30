# Sendero

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Dia de Muertos kiosk app for an Android tablet at a home altar.

In the Mexican tradition, a path of cempasúchil (marigold) petals guides the souls of our departed loved ones from
their world to ours. Sendero turns that path into a short, warm moment for each visitor:

1. The visitor stands in front of the altar and sees themselves on the screen, framed by orange flowers, while music
   plays.
2. They touch the screen. Their frame moves to a corner, and a path of petals draws itself from the far corner.
3. Soft silhouettes appear at the start of the path; one of them (a grandmother, a grandfather, a woman or a man,
   sometimes with a dog or a cat beside them) walks the path toward the visitor, coming closer for about seven
   seconds.
4. The frame returns to full screen: the visitor, with the soft silhouette standing behind them.
5. A message covers the screen ("siempre te recordaré", "también te extraño", ...), whispered softly from a
   distance under the music. After about ten seconds the screen waits for the next friend.

The figures are generic and faceless, there are no children, and nothing the camera sees is stored or sent.

**Status:** in development (version 0.00.000). See [CHANGELOG.md](CHANGELOG.md).

## The repository by areas

| Area | Where | What |
|---|---|---|
| App | `App.tsx`, `index.ts`, `src/` | The kiosk experience: state machine, scene, camera, audio, staff panel |
| Native modules | `modules/` | Local Kotlin Expo modules (kiosk: device owner, lock task, home launcher) |
| Config plugins | `plugins/` | Manifest and Gradle changes applied by `expo prebuild` |
| Assets | `assets/` | Icons, fonts, bundled public-domain music, whispered voice clips, the segmentation model |
| Offline pipeline | `pipeline/` | Python: music mastering, gait curve fitting, whispered voice rendering |
| Data | `data/` | Small derived data committed by design (gait coefficients), with attribution |
| Docs | `docs/` | Architecture, the experience, assets and licences, build and install, the event guide |
| Scripts | `scripts/` | Setup, build, install, kiosk provisioning, music import (`.ps1` and `.sh`), repository guards |
| CI | `.github/workflows/` | Light checks only: typecheck, lint, tests, guards; the APK is built locally |

Areas are filled unit by unit; an area listed here and not yet present in the tree is still to be built.

## Licence

Code: MIT ([LICENSE](LICENSE)). Bundled third-party assets keep their own licences, listed in `ASSETS.md`. The film
soundtrack the app can play at an event is never part of this repository: it is imported on the tablet from music
the owner holds.
