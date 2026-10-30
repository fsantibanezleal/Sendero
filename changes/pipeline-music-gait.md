- Offline pipelines (`pipeline/`, Python 3.12, never run in CI): `pipeline.music.fetch` and `pipeline.music.master`
  build the bundled public-domain music set (four Library of Congress National Jukebox recordings, mastered to
  -16 LUFS and at most -1 dBTP, AAC .m4a, with `assets/music/catalog.json`); `pipeline.gait.fit` fits order-6
  Fourier series to the Fukuchi 2018 sagittal gait curves of young and older adults
  (`data/gait/fukuchi2018-sagittal.json`, CC BY 4.0). Docs: `docs/music.md`, `docs/gait.md`.
