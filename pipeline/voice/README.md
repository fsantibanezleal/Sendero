# pipeline/voice

Offline pipeline that produces the whispered, distant-sounding clips of the seven remembrance messages, in a
woman's voice (`mujer`) and a man's voice (`hombre`). It never runs in CI and the app never runs it: the app reads
the committed `assets/voice/catalog.json` and the 14 `.m4a` files. The method and the measured results are in
[`docs/voice.md`](../../docs/voice.md).

## Run

From the repository root, with the Python 3.12 environment (junction `pipeline/voice/.venv` to the venvs root):

```powershell
uv venv <venvs root>/sendero-voice --python 3.12
cmd /c mklink /J pipeline\voice\.venv <venvs root>\sendero-voice
uv pip install --python pipeline/voice/.venv/Scripts/python.exe -r pipeline/voice/requirements.txt
uv pip install --python pipeline/voice/.venv/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cpu
uv pip install --python pipeline/voice/.venv/Scripts/python.exe kokoro==0.9.4
$env:SENDERO_MODELS_ROOT = "<models root>/sendero"
$env:SENDERO_SCRATCH = "<temp root>/sendero-voice"
pipeline/voice/.venv/Scripts/python.exe -m pipeline.voice.render
pipeline/voice/.venv/Scripts/python.exe -m pytest pipeline/voice/tests -q
```

Models are downloaded into `$SENDERO_MODELS_ROOT/voices` (3 tries each) and their SHA-256 is recorded in
`models.lock.json`. Models and the Piper engine (GPL-3.0, used only as a tool) are never committed.

## Files

| File | Role |
|---|---|
| `messages.json` | the seven messages, verbatim, with fixed ids m01 to m07 |
| `synth.py` | candidate voices, model download with hashes, neutral synthesis (Piper `length_scale` 1.3, Kokoro `speed` 0.8) |
| `select.py` | the F0 rule: `mujer` median F0 at or above 165 Hz, `hombre` at or below 155 Hz, never pitch-shifted |
| `measure.py` | median F0 (pyin), periodicity, integrated loudness, true peak, loudness normalization |
| `whisper.py` | normal speech to whisper: LPC order 24, noise excitation, formant shift (pure numpy and scipy) |
| `distance.py` | low-pass, synthesized room, pre-delay, wet and dry, lead silence and tail |
| `render.py` | orchestrates everything, encodes AAC and writes `assets/voice/catalog.json` |
| `selection.json` | the measured F0 of every candidate and the choice |
| `models.lock.json` | source URL, size and SHA-256 of every model file |
| `tests/` | pytest suite (DSP, selection rule, catalog contract) |

A rerun gives an identical `catalog.json` (sorted keys, floats rounded to three decimals): the Piper noise scales
are 0, the Kokoro vocoder is seeded, and the whisper noise is seeded from a hash of the voice id and message id.
