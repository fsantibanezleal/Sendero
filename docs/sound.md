# Sound

Music plays all the time; a whispered message sounds under it at the end of each visit.

## Where the music comes from

`src/audio/playlist.ts`, `src/audio/importMusic.ts`.

- The owner's own music: the film music the owner holds (for example the Coco soundtrack, Walt Disney Records, which
  cannot be redistributed and is never in this repository) is put on the tablet in one of two ways. From the staff
  panel, "Importar música de una carpeta" opens the Android folder picker and copies every audio file of the chosen
  folder into the app's private storage (a copy, because persisted folder grants are not documented for
  expo-file-system). Or by cable: `scripts/push-music` copies files into the app's external files folder
  (`Android/data/com.faslwork.sendero/files/music`), which the app reads without any permission.
- The bundled traditional set: four public-domain recordings from the Library of Congress National Jukebox, mastered
  by the pipeline (`docs/music.md`, `ASSETS.md`): La llorona (1917), Las golondrinas (1920), Sobre las olas (1904),
  Adios, muchachas (1915).
- The playlist: when the owner has imported music it leads, shuffled, with one traditional recording after every two
  of the owner's tracks ("Mezclar música tradicional", on by default); otherwise the traditional set plays, shuffled.
  Each round is rebuilt when it ends and after an import.

## The engine

`src/audio/soundEngine.ts` on `expo-audio` (Expo SDK 58):

- Two music players alternate. Six seconds before a track ends the next one starts silent on the other player, and both
  ramp over four seconds with equal-power gains (cos and sin of the progress, so the total power stays constant).
  expo-audio has no fade API, so the ramps run on a 20 Hz timer (research-android D4).
- Ducking: when the message appears the music drops by 6 dB over 0.4 s, and returns over 1.5 s at the return. The
  owner asked for the music to be "a little soft" under the voice; broadcast-style ducking of 10 dB or more would bury
  the altar's mood.
- The players mix with each other (`interruptionMode: 'mixWithOthers'`); playback stays in the foreground.
- A track that has not loaded in 8 seconds is skipped, so one bad file never silences the altar.
- Volumes for the music and the voice are set in the staff panel.

## The whisper

The seven messages are pre-rendered offline as whispered, distant clips in a woman's voice and a man's voice
(`docs/voice.md`, `assets/voice/`). The clip plays 0.6 s after the message appears, in the voice that matches the
person who walked the path. A family member's recorded voice can replace the clips (same file names, same loudness
target), as `docs/voice.md` explains.
