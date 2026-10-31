# Changelog

All notable changes to Sendero are recorded here. The format follows Keep a Changelog
(https://keepachangelog.com/en/1.1.0/); versions use the `X.XX.XXX` display form.

## [Unreleased]

### Added
- Two more voices (a woman, Kokoro dora; a man, Kokoro santa): each visit picks one of the two of the walker's gender.
- Flowers in the visitor's hair, two or three chosen at random per visit, placed by Google BlazeFace on the device and
  tilted with the head; the rising lights of the silhouettes over the real person too.
- Veladoras on the ground around the silhouette at the farewell; pets painted as alebrijes.

### Fixed
- The person model never loaded in a release build (a bundled file is a raw resource, not a URL): it is copied to a
  file by the app's native module. The selfie segmenter needed a GPU feature the TCL tablet lacks; BlazeFace runs on the
  CPU.

## [0.01.004] - 2026-10-31

### Fixed
- A modest tablet (TCL Tab A1 Plus, Snapdragon 4 Gen 2, 2400 x 1600 at 120 Hz) froze: the camera is 960 x 540 at 24 frames
  per second, the person measure runs on the CPU about twice a second, the screen is held at 60 Hz, the glow is a baked
  image instead of a blur every frame, and the figure images are smaller.

### Changed
- The camera is the system's own preview layer under the scene, so no frame passes through the app; the frames are read
  only during a visit, about twice a second, for the flowers in the visitor's hair.
- People wear normal modern clothes: the Victorian and 1970s drawings are gone.
- The voice plays softer (0.6), further behind the music, and starts with the message (it is loaded at the reveal).
- The person who walks is the same frontal drawing in the family, on the path and at the farewell.
- The candle is a veladora, a glass of amber light with a marigold and a slender flame.

### Fixed
- On the tablet touches stopped working after the first visit and the voice came after the visit: the music engine read
  the players' position and set their volume 20 times a second, each call waiting for the busy main thread, so the
  JavaScript thread fell 20 s behind. It now sets a volume only when it changes and reads the position once a second.
- The next visit is planned once the voice plays, and a touch starts a visit when a newer one is mounted.

## [0.01.003] - 2026-10-31

### Changed
- The figures are warm silhouettes of light again, after the owner's review: no face details, a few flowers, no masks,
  no colored clothes; the farewell shows a frontal drawing (`docs/figures.md`).

### Added
- At the farewell the person holds a candle of the day whose light breathes.
- Flowers rest on the visitor's hair, found on the device from the person mask during the visit.
- `build-apk -OnlyTrack <file>`: a local build that loops one audio file, which never enters the repository.

## [0.01.002] - 2026-10-30

### Changed
- The silhouettes are now 69 licensed drawings, at least ten per archetype, with realistic proportions, in place of the
  drawn rig figures.
- The family is dressed for the day: inner contour strokes, calavera face paint, flower crowns, marigold necklaces,
  rebozo, huipil, serape and catrin clothes, and alebrije pets, in random colors per visit (`docs/figures.md`).
- The music: ten warm instrumental pieces under CC BY 4.0 replace the noisy recordings of 1904 to 1920.
- The voice: a soft near voice with a little breath replaces the distant whisper, which measured as far less natural.

### Fixed
- The next visit is planned during the farewell and a touch during the end of a visit is remembered, so touching
  after a visit always starts the next one; the clock follows real time when the camera slows down.
- The farewell places each drawing by its real width: it never touches the frame or leaves the screen.

## [0.01.001] - 2026-10-30

### Changed
- The farewell, after the owner's review ("the final overlay of the frame and the silhouette are messy ... render the
  silhouettes at the sides of the frames, like resting on it, not overlapping it"): the frame grows from the corner
  to a stage on the right (60 percent of the screen) with the live camera, and the silhouette stands beside it on the
  left with one hand resting on the garland; the pet sits at its other side. No person mask is run any more.
- The staff panel no longer offers the cut-out mode, which the farewell does not use.

### Added
- One system-log line when the music starts, for each track, for each whisper, and when the music fails to start.
- The native build caps its parallel compilers per module (CMake job pool, `-CxxJobs`, default 4): a 32-core machine
  ran out of memory.

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

