# Assets and licences

Every file bundled with the app that is not our own code is listed here with its source and licence. The repository
guard (`scripts/check_repo_integrity.py`) fails when a file under `assets/music`, `assets/voice`, `assets/models` or
`assets/fonts` is not named in this file.

Never committed: commercial recordings, including the Coco soundtrack. At an event the app plays the tracks the
owner holds, imported on the tablet into the app's private storage.

## Images

| File | Source | Licence | Notes |
|---|---|---|---|
| `assets/icon.png`, `assets/android-icon-*.png`, `assets/splash-icon.png`, `assets/favicon.png` | Expo `blank-typescript` template | MIT (650 Industries, Inc.) | Temporary; replaced by Sendero's own marigold icon at the first release |

## Music

None yet.

## Voice

Whispered, distant clips of the seven remembrance messages, produced offline by `pipeline/voice` (method and measured
results in `docs/voice.md`; catalog in `assets/voice/catalog.json`). The speech is synthesized by an open model, then
converted to a whisper and placed at a distance by our own signal processing, so each clip is a derivative of the voice
model's output. The synthesis engines were used as tools only: no engine and no model file is committed or shipped.

| Files | Voice (model) | Voice licence | Dataset licence | Notes |
|---|---|---|---|---|
| `assets/voice/mujer/m01.m4a`, `assets/voice/mujer/m02.m4a`, `assets/voice/mujer/m03.m4a`, `assets/voice/mujer/m04.m4a`, `assets/voice/mujer/m05.m4a`, `assets/voice/mujer/m06.m4a`, `assets/voice/mujer/m07.m4a` | `mujer`: Piper `es_MX-claude-high` (rhasspy/piper-voices) | MIT (repository) | Apache-2.0 (model card) | Engine `piper-tts` 1.8.0 (GPL-3.0) used as a tool only; the engine is not distributed. Median F0 202.984 Hz |
| `assets/voice/hombre/m01.m4a`, `assets/voice/hombre/m02.m4a`, `assets/voice/hombre/m03.m4a`, `assets/voice/hombre/m04.m4a`, `assets/voice/hombre/m05.m4a`, `assets/voice/hombre/m06.m4a`, `assets/voice/hombre/m07.m4a` | `hombre`: Kokoro-82M voice `em_alex` (hexgrad/Kokoro-82M v1.0) | Apache-2.0 (weights and `kokoro` 0.9.4 package) | Not stated per voice on the model card; the card's licence field is Apache-2.0 | Engine `kokoro` 0.9.4 (Apache-2.0) used as a tool only. Median F0 133.534 Hz |

The model files are downloaded into the models root and never committed; their sources and SHA-256 are in
`pipeline/voice/models.lock.json`. A recorded family voice can replace the clips (same file names, same loudness
target, see `docs/voice.md`).

## Models

None yet.

## Fonts

None yet.

## Data

None yet.
