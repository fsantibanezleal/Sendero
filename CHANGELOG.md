# Changelog

All notable changes to Sendero are recorded here. The format follows Keep a Changelog
(https://keepachangelog.com/en/1.1.0/); versions use the `X.XX.XXX` display form.

## [Unreleased]

## [0.01.000] - 2026-10-30

First release: the full altar experience, built as a signed APK for an Android tablet.

### Added
- Repository base: Expo SDK 58 app (React Native 0.88.1, TypeScript), Android configuration for any orientation, MIT
  licence, code of conduct, contributing guide, security and privacy policy.
- Walking skeleton: the live front camera in one Skia canvas, the privacy rule (no internet permission in the release
  build), repository guards (content standards, secrets and local paths, version coherence, asset listing, CI budget),
  CI on develop and main, local APK build and install scripts.
- The full visit, driven by one UI-thread clock and the timeline (walk 7 s, message 10 s): the framed camera
  shrinks to the lower right corner, the petal path draws itself, silhouettes gather, one walks to the frame,
  the frame returns with the visitor smaller and the same person's silhouette behind them, a message with a
  whispered voice under softened music, and the return to the idle screen.
- The idle altar: the live mirrored front camera inside a procedural cempasuchil garland (Vogel phyllotaxis,
  noise-ruffled ligules, baked once into an atlas), swaying papel picado, flickering candles and a breathing
  "Toca la pantalla" hint.
- The petal path: a centripetal Catmull-Rom curve with Poisson disk petals in a band that widens with depth,
  drawn at constant speed by arc length.
- The silhouettes: a 2D cutout rig in profile driven by Fourier gait curves of young and older adults (Fukuchi
  2018), anthropometric proportions from Winter Figure 4.1; abuela, abuelo, mujer and hombre, with a
  Xoloitzcuintle-like dog or a cat beside them sometimes; never children; a soft glowing ghost look.
- The reveal: the person cut out of the live camera by the MediaPipe selfie segmenter (landscape, Apache-2.0)
  in front of a front-view silhouette; a still cut-out when the device is slow, a soft frame when no mask is
  available.
- Sound: two crossfading players (equal power, 4 s), the owner's own music first with the bundled traditional
  set mixed in, 6 dB ducking under the whisper, the voice matched to the person.
- Staff panel behind five taps in the upper left corner and a salted PIN: music import, volumes, cut-out
  mode, test visit, kiosk on and off, release of the device.
- Release signing from a properties file outside the repository; Windows native build fix (short CMake
  staging folders, CMAKE_OBJECT_PATH_MAX=250); Sendero's own marigold launcher icons.
- The visit starts in the frame of the touch: the next visit is planned while the altar waits and its layers are
  mounted gated off; the touch is handled on the UI thread; the side effects follow the clock's marks instead
  of JS timers, so a busy JS thread can no longer hide the petal path and the walkers.
- Hidden layers are not drawn (an empty clip instead of an opacity of 0, which Skia still draws): the path, the
  figures, the reveal, the camera under the full reveal and the bloom.
- One `[Sendero]` line in the system log per touch, visit mark and failing layer.
- Camera frames are disposed a few publishes after being replaced, and the layers measure the published frame
  size instead of the image: a frame disposed at once could still be read on the UI thread and crash the app.
- Camera frames that a GPU imports as black textures (the Android emulator) are detected on the first 8 frames and
  replaced by raster images built from the frames' pixels when the device lets the CPU read them; a refused read never
  stops the camera; the choice, the first frame error and any person-mask failure are logged.
- Without a person mask, the reveal shows the visitor as a soft-edged portrait left of centre, so the silhouette
  stays visible behind and beside them; only the variant on screen is drawn.
- The family in the upper left is always six (a grandmother, a grandfather, a woman, a man, a dog, a cat), each a new
  random variant at every visit: age, height, body type, hair, headwear on some, clothes, what they carry; pets by
  size, legs, ears, tail and fur. One of the four people walks, never the same kind twice in a row, sometimes with one
  of the pets beside them; a pet never walks alone.
- Figures redrawn with smooth anatomical outlines (profile head with face, neck, muscle-shaped limbs, shoes, female and
  male contours from the front, clothes that follow the body) and pets with real dog and cat proportions.
- 62 messages (the owner's seven verbatim) on reunion, memory, company and support, from a shuffle bag: all appear
  once before any repeats.
- The visit's clock follows real time on slow devices (it stretched past a minute at a few frames per second, and
  touches during the long fade back were ignored); the waiting family is drawn once per visit; the touch handler is
  created once; every ignored touch is logged with its reason.
- Procedural core library (`src/procedural`): seeded random (mulberry32, FNV-1a seeds), improved Perlin
  noise and fbm, Vogel phyllotaxis, centripetal Catmull-Rom splines as cubic Beziers, arc-length tables
  with constant-speed lookup, variable-radius Poisson disk sampling, easing and 2D geometry helpers, with
  Jest suites and the page `docs/procedural.md`.
- Offline pipelines (`pipeline/`, Python 3.12, never run in CI): `pipeline.music.fetch` and `pipeline.music.master`
  build the bundled public-domain music set (four Library of Congress National Jukebox recordings, mastered to
  -16 LUFS and at most -1 dBTP, AAC .m4a, with `assets/music/catalog.json`); `pipeline.gait.fit` fits order-6
  Fourier series to the Fukuchi 2018 sagittal gait curves of young and older adults
  (`data/gait/fukuchi2018-sagittal.json`, CC BY 4.0). Docs: `docs/music.md`, `docs/gait.md`.
- Offline voice pipeline (`pipeline/voice`): whispered, distant clips of all 62 messages in a woman's voice (Piper
  `es_MX-claude-high`) and a man's voice (Kokoro-82M `em_alex`), chosen by measured F0; 124 `.m4a` clips at -20 LUFS
  with `assets/voice/catalog.json`; the whisper by LPC resynthesis with noise excitation; a distance chain whose wet
  share was chosen by a speech-recognizer sweep (word error rate 0.81 at wet 0.55, about 0.2 at 0.25); spoken forms
  that keep the words; an intelligibility step (Whisper small) and the doc tables written from the outputs
  (`docs/voice.md`).
- Kiosk mode on Android: local Kotlin Expo module `modules/sendero-kiosk` (device owner, lock task mode, persistent
  HOME activity, screen on while plugged, user restrictions, screen pinning fallback) and config plugin
  `plugins/with-kiosk.js` (HOME intent filter and `lockTaskMode`, idempotent).
- Staff exit logic in `src/kiosk`: hidden five-tap corner gesture, hashed 4 to 8 digit PIN and a kiosk wrapper that
  degrades to `'off'` without the native module.
- Provisioning scripts `scripts/provision-kiosk.ps1` and `.sh`, and the docs `docs/kiosk.md` and
  `docs/guides/provision-kiosk.md`.

