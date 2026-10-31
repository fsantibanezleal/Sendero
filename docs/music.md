# Music

Sendero plays music continuously. The repository is public, so the bundled default set holds only recordings that
may be redistributed. The owner's own tracks (the Coco soundtrack and any other commercial recording) are imported
on the tablet into the app's private storage and are never committed (`ASSETS.md`).

## The bundled set

Ten instrumental pieces by Kevin MacLeod (incompetech.com), piano and small ensemble, about 28 minutes in total, each
under Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/). They replaced, on 2026-10-30,
four Library of Congress recordings from 1904 to 1920 that were free to bundle but full of surface noise; the owner
asked for "good quality heartfelt music, warm".

| Track | Year | Composition |
|---|---|---|
| Gymnopedie No 1 | 2011 | Erik Satie (died 1925), arranged by Kevin MacLeod |
| Lost Time | 2015 | Kevin MacLeod |
| Gymnopedie No 3 | 2011 | Erik Satie (died 1925), arranged by Kevin MacLeod |
| Bittersweet | 2017 | Kevin MacLeod |
| Autumn Day | 2010 | Kevin MacLeod |
| Angel Share | 2017 | Kevin MacLeod |
| Dreamer | 2016 | Kevin MacLeod |
| Private Reflection | 2009 | Kevin MacLeod |
| Heartwarming | 2007 | Kevin MacLeod |
| Touching Moments Two - Higher | 2006 | Kevin MacLeod |

How they were chosen: 21 pieces of the catalogue were measured for loudness range and spectral centroid, and those
with sudden swells (a loudness range above 12 dB) or a bright sound (centroid above 1500 Hz) were dropped, along with
the very short and the sad ones by title. The measurements cannot judge taste: the owner decides by listening, and
the manifest is the place to change the set. None of the pieces is Mexican: no clean recording of a traditional
melody under a redistributable licence was found, and the owner's own soundtrack, imported on the tablet, is the
place for them.

Credit text, which the licence requires: `"<title>" Kevin MacLeod (incompetech.com), licensed under Creative Commons:
By Attribution 4.0`. The catalog holds it per track and `ASSETS.md` lists it.

Anything added from another source follows `pipeline/music/rules.py` for its composition: free when it is traditional,
or when its composer died before 1926 (Mexican term, life plus 100 years) and it was published before 1931 (United
States).

## Mastering chain

`pipeline/music/master.py`, in this order:

1. Decode the MP3 to mono, 44.1 kHz, 32-bit float (ffmpeg from the `imageio-ffmpeg` package).
2. 50 Hz high-pass, 2nd order Butterworth, against rumble.
3. Raised-cosine fade in of 1.5 s and fade out of 3 s.
4. Integrated loudness to -16 LUFS (ITU-R BS.1770 through pyloudnorm 0.2.0).
5. True peak at or under -1 dBTP, measured on a 4x oversampled signal, held by lookahead gain reduction (5 ms)
   with a 0.5 dB margin; the loudness is then re-levelled and the pair iterated to convergence.
6. AAC in `.m4a`, 128 kb/s, mono, 44.1 kHz, bit-exact flags and no metadata, so a re-run reproduces the bytes.

The loudness and true peak written to the catalog are measured on the decoded `.m4a`, so the encoder is inside the
measurement; the step retargets when the encoder moves either value out of tolerance (0.3 LU, -1 dBTP).

Targets and sources: -16 LUFS integrated for music (AES TD1008 as quoted in secondary articles; the standard
itself was not read) and -14 LUFS on Spotify playback (https://support.spotify.com/ca-en/artists/article/loudness-normalization/);
true peak at or under -1 dBTP and ITU-R BS.1770 measurement per EBU R 128 (https://en.wikipedia.org/wiki/EBU_R_128).
A quiet kiosk is satisfied by -18 to -16 LUFS.

The measured loudness, true peak and duration of each track are in `assets/music/catalog.json`.

## The owner's own tracks

At an event the owner imports the tracks they hold on the tablet; the app copies them into its private storage and
plays them in place of, or beside, the bundled set. They are never in the repository and never in a build; the
repository guard and `.gitignore` keep commercial recordings out.

## Reproduce

```powershell
pipeline/.venv/Scripts/python.exe -m pipeline.music.fetch
pipeline/.venv/Scripts/python.exe -m pipeline.music.master
```

Setup and data root: `pipeline/README.md`.
