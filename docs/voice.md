# The soft voice

On 2026-10-30 the owner found the whispered clips "so digital". The measurement agreed: UTMOS naturalness on six messages
was about 1.3 for every whisper conversion (LPC, WORLD), 1.3 for a breathy WORLD voice and 1.5 to 1.9 for a soft voice
through the distant room, against 3.5 to 3.8 for the clean voice. A soft voice in a small room with 18 percent of its
own whisper under it (`distance.close_chain`, `whisper.add_breath`) measured 3.3 with no word errors on the first
clips, so all the clips now use it. The sections below on the whisper conversion and the distance chain describe the parts
it builds on; the far chain is kept in the code but no clip uses it.

At the end of each visit a message covers the screen and a soft voice says it, near, over the music, while
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

<!-- voice:candidates:start -->
| Candidate | Engine | Median F0 (Hz) | Neutral periodicity | Outcome |
|---|---|---|---|---|
| `es_MX-ald-medium` | Piper | 165.830 | 0.781 | qualifies as female, not first in order |
| `es_MX-ald-x_low` | Piper | 168.728 | 0.766 | qualifies as female, not first in order |
| `es_MX-claude-high` | Piper | 202.984 | 0.783 | chosen as `mujer` |
| `kokoro-ef_dora` | Kokoro | 170.689 | 0.696 | qualifies as female, not first in order |
| `kokoro-em_alex` | Kokoro | 133.534 | 0.608 | chosen as `hombre` |
| `kokoro-em_santa` | Kokoro | 135.086 | 0.550 | qualifies as male, not first in order |
<!-- voice:candidates:end -->

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
pre-delay; wet 0.25 and dry 0.75 (see Intelligibility below); 0.4 s of silence before the voice and a tail cut where the 20 ms RMS falls below -60 dB
of the peak (at most 2 s). The impulse response is synthesized, so it has no licence question (the OpenAIR files were not
used because their per-file licences could not be read).

## Spoken forms

`pipeline/voice/spoken.json`. Each message is spoken as a sentence (first letter in upper case, a final period); the
words never change. One override changes only a pronunciation: Piper says "sigue" with the soft fricative g that
espeak-ng gives it (`sˈiɣe`), which the recognizer heard as "si de" after the whisper, so `mujer` m04 is spoken with
a stop g through Piper's raw phoneme input (`[[ sˈiɡe ]] así.`). A test checks that every override says only words
of its message outside the phonemes.

## Intelligibility

`pipeline/voice/intelligibility.py` transcribes every clip with OpenAI Whisper small (`openai/whisper-small`, MIT
licence, forced to Spanish, run on the CPU; a measurement tool only, nothing of it ships) and records the word error
rate against the message (words compared without case, accents or punctuation) in
`pipeline/voice/intelligibility.json`. A recognizer trained on normal speech misses more of a distant whisper than a
listener does, and the message is on the screen while it is whispered, so the rate is an upper bound used to compare
settings and to catch a clip whose words are lost.

Where the words were lost (first render, wet 0.55): mean word error rate 0.14 on the neutral speech, 0.18 after the
whisper conversion and 0.81 after the distance chain. The room smeared the whispered consonants. A sweep of the
distance chain on the same 14 clips (mean word error rate, and the loss of energy above 6 kHz against the whisper):

| Low-pass (Hz) | RT60 (s) | Wet | Word error rate | Loss above 6 kHz (dB) |
|---|---|---|---|---|
| 4,500 | 1.4 | 0.55 | 0.81 | 18.1 |
| 4,500 | 0.8 | 0.35 | 0.39 | 15.6 |
| 4,500 | 0.6 | 0.25 | 0.30 | 14.9 |
| 6,000 | 0.8 | 0.35 | 0.42 | 9.5 |
| 6,000 | 0.6 | 0.25 | 0.30 | 8.8 |
| 7,000 | 0.5 | 0.20 | 0.19 | 5.5 |
| 4,500 | 1.4 | 0.25 | 0.19 | 14.9 |
| 6,000 | 1.0 | 0.30 | 0.34 | 9.1 |

The chain keeps the long room (RT60 1.4 s) and the 4,500 Hz air absorption and lowers the wet share to 0.25: as
intelligible as the whisper before the chain, still far and reverberant. Measured on the committed clips:

<!-- voice:intelligibility:start -->
| File | Heard by the recognizer | Word error rate |
|---|---|---|
| `mujer/m01.m4a` | Siempre te recordaré. | 0.00 |
| `mujer/m02.m4a` | Siempre en mis pensamientos. | 0.00 |
| `mujer/m03.m4a` | Gracias. | 0.00 |
| `mujer/m04.m4a` | ¡Sí que así! | 1.00 |
| `mujer/m05.m4a` | Lo estás haciendo bien. | 0.00 |
| `mujer/m06.m4a` | Descanza, lo estás haciendo bien. | 0.20 |
| `mujer/m07.m4a` | También te extraño. | 0.00 |
| `mujer/m08.m4a` | Hoy viene a verte. | 0.25 |
| `mujer/m09.m4a` | ¡Qué gusto me da verde! | 0.20 |
| `mujer/m10.m4a` | ¿Cuánto tiempo sin verde? | 0.25 |
| `mujer/m11.m4a` | te extrañaba mucho. | 0.00 |
| `mujer/m12.m4a` | Déjame verte, un ratito. | 0.00 |
| `mujer/m13.m4a` | Tu luz me trajo hasta aquí. | 0.00 |
| `mujer/m14.m4a` | Seguí las flores hasta ti. | 0.00 |
| `mujer/m15.m4a` | Gracias por las flores. | 0.00 |
| `mujer/m16.m4a` | Gracias por acordarte de mí. | 0.00 |
| `mujer/m17.m4a` | Cada año vuelvo a verte. | 0.00 |
| `mujer/m18.m4a` | Vine a darte un abrazo. | 0.00 |
| `mujer/m19.m4a` | ¡Qué bonito les volver a verte! | 0.17 |
| `mujer/m20.m4a` | Aquí sigo, cerquita de ti. | 0.00 |
| `mujer/m21.m4a` | Sigo en tu corazón. | 0.00 |
| `mujer/m22.m4a` | Te llevo en el corazón. | 0.00 |
| `mujer/m23.m4a` | Nunca me olvido de ti. | 0.00 |
| `mujer/m24.m4a` | Me acuerdo de ti todos los días. | 0.00 |
| `mujer/m25.m4a` | Me acuerdo de tu risa. | 0.00 |
| `mujer/m26.m4a` | Mientras me recuerdes, aquí estoy. | 0.00 |
| `mujer/m27.m4a` | Vivo en tus recuerdos. | 0.00 |
| `mujer/m28.m4a` | Me llevo tu cariño. | 0.00 |
| `mujer/m29.m4a` | Nuestro cariño no se acaba. | 0.00 |
| `mujer/m30.m4a` | Cuardo cada momento contigo. | 0.25 |
| `mujer/m31.m4a` | Aquí estoy contigo. | 0.00 |
| `mujer/m32.m4a` | Camino a tu lado. | 0.00 |
| `mujer/m33.m4a` | Me acompaño aunque no me veas. | 0.17 |
| `mujer/m34.m4a` | Estoy más cerca de lo que crees. | 0.00 |
| `mujer/m35.m4a` | Siempre te cuido. | 0.00 |
| `mujer/m36.m4a` | Seguimos juntos. | 0.00 |
| `mujer/m37.m4a` | Nunca me fui del todo. | 0.00 |
| `mujer/m38.m4a` | Estoy en cada vela que enciendes. | 0.00 |
| `mujer/m39.m4a` | Me quedo un ratito contigo. | 0.00 |
| `mujer/m40.m4a` | De peor y sonrido. | 0.75 |
| `mujer/m41.m4a` | ¿Cuánto te quiero? | 0.00 |
| `mujer/m42.m4a` | Me llenas de orgullo. | 0.00 |
| `mujer/m43.m4a` | ¡Tú puedes! | 0.00 |
| `mujer/m44.m4a` | ¡Con fin a ti! | 1.00 |
| `mujer/m45.m4a` | Todo va a estar bien. | 0.00 |
| `mujer/m46.m4a` | No tengas miedo. | 0.00 |
| `mujer/m47.m4a` | Eres más fuerte de lo que crees. | 0.00 |
| `mujer/m48.m4a` | Ve con calma, no hay prisa. | 0.00 |
| `mujer/m49.m4a` | Sí que adelante, yo te acompaño. | 0.40 |
| `mujer/m50.m4a` | Vive bonito. | 0.00 |
| `mujer/m51.m4a` | Sé feliz, te lo mereces. | 0.00 |
| `mujer/m52.m4a` | Riden mucho, me encanta tu risa. | 0.17 |
| `mujer/m53.m4a` | Cuida a los tuyos. | 0.00 |
| `mujer/m54.m4a` | Ablaza fuerte a quien quieres. | 0.20 |
| `mujer/m55.m4a` | Abridate y come bien. | 0.25 |
| `mujer/m56.m4a` | Date un descanso, te lo has ganado. | 0.00 |
| `mujer/m57.m4a` | Tu esfuerzo vale mucho. | 0.00 |
| `mujer/m58.m4a` | Eres luz para los tuyos. | 0.00 |
| `mujer/m59.m4a` | Te mato un abrazo grande. | 0.20 |
| `mujer/m60.m4a` | Gracias por tanto cariño. | 0.00 |
| `mujer/m61.m4a` | Hoy es fiesta de Frutala. | 0.50 |
| `mujer/m62.m4a` | Canta y baila por mí. | 0.00 |
| `hombre/m01.m4a` | Siempre te recordaré. | 0.00 |
| `hombre/m02.m4a` | Siempre en mis pensamientos. | 0.00 |
| `hombre/m03.m4a` | ¡Gracias! | 0.00 |
| `hombre/m04.m4a` | ¡Vas a seguir, vamos a seguir! | 3.00 |
| `hombre/m05.m4a` | Lo estás haciendo bien. | 0.00 |
| `hombre/m06.m4a` | Descansa, lo estás haciendo bien. | 0.00 |
| `hombre/m07.m4a` | También te extraño. | 0.00 |
| `hombre/m08.m4a` | ¡Toy bien abiertos! | 1.00 |
| `hombre/m09.m4a` | ¡Qué gusto me da verte! | 0.00 |
| `hombre/m10.m4a` | ¿Cuánto tiempo sin verte? | 0.00 |
| `hombre/m11.m4a` | Te extrañaba mucho. | 0.00 |
| `hombre/m12.m4a` | Déjame verte un ratito. | 0.00 |
| `hombre/m13.m4a` | Tu luz me trajo hasta aquí. | 0.00 |
| `hombre/m14.m4a` | Seguí las flores hasta ti. | 0.00 |
| `hombre/m15.m4a` | Gracias por las flores. | 0.00 |
| `hombre/m16.m4a` | Gracias por acordarte de mí. | 0.00 |
| `hombre/m17.m4a` | Cada año vuelvo a perse. | 0.20 |
| `hombre/m18.m4a` | ¡Bene atarte un abrazo! | 0.60 |
| `hombre/m19.m4a` | ¡Qué bonito es volver a verte! | 0.00 |
| `hombre/m20.m4a` | Aquí sigo cerquita de ti. | 0.00 |
| `hombre/m21.m4a` | Sigo en tu corazón. | 0.00 |
| `hombre/m22.m4a` | Te llevo en el corazón. | 0.00 |
| `hombre/m23.m4a` | Nunca me olvido de ti. | 0.00 |
| `hombre/m24.m4a` | Me acuerdo de time todos los días. | 0.14 |
| `hombre/m25.m4a` | Me acuerdo de tu risa. | 0.00 |
| `hombre/m26.m4a` | Mientras me recuerdes, aquí estoy. | 0.00 |
| `hombre/m27.m4a` | ¡Vivo en tus recuerdos! | 0.00 |
| `hombre/m28.m4a` | Me llevo tu cariño. | 0.00 |
| `hombre/m29.m4a` | Nuestro cariño no se acaba. | 0.00 |
| `hombre/m30.m4a` | Guardo cada momento contigo. | 0.00 |
| `hombre/m31.m4a` | Aquí estoy contigo. | 0.00 |
| `hombre/m32.m4a` | Camino a tu lado. | 0.00 |
| `hombre/m33.m4a` | Te acompaño aunque no me veas. | 0.00 |
| `hombre/m34.m4a` | Estoy más cerca de lo que crees. | 0.00 |
| `hombre/m35.m4a` | Siempre te cuido. | 0.00 |
| `hombre/m36.m4a` | Seguimos juntos. | 0.00 |
| `hombre/m37.m4a` | Nunca me fui de todo. | 0.20 |
| `hombre/m38.m4a` | Estoy en cada vela que enciendes. | 0.00 |
| `hombre/m39.m4a` | Me quedo un ratito contigo. | 0.00 |
| `hombre/m40.m4a` | Te veo y sonrío. | 0.00 |
| `hombre/m41.m4a` | ¡Cuánto te quiero! | 0.00 |
| `hombre/m42.m4a` | Me llenas de orgullo. | 0.00 |
| `hombre/m43.m4a` | ¡Tú puedes! | 0.00 |
| `hombre/m44.m4a` | Confía en ti. | 0.00 |
| `hombre/m45.m4a` | Todo va a estar bien. | 0.00 |
| `hombre/m46.m4a` | No tengas miedo. | 0.00 |
| `hombre/m47.m4a` | Eres más fuerte de lo que crees. | 0.00 |
| `hombre/m48.m4a` | Ve con calma, no hay prisa. | 0.00 |
| `hombre/m49.m4a` | Sigue adelante, yo te acompaño. | 0.00 |
| `hombre/m50.m4a` | ¡Vayre bonito! | 0.50 |
| `hombre/m51.m4a` | Sé feliz, te lo mereces. | 0.00 |
| `hombre/m52.m4a` | Prie mucho, me encanta tu risa. | 0.17 |
| `hombre/m53.m4a` | Cuida a los tuyos. | 0.00 |
| `hombre/m54.m4a` | Abraza fuerte a quien quieres. | 0.00 |
| `hombre/m55.m4a` | Aplicarte y come bien. | 0.25 |
| `hombre/m56.m4a` | Date un descanso, te lo has ganado. | 0.00 |
| `hombre/m57.m4a` | Tu esfuerzo vale mucho. | 0.00 |
| `hombre/m58.m4a` | Eres luz para los tuyos. | 0.00 |
| `hombre/m59.m4a` | Te mando un abrazo grande. | 0.00 |
| `hombre/m60.m4a` | Gracias por tanto, cariño. | 0.00 |
| `hombre/m61.m4a` | Hoy es fiesta disfrútala. | 0.00 |
| `hombre/m62.m4a` | ¡Canta divaela por mí! | 0.40 |
| mean | | 0.10 |
<!-- voice:intelligibility:end -->

## Loudness and encoding

Every clip is normalized to -20 LUFS integrated (`pyloudnorm`, BS.1770) with the true peak (4x oversampled) at or below
-3 dBTP, then encoded as mono AAC `.m4a`, 44.1 kHz, 96 kb/s, with the ffmpeg of `imageio-ffmpeg`. The values below are
measured on the decoded `.m4a`: the encoder moves the loudness by a few hundredths of a LU, so the gain is corrected on
the decoded file until it is within 0.1 LU. The app sets the playback gain.

## Measured results per clip

Periodicity is the median over 40 ms frames above -40 dBFS of the maximum normalized autocorrelation at lags of 2.5 to
12.5 ms; the neutral synthesized input measures 0.56 to 0.78 and every whisper clip is below 0.30.

<!-- voice:clips:start -->
| File | Message | Duration (s) | Loudness (LUFS) | True peak (dBTP) | Periodicity |
|---|---|---|---|---|---|
| `mujer/m01.m4a` | siempre te recordaré | 3.181 | -20.064 | -3.419 | 0.233 |
| `mujer/m02.m4a` | siempre en mis pensamientos | 3.576 | -20.051 | -4.361 | 0.245 |
| `mujer/m03.m4a` | gracias | 2.229 | -20.064 | -3.353 | 0.199 |
| `mujer/m04.m4a` | sigue así | 2.392 | -20.075 | -4.743 | 0.248 |
| `mujer/m05.m4a` | lo estás haciendo bien | 3.111 | -20.057 | -5.471 | 0.231 |
| `mujer/m06.m4a` | descansa, lo estás haciendo bien | 4.319 | -20.069 | -4.959 | 0.202 |
| `mujer/m07.m4a` | también te extraño | 2.856 | -20.048 | -3.416 | 0.191 |
| `mujer/m08.m4a` | hoy vine a verte | 2.879 | -20.037 | -3.294 | 0.266 |
| `mujer/m09.m4a` | qué gusto me da verte | 3.042 | -20.044 | -3.296 | 0.246 |
| `mujer/m10.m4a` | cuánto tiempo sin verte | 3.228 | -20.055 | -3.264 | 0.253 |
| `mujer/m11.m4a` | te extrañaba mucho | 3.019 | -20.053 | -3.426 | 0.234 |
| `mujer/m12.m4a` | déjame verte un ratito | 3.855 | -20.040 | -3.536 | 0.245 |
| `mujer/m13.m4a` | tu luz me trajo hasta aquí | 3.437 | -20.059 | -3.309 | 0.210 |
| `mujer/m14.m4a` | seguí las flores hasta ti | 3.413 | -20.064 | -3.293 | 0.252 |
| `mujer/m15.m4a` | gracias por las flores | 3.181 | -20.070 | -3.566 | 0.218 |
| `mujer/m16.m4a` | gracias por acordarte de mí | 3.413 | -20.056 | -3.353 | 0.225 |
| `mujer/m17.m4a` | cada año vuelvo a verte | 3.808 | -20.051 | -3.499 | 0.213 |
| `mujer/m18.m4a` | vine a darte un abrazo | 3.413 | -20.041 | -3.243 | 0.229 |
| `mujer/m19.m4a` | qué bonito es volver a verte | 3.576 | -20.048 | -3.287 | 0.249 |
| `mujer/m20.m4a` | aquí sigo, cerquita de ti | 3.994 | -20.044 | -3.290 | 0.255 |
| `mujer/m21.m4a` | sigo en tu corazón | 2.949 | -20.059 | -5.324 | 0.208 |
| `mujer/m22.m4a` | te llevo en el corazón | 2.902 | -20.061 | -4.105 | 0.227 |
| `mujer/m23.m4a` | nunca me olvido de ti | 3.019 | -20.027 | -3.279 | 0.281 |
| `mujer/m24.m4a` | me acuerdo de ti todos los días | 3.506 | -20.047 | -3.248 | 0.219 |
| `mujer/m25.m4a` | me acuerdo de tu risa | 2.902 | -20.044 | -3.250 | 0.250 |
| `mujer/m26.m4a` | mientras me recuerdes, aquí estoy | 4.272 | -20.049 | -3.313 | 0.247 |
| `mujer/m27.m4a` | vivo en tus recuerdos | 2.995 | -20.058 | -3.328 | 0.231 |
| `mujer/m28.m4a` | me llevo tu cariño | 2.926 | -20.038 | -3.953 | 0.247 |
| `mujer/m29.m4a` | nuestro cariño no se acaba | 3.529 | -20.058 | -4.210 | 0.214 |
| `mujer/m30.m4a` | guardo cada momento contigo | 3.692 | -20.031 | -3.341 | 0.233 |
| `mujer/m31.m4a` | aquí estoy contigo | 3.297 | -20.042 | -3.386 | 0.237 |
| `mujer/m32.m4a` | camino a tu lado | 2.856 | -20.037 | -3.510 | 0.217 |
| `mujer/m33.m4a` | te acompaño aunque no me veas | 3.785 | -20.050 | -3.253 | 0.208 |
| `mujer/m34.m4a` | estoy más cerca de lo que crees | 3.553 | -20.061 | -3.983 | 0.232 |
| `mujer/m35.m4a` | siempre te cuido | 2.949 | -20.049 | -3.376 | 0.227 |
| `mujer/m36.m4a` | seguimos juntos | 2.972 | -20.060 | -4.553 | 0.237 |
| `mujer/m37.m4a` | nunca me fui del todo | 3.228 | -20.032 | -3.735 | 0.273 |
| `mujer/m38.m4a` | estoy en cada vela que enciendes | 3.762 | -20.059 | -4.962 | 0.240 |
| `mujer/m39.m4a` | me quedo un ratito contigo | 3.947 | -20.037 | -3.257 | 0.268 |
| `mujer/m40.m4a` | te veo y sonrío | 3.460 | -20.040 | -3.318 | 0.258 |
| `mujer/m41.m4a` | cuánto te quiero | 2.740 | -20.037 | -3.264 | 0.242 |
| `mujer/m42.m4a` | me llenas de orgullo | 3.088 | -20.037 | -3.880 | 0.259 |
| `mujer/m43.m4a` | tú puedes | 2.252 | -20.045 | -3.287 | 0.230 |
| `mujer/m44.m4a` | confía en ti | 2.670 | -20.028 | -3.312 | 0.259 |
| `mujer/m45.m4a` | todo va a estar bien | 3.088 | -20.038 | -3.786 | 0.222 |
| `mujer/m46.m4a` | no tengas miedo | 2.879 | -20.035 | -4.082 | 0.240 |
| `mujer/m47.m4a` | eres más fuerte de lo que crees | 3.553 | -20.061 | -3.569 | 0.230 |
| `mujer/m48.m4a` | ve con calma, no hay prisa | 4.133 | -20.057 | -3.360 | 0.214 |
| `mujer/m49.m4a` | sigue adelante, yo te acompaño | 4.389 | -20.052 | -3.293 | 0.223 |
| `mujer/m50.m4a` | vive bonito | 2.624 | -20.038 | -3.313 | 0.254 |
| `mujer/m51.m4a` | sé feliz, te lo mereces | 3.553 | -20.064 | -3.255 | 0.227 |
| `mujer/m52.m4a` | ríe mucho, me encanta tu risa | 4.458 | -20.058 | -3.374 | 0.233 |
| `mujer/m53.m4a` | cuida a los tuyos | 2.902 | -20.052 | -5.029 | 0.223 |
| `mujer/m54.m4a` | abraza fuerte a quien quieres | 3.367 | -20.062 | -3.454 | 0.233 |
| `mujer/m55.m4a` | abrígate y come bien | 3.506 | -20.052 | -3.347 | 0.253 |
| `mujer/m56.m4a` | date un descanso, te lo has ganado | 4.365 | -20.054 | -3.281 | 0.228 |
| `mujer/m57.m4a` | tu esfuerzo vale mucho | 3.274 | -20.061 | -3.233 | 0.229 |
| `mujer/m58.m4a` | eres luz para los tuyos | 3.413 | -20.055 | -3.264 | 0.231 |
| `mujer/m59.m4a` | te mando un abrazo grande | 3.437 | -20.062 | -4.392 | 0.225 |
| `mujer/m60.m4a` | gracias por tanto cariño | 3.460 | -20.043 | -3.353 | 0.219 |
| `mujer/m61.m4a` | hoy es fiesta, disfrútala | 3.576 | -20.069 | -3.366 | 0.215 |
| `mujer/m62.m4a` | canta y baila por mí | 3.599 | -20.038 | -3.358 | 0.244 |
| `hombre/m01.m4a` | siempre te recordaré | 3.367 | -20.074 | -4.774 | 0.239 |
| `hombre/m02.m4a` | siempre en mis pensamientos | 3.506 | -20.068 | -4.082 | 0.232 |
| `hombre/m03.m4a` | gracias | 2.415 | -20.048 | -3.331 | 0.211 |
| `hombre/m04.m4a` | sigue así | 2.508 | -20.067 | -4.083 | 0.228 |
| `hombre/m05.m4a` | lo estás haciendo bien | 3.529 | -20.075 | -3.405 | 0.245 |
| `hombre/m06.m4a` | descansa, lo estás haciendo bien | 4.180 | -20.071 | -3.136 | 0.236 |
| `hombre/m07.m4a` | también te extraño | 3.204 | -20.079 | -3.304 | 0.236 |
| `hombre/m08.m4a` | hoy vine a verte | 3.019 | -20.038 | -3.294 | 0.232 |
| `hombre/m09.m4a` | qué gusto me da verte | 3.320 | -20.066 | -3.382 | 0.245 |
| `hombre/m10.m4a` | cuánto tiempo sin verte | 3.483 | -20.060 | -3.303 | 0.237 |
| `hombre/m11.m4a` | te extrañaba mucho | 3.251 | -19.998 | -3.112 | 0.227 |
| `hombre/m12.m4a` | déjame verte un ratito | 3.437 | -20.066 | -3.446 | 0.240 |
| `hombre/m13.m4a` | tu luz me trajo hasta aquí | 3.738 | -20.066 | -3.321 | 0.245 |
| `hombre/m14.m4a` | seguí las flores hasta ti | 3.529 | -20.057 | -3.302 | 0.227 |
| `hombre/m15.m4a` | gracias por las flores | 3.228 | -20.056 | -3.287 | 0.240 |
| `hombre/m16.m4a` | gracias por acordarte de mí | 3.692 | -20.069 | -3.291 | 0.229 |
| `hombre/m17.m4a` | cada año vuelvo a verte | 3.576 | -20.055 | -3.285 | 0.242 |
| `hombre/m18.m4a` | vine a darte un abrazo | 3.413 | -20.068 | -3.355 | 0.219 |
| `hombre/m19.m4a` | qué bonito es volver a verte | 3.878 | -20.076 | -3.244 | 0.231 |
| `hombre/m20.m4a` | aquí sigo, cerquita de ti | 3.622 | -20.060 | -3.296 | 0.249 |
| `hombre/m21.m4a` | sigo en tu corazón | 3.135 | -20.068 | -4.304 | 0.228 |
| `hombre/m22.m4a` | te llevo en el corazón | 3.367 | -20.076 | -3.333 | 0.211 |
| `hombre/m23.m4a` | nunca me olvido de ti | 3.344 | -20.044 | -3.254 | 0.239 |
| `hombre/m24.m4a` | me acuerdo de ti todos los días | 4.063 | -20.059 | -3.262 | 0.237 |
| `hombre/m25.m4a` | me acuerdo de tu risa | 3.390 | -20.064 | -3.235 | 0.217 |
| `hombre/m26.m4a` | mientras me recuerdes, aquí estoy | 4.133 | -20.071 | -3.288 | 0.236 |
| `hombre/m27.m4a` | vivo en tus recuerdos | 3.506 | -20.060 | -3.827 | 0.217 |
| `hombre/m28.m4a` | me llevo tu cariño | 3.274 | -20.058 | -3.295 | 0.235 |
| `hombre/m29.m4a` | nuestro cariño no se acaba | 3.762 | -20.011 | -3.234 | 0.226 |
| `hombre/m30.m4a` | guardo cada momento contigo | 3.831 | -20.057 | -3.302 | 0.227 |
| `hombre/m31.m4a` | aquí estoy contigo | 3.274 | -20.058 | -3.297 | 0.250 |
| `hombre/m32.m4a` | camino a tu lado | 3.019 | -20.070 | -3.321 | 0.229 |
| `hombre/m33.m4a` | te acompaño aunque no me veas | 4.087 | -20.058 | -3.258 | 0.217 |
| `hombre/m34.m4a` | estoy más cerca de lo que crees | 4.017 | -20.060 | -3.348 | 0.234 |
| `hombre/m35.m4a` | siempre te cuido | 2.926 | -20.075 | -3.360 | 0.236 |
| `hombre/m36.m4a` | seguimos juntos | 2.926 | -20.062 | -3.228 | 0.236 |
| `hombre/m37.m4a` | nunca me fui del todo | 3.320 | -20.064 | -3.414 | 0.243 |
| `hombre/m38.m4a` | estoy en cada vela que enciendes | 4.040 | -20.056 | -3.645 | 0.228 |
| `hombre/m39.m4a` | me quedo un ratito contigo | 3.715 | -20.062 | -3.276 | 0.224 |
| `hombre/m40.m4a` | te veo y sonrío | 3.065 | -20.078 | -4.677 | 0.223 |
| `hombre/m41.m4a` | cuánto te quiero | 2.810 | -20.057 | -3.265 | 0.228 |
| `hombre/m42.m4a` | me llenas de orgullo | 3.181 | -20.084 | -3.847 | 0.234 |
| `hombre/m43.m4a` | tú puedes | 2.531 | -20.060 | -3.321 | 0.226 |
| `hombre/m44.m4a` | confía en ti | 2.763 | -20.050 | -3.294 | 0.226 |
| `hombre/m45.m4a` | todo va a estar bien | 3.413 | -20.006 | -4.884 | 0.233 |
| `hombre/m46.m4a` | no tengas miedo | 3.019 | -20.073 | -3.235 | 0.232 |
| `hombre/m47.m4a` | eres más fuerte de lo que crees | 3.878 | -20.059 | -3.135 | 0.242 |
| `hombre/m48.m4a` | ve con calma, no hay prisa | 3.738 | -20.065 | -3.275 | 0.200 |
| `hombre/m49.m4a` | sigue adelante, yo te acompaño | 3.855 | -20.070 | -3.270 | 0.236 |
| `hombre/m50.m4a` | vive bonito | 2.740 | -20.053 | -4.046 | 0.234 |
| `hombre/m51.m4a` | sé feliz, te lo mereces | 3.320 | -20.078 | -3.442 | 0.219 |
| `hombre/m52.m4a` | ríe mucho, me encanta tu risa | 4.017 | -20.073 | -3.319 | 0.220 |
| `hombre/m53.m4a` | cuida a los tuyos | 2.902 | -20.059 | -3.261 | 0.224 |
| `hombre/m54.m4a` | abraza fuerte a quien quieres | 3.715 | -20.050 | -3.311 | 0.251 |
| `hombre/m55.m4a` | abrígate y come bien | 3.320 | -20.054 | -3.292 | 0.240 |
| `hombre/m56.m4a` | date un descanso, te lo has ganado | 4.110 | -20.078 | -3.303 | 0.210 |
| `hombre/m57.m4a` | tu esfuerzo vale mucho | 3.576 | -20.087 | -3.330 | 0.242 |
| `hombre/m58.m4a` | eres luz para los tuyos | 3.297 | -20.067 | -3.358 | 0.249 |
| `hombre/m59.m4a` | te mando un abrazo grande | 3.692 | -20.090 | -3.552 | 0.223 |
| `hombre/m60.m4a` | gracias por tanto cariño | 3.669 | -20.093 | -3.310 | 0.220 |
| `hombre/m61.m4a` | hoy es fiesta, disfrútala | 3.599 | -20.069 | -3.304 | 0.229 |
| `hombre/m62.m4a` | canta y baila por mí | 3.320 | -20.053 | -3.276 | 0.221 |
<!-- voice:clips:end -->

The tables on this page are written from the pipeline's outputs by `python -m pipeline.voice.doc_tables` (`--check`
fails when they are stale). Tests (`pipeline/voice/tests`) cover the whisper on a synthetic voice (periodicity from above 0.5 to below 0.3, spectral
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
