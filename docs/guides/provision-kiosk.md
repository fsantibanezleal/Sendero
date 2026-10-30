# Provision the tablet as a kiosk

Steps to make Sendero the device owner of the altar tablet and lock it in. Background: `docs/kiosk.md`. You need the
APK (`docs/guides/build-and-install.md`), a USB cable and `adb`.

## 1. Factory reset and skip accounts

Android refuses `set-device-owner` while any account exists on the device. Factory reset the tablet and, in the setup
wizard, skip sign-in to Google, Samsung and any other account. If the tablet cannot be reset, remove every account in
Settings > Accounts; if `adb shell dumpsys account` still lists one, factory reset.

## 2. Developer options and USB debugging

Settings > About tablet: tap the build number seven times. Then Settings > Developer options: enable USB debugging and
accept the computer's key when the tablet asks.

## 3. Install the APK

```
scripts\install-apk.ps1        # Windows
scripts/install-apk.sh         # Linux or macOS
```

## 4. Make Sendero the device owner

```
scripts\provision-kiosk.ps1    # Windows
scripts/provision-kiosk.sh     # Linux or macOS
```

The script checks that adb sees exactly one device, prints the account count (and stops with instructions if any
account exists), checks that the app is installed, then runs

```
adb shell dpm set-device-owner com.faslwork.sendero/expo.modules.senderokiosk.SenderoAdminReceiver
```

and confirms with `adb shell dpm list-owners`. Pass the adb serial as the last argument (`-Serial` on Windows) when
more than one device is connected.

## 5. Enter kiosk

Open Sendero, tap five times in the upper-left corner within 3 seconds, set or enter the staff PIN and choose "Enter
kiosk" in the staff panel. The status bar, Home and Recents disappear, the screen stays on while the tablet is plugged
in, and the app reopens by itself after a reboot.

## 6. Exit and release

- Exit kiosk: staff gesture, PIN, "Exit kiosk". Home, Recents and the status bar come back.
- Free the tablet: after "Exit kiosk", choose "Release device owner". `scripts\provision-kiosk.ps1 -Release` (or
  `--release` in the shell script) prints these steps. `adb shell dpm remove-active-admin` does not work for the
  device owner of a release app.
- If the app cannot be opened or the PIN is lost, a factory reset frees the tablet.

## Troubleshooting

- "Not allowed to set the device owner because there are already some accounts on the device": step 1, remove every
  account or factory reset.
- "already several users" or a secondary user: remove the extra user in Settings > System > Multiple users.
- The tablet is not listed by `adb devices`: check the cable, the USB debugging prompt and the USB mode.
