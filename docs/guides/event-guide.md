# Event guide: setting up the altar tablet

Step by step, for the person who prepares the tablet. Allow about 45 minutes the first time.

## What you need

- An Android tablet, Android 8 or newer (Android 9 or newer for the full kiosk mode), with a front camera. A recent
  mid-range tablet runs the live cut-out; slower ones switch to the still cut-out by themselves.
- Its charger and a cable long enough to keep it plugged in at the altar.
- A computer with this repository's APK (`dist/` or the GitHub release) and `adb` (Android SDK platform tools).
- Your own music files (for example the Coco soundtrack you own) in a folder you can reach from the tablet or the
  computer.

## 1. Prepare the tablet (once)

Kiosk mode needs Sendero to be the tablet's device owner, which Android allows only on a tablet with no accounts:

1. Factory reset the tablet (Settings, System, Reset options).
2. In the setup wizard, connect to Wi-Fi only if you must, and skip every account sign-in.
3. Enable developer options (tap Build number seven times) and USB debugging.
4. Connect the tablet to the computer and accept the debugging prompt.

## 2. Install and provision

```powershell
.\scripts\install-apk.ps1                 # installs the newest APK in dist and opens it
.\scripts\provision-kiosk.ps1             # makes Sendero the device owner (checks there are no accounts)
```

The camera permission is granted at install. Details and how to undo it: `docs/guides/provision-kiosk.md`.

## 3. Load your music

Either from the tablet: open the staff panel (below), choose "Importar música de una carpeta" and pick the folder with
your files. Or from the computer: `.\scripts\push-music.ps1 -Folder <your music folder>`. The staff panel shows how
many of your tracks it found. Your music leads, with one traditional recording after every two of yours.

## 4. The staff panel

Tap five times, quickly, in the upper left corner of the screen (within three seconds). The first time, create a PIN
of 4 to 8 digits (twice). Then:

- Music: import, clear, mix the traditional recordings or not, music and voice volume.
- Experience: the cut-out mode (Automático, En vivo, Foto fija), the "Toca la pantalla" hint, "Probar una visita".
- Kiosk: "Activar el modo quiosco" locks the tablet into Sendero (no status bar, no home, no recents; it survives a
  restart and keeps the screen on while plugged in). "Salir del modo quiosco" unlocks it. "Liberar el dispositivo"
  removes the device owner (needed before a factory reset). "Cambiar el PIN".

Run "Probar una visita" a few times before the guests arrive.

## 5. At the altar

- Landscape, front camera at about the height of an adult's face, 1 to 2 metres from where people stand.
- Keep it plugged in. Light the visitor's face from the front (a lamp near the tablet); a bright window behind the
  visitor makes the cut-out worse.
- One visitor at a time works best: the model may include several people when they stand close together.
- A small card near the tablet helps: "Toca la pantalla. La cámara no graba ni guarda imágenes."

## 6. After the event

Open the staff panel, "Salir del modo quiosco", then "Liberar el dispositivo" if the tablet goes back to normal use.
