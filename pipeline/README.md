# Offline pipelines

Python tools that produce the committed music and gait assets. They never run in CI or on the tablet (ADR-0074);
run them by hand and commit their outputs. Raw inputs and scratch files live in the data root, never in the
repository.

## Setup

1. Pick a data root outside the repository and export it: `SENDERO_DATA_ROOT` (PowerShell
   `$env:SENDERO_DATA_ROOT = "<data root>/sendero"`, bash `export SENDERO_DATA_ROOT=<data root>/sendero`).
2. Create the virtual environment in the venvs root and link it into the repository (it is git-ignored):

   ```powershell
   uv venv <venvs root>/sendero --python 3.12
   cmd /c mklink /J pipeline\.venv <venvs root>\sendero
   uv pip install --python pipeline/.venv/Scripts/python.exe -r pipeline/requirements.txt
   ```

3. Run every command from the repository root.

## Music: public-domain recordings (`docs/music.md`)

```powershell
pipeline/.venv/Scripts/python.exe -m pipeline.music.fetch    # raw MP3 into <data root>/music/raw, hashes checked
pipeline/.venv/Scripts/python.exe -m pipeline.music.master   # assets/music/*.m4a and assets/music/catalog.json
```

`pipeline/music/manifest.json` lists every candidate with the composition rule applied (`include`, `reason`).
`fetch` checks the Public Domain Mark licence URL of each item and the SHA-256 against
`pipeline/music/manifest.lock.json`. Exit code 3 means an item was unreachable after retries: the others are done,
the catalog omits it.

## Gait: Fourier-fitted sagittal curves (`docs/gait.md`)

Put `WBDSascii.zip` and `WBDSinfo.csv` of https://doi.org/10.6084/m9.figshare.5722711 in `<data root>/gait/`
(`WBDSinfo.csv` is https://ndownloader.figshare.com/files/68504641), then:

```powershell
pipeline/.venv/Scripts/python.exe -m pipeline.gait.fit       # data/gait/fukuchi2018-sagittal.json
```

It also writes `<data root>/gait/fit-check.csv` (mean curve against fitted curve) for inspection.

## Tests

```powershell
pipeline/.venv/Scripts/python.exe -m pytest pipeline/tests -q
```

Re-running a step with the same inputs reproduces byte-identical outputs (sorted keys, floats rounded to four
decimals, bit-exact encoder flags).
