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

That sweep was on the whisper. The soft voice now in the clips measures a mean word error rate of 0.07 on the 124 clips
(0.10 for the whisper). Four short phrases are heard badly by the recognizer, whose weakest case they are: `hombre/m04`,
`mujer/m04` (sigue así), `hombre/m08` (hoy vine a verte) and `hombre/m50` (vive bonito); they need a human ear.
Measured on the committed clips:

<!-- voice:intelligibility:start -->
| File | Heard by the recognizer | Word error rate |
|---|---|---|
| `mujer/m01.m4a` | Siempre te recordaré. | 0.00 |
| `mujer/m02.m4a` | Siempre en mis pensamientos. | 0.00 |
| `mujer/m03.m4a` | Gracias. | 0.00 |
| `mujer/m04.m4a` | Sí que así. | 1.00 |
| `mujer/m05.m4a` | Lo estás haciendo bien. | 0.00 |
| `mujer/m06.m4a` | Descansa. Lo estás haciendo bien. | 0.00 |
| `mujer/m07.m4a` | También te extraño. | 0.00 |
| `mujer/m08.m4a` | Hoy vine a verte. | 0.00 |
| `mujer/m09.m4a` | ¡Qué gusto me da verte! | 0.00 |
| `mujer/m10.m4a` | ¿Cuánto tiempo sin verte? | 0.00 |
| `mujer/m11.m4a` | te extrañaba mucho | 0.00 |
| `mujer/m12.m4a` | Déjame verte un ratito. | 0.00 |
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
| `mujer/m33.m4a` | Te acompaño aunque no me veas. | 0.00 |
| `mujer/m34.m4a` | Estoy más cerca de lo que crees. | 0.00 |
| `mujer/m35.m4a` | Siempre te cuido. | 0.00 |
| `mujer/m36.m4a` | Seguimos juntos. | 0.00 |
| `mujer/m37.m4a` | Nunca me fui del todo. | 0.00 |
| `mujer/m38.m4a` | Estoy en cada vela que enciendes. | 0.00 |
| `mujer/m39.m4a` | Me quedo un ratito contigo. | 0.00 |
| `mujer/m40.m4a` | Te veo y sonrido. | 0.25 |
| `mujer/m41.m4a` | ¡Cuánto te quiero! | 0.00 |
| `mujer/m42.m4a` | Me llenas de orgullo. | 0.00 |
| `mujer/m43.m4a` | ¡Tú puedes! | 0.00 |
| `mujer/m44.m4a` | Confía en ti. | 0.00 |
| `mujer/m45.m4a` | Todo va a estar bien. | 0.00 |
| `mujer/m46.m4a` | No tengas miedo. | 0.00 |
| `mujer/m47.m4a` | Eres más fuerte de lo que crees. | 0.00 |
| `mujer/m48.m4a` | Ve con calma, no hay prisa. | 0.00 |
| `mujer/m49.m4a` | Sigue adelante. Yo te acompaño. | 0.00 |
| `mujer/m50.m4a` | Vive bonito. | 0.00 |
| `mujer/m51.m4a` | Sé feliz, te lo mereces. | 0.00 |
| `mujer/m52.m4a` | Ride mucho, me encanta tu risa. | 0.17 |
| `mujer/m53.m4a` | Cuida a los tuyos. | 0.00 |
| `mujer/m54.m4a` | Ablaza fuerte a quien quieres. | 0.20 |
| `mujer/m55.m4a` | Abrídate y come bien. | 0.25 |
| `mujer/m56.m4a` | Date un descanso, te lo has ganado. | 0.00 |
| `mujer/m57.m4a` | Tu esfuerzo vale mucho. | 0.00 |
| `mujer/m58.m4a` | Eres luz para los tuyos. | 0.00 |
| `mujer/m59.m4a` | Te mando un abrazo grande. | 0.00 |
| `mujer/m60.m4a` | Gracias por tanto cariño. | 0.00 |
| `mujer/m61.m4a` | Hoy es fiesta, disfrútala. | 0.00 |
| `mujer/m62.m4a` | ¡Canta y baila por mí! | 0.00 |
| `hombre/m01.m4a` | Siempre te recordaré. | 0.00 |
| `hombre/m02.m4a` | Siempre en mis pensamientos. | 0.00 |
| `hombre/m03.m4a` | ¡Gracias! | 0.00 |
| `hombre/m04.m4a` | ¡Los sigo ya! ¡Los sigo! | 2.50 |
| `hombre/m05.m4a` | Lo estás haciendo bien. | 0.00 |
| `hombre/m06.m4a` | Descansa lo estás haciendo bien. | 0.00 |
| `hombre/m07.m4a` | También te extraño. | 0.00 |
| `hombre/m08.m4a` | ¡Toy bien abertes! | 1.00 |
| `hombre/m09.m4a` | ¡Qué gusto me da verte! | 0.00 |
| `hombre/m10.m4a` | ¿Cuánto tiempo sin verte? | 0.00 |
| `hombre/m11.m4a` | Te extrañaba mucho. | 0.00 |
| `hombre/m12.m4a` | Déjame verte un ratito. | 0.00 |
| `hombre/m13.m4a` | Tu luz me trajo hasta aquí. | 0.00 |
| `hombre/m14.m4a` | Seguí las flores hasta ti. | 0.00 |
| `hombre/m15.m4a` | Gracias por las flores. | 0.00 |
| `hombre/m16.m4a` | Gracias por acordarte de mí. | 0.00 |
| `hombre/m17.m4a` | Cada año vuelvo a verte. | 0.00 |
| `hombre/m18.m4a` | ¡Vine a darte un abrazo! | 0.00 |
| `hombre/m19.m4a` | ¡Qué bonito es volver a verte! | 0.00 |
| `hombre/m20.m4a` | Aquí sigo cerca de ti. | 0.20 |
| `hombre/m21.m4a` | Sigo en tu corazón. | 0.00 |
| `hombre/m22.m4a` | Te llevo en el corazón. | 0.00 |
| `hombre/m23.m4a` | Nunca me olvido de ti. | 0.00 |
| `hombre/m24.m4a` | Me acuerdo de tight todos los días. | 0.14 |
| `hombre/m25.m4a` | Me acuerdo de tu risa. | 0.00 |
| `hombre/m26.m4a` | Mientras me recuerdes, aquí estoy. | 0.00 |
| `hombre/m27.m4a` | Vivo en tus recuerdos. | 0.00 |
| `hombre/m28.m4a` | Me llevo tu cariño. | 0.00 |
| `hombre/m29.m4a` | Nuestro cariño no se acaba. | 0.00 |
| `hombre/m30.m4a` | Guardo cada momento contigo. | 0.00 |
| `hombre/m31.m4a` | Aquí estoy contigo. | 0.00 |
| `hombre/m32.m4a` | Camino a tu lado. | 0.00 |
| `hombre/m33.m4a` | Te acompaño aunque no me veas. | 0.00 |
| `hombre/m34.m4a` | Estoy más cerca de lo que crees. | 0.00 |
| `hombre/m35.m4a` | Siempre te cuido. | 0.00 |
| `hombre/m36.m4a` | Seguimos juntos. | 0.00 |
| `hombre/m37.m4a` | Nunca me fui del todo. | 0.00 |
| `hombre/m38.m4a` | Estoy en cada vela que enciendes. | 0.00 |
| `hombre/m39.m4a` | Me quedo un ratito contigo. | 0.00 |
| `hombre/m40.m4a` | Te veo y sonrío. | 0.00 |
| `hombre/m41.m4a` | ¿Cuánto te quiero? | 0.00 |
| `hombre/m42.m4a` | Me llenas de orgullo. | 0.00 |
| `hombre/m43.m4a` | ¡Tú puedes! | 0.00 |
| `hombre/m44.m4a` | Confía en ti. | 0.00 |
| `hombre/m45.m4a` | Todo va a estar bien. | 0.00 |
| `hombre/m46.m4a` | No tengas miedo. | 0.00 |
| `hombre/m47.m4a` | Eres más fuerte de lo que crees. | 0.00 |
| `hombre/m48.m4a` | Ve con calma, no hay prisa. | 0.00 |
| `hombre/m49.m4a` | Sigue adelante, yo te acompaño. | 0.00 |
| `hombre/m50.m4a` | ¡Bei bebo nito! | 1.50 |
| `hombre/m51.m4a` | Sé feliz de lo mereces. | 0.20 |
| `hombre/m52.m4a` | Prie mucho, me encanta tu risa. | 0.17 |
| `hombre/m53.m4a` | Cuida a los tuyos. | 0.00 |
| `hombre/m54.m4a` | Abraza fuerte a quien quieres. | 0.00 |
| `hombre/m55.m4a` | Abrígate y come bien. | 0.00 |
| `hombre/m56.m4a` | Date un descanso, te lo has ganado. | 0.00 |
| `hombre/m57.m4a` | Tu esfuerzo vale mucho. | 0.00 |
| `hombre/m58.m4a` | Eres luz para los tuyos. | 0.00 |
| `hombre/m59.m4a` | Te mando un abrazo grande. | 0.00 |
| `hombre/m60.m4a` | Gracias por tanto cariño. | 0.00 |
| `hombre/m61.m4a` | Hoy es fiesta, disfrútala. | 0.00 |
| `hombre/m62.m4a` | Canta y vaila por mí. | 0.20 |
| mean | | 0.07 |
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
| `mujer/m01.m4a` | siempre te recordaré | 2.926 | -20.054 | -5.902 | 0.756 |
| `mujer/m02.m4a` | siempre en mis pensamientos | 3.460 | -20.021 | -6.844 | 0.753 |
| `mujer/m03.m4a` | gracias | 2.043 | -20.040 | -6.085 | 0.656 |
| `mujer/m04.m4a` | sigue así | 2.276 | -20.041 | -6.589 | 0.678 |
| `mujer/m05.m4a` | lo estás haciendo bien | 2.879 | -20.002 | -4.707 | 0.746 |
| `mujer/m06.m4a` | descansa, lo estás haciendo bien | 4.087 | -20.045 | -5.484 | 0.709 |
| `mujer/m07.m4a` | también te extraño | 2.647 | -20.053 | -3.145 | 0.765 |
| `mujer/m08.m4a` | hoy vine a verte | 2.763 | -20.027 | -6.079 | 0.775 |
| `mujer/m09.m4a` | qué gusto me da verte | 2.926 | -20.029 | -5.612 | 0.697 |
| `mujer/m10.m4a` | cuánto tiempo sin verte | 3.042 | -20.034 | -4.430 | 0.775 |
| `mujer/m11.m4a` | te extrañaba mucho | 2.833 | -20.030 | -4.443 | 0.760 |
| `mujer/m12.m4a` | déjame verte un ratito | 3.646 | -20.027 | -4.112 | 0.753 |
| `mujer/m13.m4a` | tu luz me trajo hasta aquí | 3.320 | -20.042 | -3.583 | 0.766 |
| `mujer/m14.m4a` | seguí las flores hasta ti | 3.274 | -20.024 | -4.765 | 0.681 |
| `mujer/m15.m4a` | gracias por las flores | 3.042 | -20.026 | -4.603 | 0.634 |
| `mujer/m16.m4a` | gracias por acordarte de mí | 3.251 | -20.035 | -5.611 | 0.759 |
| `mujer/m17.m4a` | cada año vuelvo a verte | 3.692 | -20.037 | -4.929 | 0.744 |
| `mujer/m18.m4a` | vine a darte un abrazo | 3.251 | -20.068 | -5.252 | 0.778 |
| `mujer/m19.m4a` | qué bonito es volver a verte | 3.506 | -20.034 | -6.461 | 0.755 |
| `mujer/m20.m4a` | aquí sigo, cerquita de ti | 3.878 | -20.030 | -4.882 | 0.729 |
| `mujer/m21.m4a` | sigo en tu corazón | 2.670 | -19.990 | -5.545 | 0.719 |
| `mujer/m22.m4a` | te llevo en el corazón | 2.694 | -20.029 | -3.275 | 0.722 |
| `mujer/m23.m4a` | nunca me olvido de ti | 2.833 | -20.030 | -7.308 | 0.779 |
| `mujer/m24.m4a` | me acuerdo de ti todos los días | 3.529 | -20.019 | -4.336 | 0.731 |
| `mujer/m25.m4a` | me acuerdo de tu risa | 2.879 | -20.015 | -3.723 | 0.658 |
| `mujer/m26.m4a` | mientras me recuerdes, aquí estoy | 4.063 | -20.037 | -3.693 | 0.745 |
| `mujer/m27.m4a` | vivo en tus recuerdos | 2.856 | -20.051 | -5.216 | 0.698 |
| `mujer/m28.m4a` | me llevo tu cariño | 2.786 | -20.029 | -3.783 | 0.735 |
| `mujer/m29.m4a` | nuestro cariño no se acaba | 3.251 | -20.032 | -3.985 | 0.673 |
| `mujer/m30.m4a` | guardo cada momento contigo | 3.483 | -20.025 | -4.534 | 0.768 |
| `mujer/m31.m4a` | aquí estoy contigo | 2.949 | -20.028 | -7.123 | 0.764 |
| `mujer/m32.m4a` | camino a tu lado | 2.717 | -20.020 | -5.640 | 0.767 |
| `mujer/m33.m4a` | te acompaño aunque no me veas | 3.762 | -20.039 | -3.465 | 0.778 |
| `mujer/m34.m4a` | estoy más cerca de lo que crees | 3.437 | -20.039 | -6.645 | 0.648 |
| `mujer/m35.m4a` | siempre te cuido | 2.670 | -20.026 | -5.422 | 0.670 |
| `mujer/m36.m4a` | seguimos juntos | 2.786 | -20.017 | -4.978 | 0.679 |
| `mujer/m37.m4a` | nunca me fui del todo | 2.926 | -20.036 | -6.548 | 0.719 |
| `mujer/m38.m4a` | estoy en cada vela que enciendes | 3.692 | -20.033 | -5.219 | 0.747 |
| `mujer/m39.m4a` | me quedo un ratito contigo | 3.692 | -20.030 | -5.628 | 0.735 |
| `mujer/m40.m4a` | te veo y sonrío | 3.204 | -20.034 | -5.481 | 0.749 |
| `mujer/m41.m4a` | cuánto te quiero | 2.531 | -20.030 | -5.037 | 0.745 |
| `mujer/m42.m4a` | me llenas de orgullo | 2.833 | -20.012 | -5.194 | 0.748 |
| `mujer/m43.m4a` | tú puedes | 2.136 | -20.031 | -4.032 | 0.666 |
| `mujer/m44.m4a` | confía en ti | 2.415 | -20.023 | -7.809 | 0.780 |
| `mujer/m45.m4a` | todo va a estar bien | 2.926 | -20.045 | -5.648 | 0.777 |
| `mujer/m46.m4a` | no tengas miedo | 2.647 | -20.023 | -5.947 | 0.780 |
| `mujer/m47.m4a` | eres más fuerte de lo que crees | 3.437 | -20.034 | -4.485 | 0.694 |
| `mujer/m48.m4a` | ve con calma, no hay prisa | 3.994 | -20.042 | -4.327 | 0.771 |
| `mujer/m49.m4a` | sigue adelante, yo te acompaño | 4.249 | -20.060 | -3.317 | 0.725 |
| `mujer/m50.m4a` | vive bonito | 2.368 | -20.017 | -5.944 | 0.737 |
| `mujer/m51.m4a` | sé feliz, te lo mereces | 3.483 | -20.038 | -4.111 | 0.697 |
| `mujer/m52.m4a` | ríe mucho, me encanta tu risa | 4.296 | -20.033 | -5.535 | 0.749 |
| `mujer/m53.m4a` | cuida a los tuyos | 2.740 | -20.021 | -8.324 | 0.759 |
| `mujer/m54.m4a` | abraza fuerte a quien quieres | 3.297 | -20.040 | -5.443 | 0.701 |
| `mujer/m55.m4a` | abrígate y come bien | 3.320 | -20.036 | -5.223 | 0.750 |
| `mujer/m56.m4a` | date un descanso, te lo has ganado | 4.180 | -20.042 | -4.561 | 0.749 |
| `mujer/m57.m4a` | tu esfuerzo vale mucho | 3.042 | -20.044 | -4.709 | 0.721 |
| `mujer/m58.m4a` | eres luz para los tuyos | 3.297 | -20.024 | -3.295 | 0.691 |
| `mujer/m59.m4a` | te mando un abrazo grande | 3.297 | -20.031 | -5.607 | 0.795 |
| `mujer/m60.m4a` | gracias por tanto cariño | 3.251 | -20.026 | -5.178 | 0.801 |
| `mujer/m61.m4a` | hoy es fiesta, disfrútala | 3.367 | -20.041 | -3.739 | 0.653 |
| `mujer/m62.m4a` | canta y baila por mí | 3.460 | -20.024 | -4.896 | 0.786 |
| `hombre/m01.m4a` | siempre te recordaré | 3.251 | -20.060 | -3.284 | 0.564 |
| `hombre/m02.m4a` | siempre en mis pensamientos | 3.553 | -20.030 | -3.351 | 0.593 |
| `hombre/m03.m4a` | gracias | 2.368 | -20.044 | -3.290 | 0.560 |
| `hombre/m04.m4a` | sigue así | 2.461 | -20.041 | -3.776 | 0.507 |
| `hombre/m05.m4a` | lo estás haciendo bien | 3.483 | -20.052 | -3.285 | 0.522 |
| `hombre/m06.m4a` | descansa, lo estás haciendo bien | 4.272 | -20.039 | -3.299 | 0.543 |
| `hombre/m07.m4a` | también te extraño | 3.228 | -20.027 | -3.302 | 0.580 |
| `hombre/m08.m4a` | hoy vine a verte | 3.019 | -20.018 | -4.691 | 0.565 |
| `hombre/m09.m4a` | qué gusto me da verte | 3.367 | -20.031 | -3.310 | 0.596 |
| `hombre/m10.m4a` | cuánto tiempo sin verte | 3.553 | -20.037 | -3.299 | 0.595 |
| `hombre/m11.m4a` | te extrañaba mucho | 3.251 | -20.049 | -3.351 | 0.559 |
| `hombre/m12.m4a` | déjame verte un ratito | 3.506 | -20.051 | -3.326 | 0.544 |
| `hombre/m13.m4a` | tu luz me trajo hasta aquí | 3.878 | -20.048 | -3.234 | 0.524 |
| `hombre/m14.m4a` | seguí las flores hasta ti | 3.622 | -20.028 | -3.277 | 0.491 |
| `hombre/m15.m4a` | gracias por las flores | 3.344 | -20.036 | -3.268 | 0.526 |
| `hombre/m16.m4a` | gracias por acordarte de mí | 3.738 | -20.036 | -3.277 | 0.538 |
| `hombre/m17.m4a` | cada año vuelvo a verte | 3.646 | -20.037 | -3.316 | 0.565 |
| `hombre/m18.m4a` | vine a darte un abrazo | 3.483 | -20.042 | -3.356 | 0.571 |
| `hombre/m19.m4a` | qué bonito es volver a verte | 3.971 | -20.044 | -3.340 | 0.614 |
| `hombre/m20.m4a` | aquí sigo, cerquita de ti | 3.692 | -20.034 | -3.277 | 0.528 |
| `hombre/m21.m4a` | sigo en tu corazón | 3.111 | -20.031 | -3.649 | 0.509 |
| `hombre/m22.m4a` | te llevo en el corazón | 3.344 | -20.039 | -3.731 | 0.567 |
| `hombre/m23.m4a` | nunca me olvido de ti | 3.483 | -20.025 | -3.289 | 0.627 |
| `hombre/m24.m4a` | me acuerdo de ti todos los días | 4.110 | -20.041 | -3.202 | 0.609 |
| `hombre/m25.m4a` | me acuerdo de tu risa | 3.437 | -20.040 | -3.308 | 0.581 |
| `hombre/m26.m4a` | mientras me recuerdes, aquí estoy | 4.133 | -20.041 | -3.295 | 0.560 |
| `hombre/m27.m4a` | vivo en tus recuerdos | 3.437 | -20.061 | -3.376 | 0.542 |
| `hombre/m28.m4a` | me llevo tu cariño | 3.344 | -20.050 | -3.446 | 0.601 |
| `hombre/m29.m4a` | nuestro cariño no se acaba | 3.785 | -20.050 | -3.277 | 0.529 |
| `hombre/m30.m4a` | guardo cada momento contigo | 4.040 | -20.038 | -3.300 | 0.595 |
| `hombre/m31.m4a` | aquí estoy contigo | 3.320 | -20.035 | -3.298 | 0.569 |
| `hombre/m32.m4a` | camino a tu lado | 3.088 | -20.041 | -3.239 | 0.559 |
| `hombre/m33.m4a` | te acompaño aunque no me veas | 4.063 | -20.048 | -3.328 | 0.596 |
| `hombre/m34.m4a` | estoy más cerca de lo que crees | 4.087 | -20.031 | -3.520 | 0.550 |
| `hombre/m35.m4a` | siempre te cuido | 2.879 | -20.050 | -3.415 | 0.473 |
| `hombre/m36.m4a` | seguimos juntos | 2.926 | -20.027 | -3.302 | 0.513 |
| `hombre/m37.m4a` | nunca me fui del todo | 3.344 | -20.003 | -3.239 | 0.579 |
| `hombre/m38.m4a` | estoy en cada vela que enciendes | 4.110 | -20.035 | -3.312 | 0.576 |
| `hombre/m39.m4a` | me quedo un ratito contigo | 3.785 | -20.030 | -3.286 | 0.525 |
| `hombre/m40.m4a` | te veo y sonrío | 3.135 | -20.046 | -4.262 | 0.605 |
| `hombre/m41.m4a` | cuánto te quiero | 2.810 | -20.033 | -3.245 | 0.514 |
| `hombre/m42.m4a` | me llenas de orgullo | 3.251 | -20.035 | -3.624 | 0.545 |
| `hombre/m43.m4a` | tú puedes | 2.415 | -20.049 | -3.312 | 0.609 |
| `hombre/m44.m4a` | confía en ti | 2.810 | -20.037 | -3.294 | 0.592 |
| `hombre/m45.m4a` | todo va a estar bien | 3.390 | -20.035 | -3.297 | 0.599 |
| `hombre/m46.m4a` | no tengas miedo | 3.042 | -20.037 | -3.705 | 0.559 |
| `hombre/m47.m4a` | eres más fuerte de lo que crees | 3.994 | -20.038 | -3.274 | 0.575 |
| `hombre/m48.m4a` | ve con calma, no hay prisa | 3.785 | -20.040 | -3.255 | 0.591 |
| `hombre/m49.m4a` | sigue adelante, yo te acompaño | 3.947 | -20.061 | -3.251 | 0.542 |
| `hombre/m50.m4a` | vive bonito | 2.740 | -20.030 | -3.312 | 0.650 |
| `hombre/m51.m4a` | sé feliz, te lo mereces | 3.367 | -20.049 | -3.315 | 0.583 |
| `hombre/m52.m4a` | ríe mucho, me encanta tu risa | 4.087 | -20.056 | -3.236 | 0.546 |
| `hombre/m53.m4a` | cuida a los tuyos | 2.902 | -20.031 | -3.381 | 0.591 |
| `hombre/m54.m4a` | abraza fuerte a quien quieres | 3.738 | -20.032 | -3.286 | 0.521 |
| `hombre/m55.m4a` | abrígate y come bien | 3.390 | -20.025 | -3.277 | 0.574 |
| `hombre/m56.m4a` | date un descanso, te lo has ganado | 4.180 | -20.054 | -3.267 | 0.543 |
| `hombre/m57.m4a` | tu esfuerzo vale mucho | 3.622 | -20.050 | -3.429 | 0.584 |
| `hombre/m58.m4a` | eres luz para los tuyos | 3.367 | -20.034 | -3.292 | 0.558 |
| `hombre/m59.m4a` | te mando un abrazo grande | 3.785 | -20.048 | -3.282 | 0.574 |
| `hombre/m60.m4a` | gracias por tanto cariño | 3.785 | -20.062 | -3.306 | 0.548 |
| `hombre/m61.m4a` | hoy es fiesta, disfrútala | 3.553 | -20.026 | -3.202 | 0.508 |
| `hombre/m62.m4a` | canta y baila por mí | 3.367 | -20.030 | -3.252 | 0.624 |
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
