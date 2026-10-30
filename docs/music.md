# Music

Sendero plays music continuously. The repository is public, so the bundled default set holds only recordings that
may be redistributed. The owner's own tracks (the Coco soundtrack and any other commercial recording) are imported
on the tablet into the app's private storage and are never committed (`ASSETS.md`).

## The bundled set

Four recordings from the Library of Congress National Jukebox (1904 to 1920), mirrored on the Internet Archive,
about 13 minutes in total. Every Internet Archive item carries the licence URL
https://creativecommons.org/publicdomain/mark/1.0/ (Public Domain Mark: a statement that the work is in the public
domain, not a grant). `pipeline/music/fetch.py` fails if any item does not.

| Track | Performer, year | Composition | Why it may be redistributed |
|---|---|---|---|
| `llorona-1917` La llorona | Carmen Garcia Cornejo with Miguel Lerdo de Tejada, 1917 | Traditional Mexican folk song | Folk song of obscure origin. The verses Andres Henestrosa added date from about 1941, after this 1917 recording. Recording first published 1917: public domain in the United States under the Music Modernization Act (17 U.S.C. 1401) |
| `golondrinas-1920` Las golondrinas | Luis Alfonso Marron, 1920 | Narciso Serradell Sevilla (1843 to 1910), written 1862 | Composer died 1910, so the Mexican term (life plus 100 years) ended in 2010; published before 1931 |
| `sobre-las-olas-1904` Sobre las olas | Victor Dance Orchestra, 1904 | Juventino Rosas (1868 to 1894), named in the item metadata | Died 1894, term ended 1994 |
| `adios-muchachas-1915` Adios, muchachas! | Marimba Azul y Blanco, 1915 | Ivan Caryll (1861 to 1921), named in the item metadata | Died 1921, Mexican term ended 2021; published before 1931 |

Composition rule (`pipeline/music/rules.py`): a recording is bundled only if its composition is traditional, or its
composer died before 1926 (Mexican term, life plus 100 years) and it was published before 1931 (United States). A
composer who is not named in the metadata and cannot be identified from a cited source excludes the item. The
manifest `pipeline/music/manifest.json` records the decision and the reason for all 13 candidates, and a test keeps
it equal to the rule.

For Las golondrinas the item metadata does not name the composer; the composition is identified from the title and
the Mexican genre tag against https://en.wikipedia.org/wiki/La_golondrina. This is the one inclusion that rests on
a title-level identification, and the manifest says so.

Credit text (no licence requires it): "Library of Congress National Jukebox (public domain), <title>, <performer>,
<year>", courtesy of Sony Music Entertainment, digitized by the Library of Congress Packard Campus. The credits
screen reads the same fields from `assets/music/catalog.json`.

Open legal point: Mexican law on the old phonograms (neighbouring rights) was not retrieved; recordings from 1904
to 1920 are far older than any term in force, so expiry is very likely but not confirmed from the statute text.

### Excluded candidates

| Item | Reason |
|---|---|
| Cielito lindo (Trio Gonzalez, 1919) | Quirino Mendoza y Cortes died 1957; protected in Mexico to 2057 |
| Cielito (Orquesta Tata Pereira, 1921) | Composition not identified in the metadata (probably Cielito lindo, protected) |
| Las golondrinas (Maria Teran de Peralta, 1917) | Ecuadorian recording; composition (Serradell or a Becquer setting) cannot be told from the metadata |
| Las golondrinas de Becker (1908), Aires nacionales mexicanos (1908), El ultimo adios (1907), Adios a Guaymas (1920), Adios para siempre (1917), Adios a mi amada (1905) | Composer not named in the Internet Archive metadata and not identified from a cited source |

Cancion mixteca (Jose Lopez Alavez) and Amor eterno (Juan Gabriel) are protected and were never candidates.
Several excluded items are probably in the public domain; a follow-up that identifies their composers from the
Library of Congress catalogue (the site was unreachable from the pipeline host behind a bot challenge) would widen
the set. The manifest is the place to add them.

## Mastering chain

`pipeline/music/master.py`, in this order:

1. Decode the MP3 to mono, 44.1 kHz, 32-bit float (ffmpeg from the `imageio-ffmpeg` package).
2. 50 Hz high-pass, 2nd order Butterworth, against rumble.
3. Raised-cosine fade in of 1.5 s and fade out of 3 s.
4. Integrated loudness to -16 LUFS (ITU-R BS.1770 through pyloudnorm 0.2.0).
5. True peak at or under -1 dBTP, measured on a 4x oversampled signal, held by lookahead gain reduction (5 ms)
   with a 0.5 dB margin; the loudness is then re-levelled and the pair iterated to convergence.
6. AAC in `.m4a`, 96 kb/s, mono, 44.1 kHz, bit-exact flags and no metadata, so a re-run reproduces the bytes.

The loudness and true peak written to the catalog are measured on the decoded `.m4a`, so the encoder is inside the
measurement; the step retargets when the encoder moves either value out of tolerance (0.3 LU, -1 dBTP).

Targets and sources: -16 LUFS integrated for music (AES TD1008 as quoted in secondary articles; the standard
itself was not read) and -14 LUFS on Spotify playback (https://support.spotify.com/ca-en/artists/article/loudness-normalization/);
true peak at or under -1 dBTP and ITU-R BS.1770 measurement per EBU R 128 (https://en.wikipedia.org/wiki/EBU_R_128).
A quiet kiosk is satisfied by -18 to -16 LUFS. The recordings are acoustic (horn) recordings: noisy, narrow band
(about 4 kHz) and mono, so the bit rate and mono are enough.

Measured result (the catalog):

| Track | Loudness (LUFS) | True peak (dBTP) | Duration (s) |
|---|---|---|---|
| llorona-1917 | -16.01 | -1.20 | 176.1 |
| golondrinas-1920 | -16.06 | -1.20 | 152.8 |
| sobre-las-olas-1904 | -16.00 | -1.42 | 224.7 |
| adios-muchachas-1915 | -16.06 | -1.16 | 224.0 |

The catalog order alternates vocal and instrumental tracks where possible (only one vocal track is bundled).

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
