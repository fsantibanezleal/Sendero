# Whispered distant voice

At the end of each visit a message covers the screen and a voice whispers it from a distance, behind the music, while
the music softens a little. The voice matches the silhouette that walked to the visitor: a grandmother or a woman gets
`mujer`, a grandfather or a man gets `hombre`. This page records how the 14 clips (7 messages by 2 voices) are made,
what was measured on them, and how to replace them with a recorded family voice. The code is in
[`pipeline/voice`](../pipeline/voice/README.md); the app only reads `assets/voice/catalog.json`.

## Why the voice is synthesized and then converted

No open text-to-speech model whispers natively: neither Piper nor Kokoro documents a whisper style. The method is
therefore two steps: synthesize neutral Mexican Spanish speech offline, then convert it into a whisper with a signal
processing recipe and add distance. Voices are limited to licences that allow a public repository (MIT, Apache-2.0 or
more permissive). Voice cloning of a real person and non-commercial voices (Meta MMS, Coqui XTTS) are not used. The Piper
engine (`piper-tts`, GPL-3.0) is a tool of the offline pipeline only; it is never committed or shipped, and the clips are
audio, not code. The pipeline never runs in CI (ADR-0074) and the app never runs it.

The most authentic option is a family member's own whispered voice; see the last section.

## Voices and licences

The rule is objective because nobody can listen during the run. The neutral synthesis of `m01` ("siempre te recordaré")
is made with every candidate and the median F0 of its voiced frames is measured (`librosa.pyin`, 60 to 400 Hz).
`mujer` is the first candidate, in order of preference, with median F0 at or above 165 Hz; `hombre` the first with median
F0 at or below 155 Hz. A voice is never pitch-shifted into the other gender. Measured:

| Candidate | Engine | Median F0 (Hz) | Neutral periodicity | Outcome |
|---|---|---|---|---|
| `es_MX-claude-high` | Piper | 198.348 | 0.793 | chosen as `mujer` |
| `es_MX-ald-medium` | Piper | 165.352 | 0.782 | qualifies as female, not first in order |
| `es_MX-ald-x_low` | Piper | 168.728 | 0.785 | qualifies as female, not first in order |
| `kokoro-ef_dora` | Kokoro | 170.689 | 0.706 | qualifies as female, not first in order |
| `kokoro-em_alex` | Kokoro | 130.488 | 0.610 | chosen as `hombre` |
| `kokoro-em_santa` | Kokoro | 143.952 | 0.560 | qualifies as male, not first in order |

Both Piper `ald` voices (the Unlicense Aldo dataset) measure above 155 Hz, so no Piper voice fills `hombre`; the Kokoro
voices were added as the brief allows, and `em_alex` is the first male candidate that qualifies. The F0 table is
committed in `pipeline/voice/selection.json`.

| Voice id | Model | Licence of the voice | Dataset licence |
|---|---|---|---|
| `mujer` | Piper `es_MX-claude-high` (rhasspy/piper-voices) | MIT (repository) | Apache-2.0 (model card) |
| `hombre` | Kokoro-82M `em_alex` (hexgrad/Kokoro-82M v1.0) | Apache-2.0 | not stated per voice; card licence field Apache-2.0 |

The models are downloaded into the models root, never committed; sources and SHA-256 are in
`pipeline/voice/models.lock.json`. Pace is gentle: Piper `length_scale` 1.3, Kokoro `speed` 0.8. Piper noise scales are
0 and the Kokoro vocoder is seeded, so synthesis is reproducible.

## The whisper conversion

Implemented from Cotescu et al., "Voice Conversion for Whispered Speech Synthesis", IEEE Signal Processing Letters,
DOI 10.1109/LSP.2019.2961213 (arXiv 1912.05289), and the linear-prediction analysis and synthesis of Atal and Hanauer
(1971), in `pipeline/voice/whisper.py`. Speech is modelled per frame by an all-pole filter:

    x[n] = e[n] - sum_(k=1..p) a_k x[n-k],    H(z) = 1 / A(z),    A(z) = 1 + sum_(k=1..p) a_k z^-k,    p = 24

where e[n] is the excitation. For voiced speech e[n] is a pulse train at F0, which is what makes it carry pitch. A whisper
has no vocal fold vibration, so the excitation becomes noise. Steps, at 22,050 Hz mono:

1. Pre-emphasis 0.97.
2. Frames of 25 ms with a periodic sqrt-Hann window at 50 percent overlap (the squared window is a periodic Hann, so
   overlap-add reconstructs perfectly; checked by a test).
3. Per frame, LPC of order 24 (`librosa.lpc`) and the RMS of the LPC residual.
4. Excitation: seeded white noise scaled to that RMS. The seed is a hash of the voice id and the message id.
5. Formant shift: every pole angle of A(z) is multiplied by 1.08 (clipped below pi) and every pole radius by 0.985
   (wider bandwidths); the all-pole filter 1 / A'(z) then resynthesizes the frame.
6. Overlap-add, de-emphasis, and a 2nd-order Butterworth high-pass at 250 Hz.

## The distance chain

`pipeline/voice/distance.py`: a 2nd-order Butterworth low-pass at 4,500 Hz (air absorption); a synthesized room impulse
response (6 early reflections between 8 and 40 ms with gains 0.5 to 0.2, plus a tail of exponentially decaying seeded
Gaussian noise with RT60 1.4 s, low-passed at 6 kHz, normalized to unit energy) applied by FFT convolution; 25 ms
pre-delay; wet 0.55 and dry 0.45; 0.4 s of silence before the voice and a tail cut where the 20 ms RMS falls below -60 dB
of the peak (at most 2 s). The impulse response is synthesized, so it has no licence question (the OpenAIR files were not
used because their per-file licences could not be read).

## Loudness and encoding

Every clip is normalized to -20 LUFS integrated (`pyloudnorm`, BS.1770) with the true peak (4x oversampled) at or below
-3 dBTP, then encoded as mono AAC `.m4a`, 44.1 kHz, 96 kb/s, with the ffmpeg of `imageio-ffmpeg`. The values below are
measured on the decoded `.m4a`: the encoder moves the loudness by a few hundredths of a LU, so the gain is corrected on
the decoded file until it is within 0.1 LU. The app sets the playback gain.

## Measured results per clip

Periodicity is the median over 40 ms frames above -40 dBFS of the maximum normalized autocorrelation at lags of 2.5 to
12.5 ms; the neutral synthesized input measures 0.55 to 0.79 and every whisper clip is below 0.30.

| File | Message | Duration (s) | Loudness (LUFS) | True peak (dBTP) | Periodicity |
|---|---|---|---|---|---|
| `mujer/m01.m4a` | siempre te recordaré | 3.320 | -19.992 | -4.609 | 0.226 |
| `mujer/m02.m4a` | siempre en mis pensamientos | 3.715 | -20.050 | -5.631 | 0.257 |
| `mujer/m03.m4a` | gracias | 2.438 | -20.098 | -5.678 | 0.226 |
| `mujer/m04.m4a` | sigue así | 2.577 | -20.004 | -4.224 | 0.242 |
| `mujer/m05.m4a` | lo estás haciendo bien | 3.274 | -20.070 | -4.199 | 0.240 |
| `mujer/m06.m4a` | descansa, lo estás haciendo bien | 4.505 | -20.005 | -4.497 | 0.216 |
| `mujer/m07.m4a` | también te extraño | 3.065 | -20.056 | -4.772 | 0.205 |
| `hombre/m01.m4a` | siempre te recordaré | 3.506 | -20.081 | -6.279 | 0.241 |
| `hombre/m02.m4a` | siempre en mis pensamientos | 3.622 | -20.099 | -5.347 | 0.222 |
| `hombre/m03.m4a` | gracias | 2.601 | -20.056 | -4.211 | 0.216 |
| `hombre/m04.m4a` | sigue así | 2.740 | -19.998 | -3.692 | 0.253 |
| `hombre/m05.m4a` | lo estás haciendo bien | 3.460 | -20.003 | -4.527 | 0.220 |
| `hombre/m06.m4a` | descansa, lo estás haciendo bien | 4.249 | -20.084 | -3.676 | 0.239 |
| `hombre/m07.m4a` | también te extraño | 3.437 | -20.084 | -5.323 | 0.211 |

Tests (`pipeline/voice/tests`) cover the whisper on a synthetic voice (periodicity from above 0.5 to below 0.3, spectral
envelope correlation above 0.8), the distance chain (at least 12 dB less energy above 6 kHz, a decaying tail), loudness
within 0.3 LU of -20 LUFS with the true peak at or below -3 dBTP, F0 recovery on 200 Hz and 110 Hz tones within 3
percent, the voice selection rule and the catalog contract (`assets/voice/catalog.json`, version 1).

## Replacing the clips with a recorded family voice

1. Record each message, whispering softly, in a quiet room with the microphone close and the level low (48 kHz, 24 bit,
   three takes each); this guidance is standard practice, not sourced.
2. Name the final files exactly `assets/voice/mujer/m01.m4a` to `m07.m4a` and `assets/voice/hombre/m01.m4a` to `m07.m4a`
   (the ids are in `pipeline/voice/messages.json`), mono AAC at 44.1 kHz.
3. Normalize each to -20 LUFS integrated with a true peak at or below -3 dBTP (the same target, so the app's playback gain
   stays valid) and keep the duration between 1 and 6 seconds.
4. Update `assets/voice/catalog.json` (version 1, same shape; durations, loudness, true peak and periodicity re-measured
   with `pipeline/voice/measure.py`) and the Voice section of `ASSETS.md` with the recording's author and licence.
