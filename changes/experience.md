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
