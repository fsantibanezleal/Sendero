# Sendero

[![ci](https://github.com/fsantibanezleal/Sendero/actions/workflows/ci.yml/badge.svg)](https://github.com/fsantibanezleal/Sendero/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Dia de Muertos kiosk app for an Android tablet at a home altar.

In the Mexican tradition, a path of cempasúchil (marigold) petals guides the souls of our departed loved ones from
their world to ours. Sendero turns that path into a short, warm moment for each visitor:

1. The visitor stands in front of the altar and sees themselves on the screen, framed by orange flowers, under papel
   picado and candlelight, while music plays.
2. They touch the screen. Their frame moves to a corner, and a path of petals draws itself from the far corner.
3. Soft silhouettes gather at the start of the path; one of them (a grandmother, a grandfather, a woman or a man,
   sometimes with a dog or a cat beside them) walks the path toward the visitor, coming closer for about seven
   seconds, stepping with real human gait data.
4. The frame returns to full screen: the visitor, a little smaller, with the soft silhouette standing behind them.
5. A message covers the screen ("Siempre te recordaré", "También te extraño", ...), whispered from a distance while
   the music softens. About ten seconds later the screen waits for the next friend.

The figures are generic and faceless, there are no children, and nothing the camera sees is stored or sent: the app
has no internet permission.

**Status:** in development. See [CHANGELOG.md](CHANGELOG.md) and the [event guide](docs/guides/event-guide.md).

## The repository by areas

| Area | Where | What |
|---|---|---|
| App | `App.tsx`, `src/` | `experience/` (timeline, clock, choices), `scene/` (the single Skia canvas and its layers), `flowers/` (procedural marigolds, garland), `path/` (petal path), `figures/` (rig, gait, silhouettes), `camera/` (feed and person mask), `audio/` (music, voice), `staff/` (panel), `kiosk/`, `procedural/` (geometry library) |
| Native module | `modules/sendero-kiosk/` | Kotlin: device owner, lock task mode, home launcher, screen on while plugged |
| Config plugins | `plugins/` | Privacy (no internet), kiosk manifest, release signing, Windows native build paths |
| Assets | `assets/` | Icons, Cormorant Garamond fonts (OFL), public-domain music, whispered voice clips, the MediaPipe selfie segmenter (Apache-2.0); every third-party file is listed in [ASSETS.md](ASSETS.md) |
| Offline pipeline | `pipeline/` | Python: music fetch and mastering, gait curve fitting, voice rendering, icons |
| Data | `data/gait/` | Fourier gait curves fitted from Fukuchi et al. 2018 (CC BY 4.0) |
| Docs | `docs/` | [Index](docs/README.md): the experience, the scene, the reveal, sound, music, voice, gait, kiosk, architecture, guides |
| Scripts | `scripts/` | setup, build-apk, install-apk, provision-kiosk, push-music, capture-visit (`.ps1` and `.sh`); repository guards; asset index generator |
| CI | `.github/workflows/` | Light checks only: guards, typecheck, lint; the APK is built locally |

## Quick start

```powershell
.\scripts\setup.ps1                                   # Node 22: npm ci
npm run check                                         # typecheck, lint, tests, guards
.\scripts\build-apk.ps1 -CxxRoot <short temp folder>  # standalone release APK into dist\
.\scripts\install-apk.ps1                             # install on the connected tablet
```

Then follow the [event guide](docs/guides/event-guide.md): provision the kiosk, load your music, set the staff PIN.

## Licence

Code: MIT ([LICENSE](LICENSE)). Bundled third-party assets keep their own licences ([ASSETS.md](ASSETS.md)). The
film soundtrack the app can play at an event is never part of this repository: it is imported on the tablet from
music the owner holds.
