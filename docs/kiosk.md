# Kiosk mode

Sendero runs unattended on a tablet at a Dia de Muertos altar for two days; visitors must not leave the app. On
Android this is done with lock task mode, which needs the app to be the device owner of the tablet. The native part
is the local Expo module `modules/sendero-kiosk` (Kotlin) plus the config plugin `plugins/with-kiosk.js`; the staff
exit logic is in `src/kiosk`. Nothing here uses the network.

## Why a local module

The maintained Expo kiosk libraries (`expo-kiosk-control`, `expo-kiosk`) only do screen pinning, without device
owner, and are stale for SDK 58. Screen pinning is not unattended-safe: the user can leave it with the system
gesture. So the app carries its own module (CAOS_MANAGE ADR-0008 and ADR-0013).

## What lock task mode does

- The device owner allowlists the app with `DevicePolicyManager.setLockTaskPackages`. An allowlisted app enters lock
  task mode with `Activity.startLockTask()` and leaves it with `Activity.stopLockTask()`. If the app is not
  allowlisted, `startLockTask()` falls back to screen pinning (state `'pinned'`).
- On Android 9 (API 28) and later `setLockTaskFeatures(admin, LOCK_TASK_FEATURE_NONE)` turns every optional system
  feature off: no status bar, no Home, no Recents, no notifications, no power dialog.
- `ActivityManager.getLockTaskModeState()` reports the state: `LOCK_TASK_MODE_LOCKED` is `'locked'`,
  `LOCK_TASK_MODE_PINNED` is `'pinned'`, anything else is `'off'`.
- `SenderoAdminReceiver.onLockTaskModeEntering` adds `UserManager.DISALLOW_CREATE_WINDOWS` (no toasts or overlays from
  other apps) and `onLockTaskModeExiting` clears it.

## What `enterKiosk` sets (device owner)

| Need | Call |
|---|---|
| Allowlist the app | `setLockTaskPackages(admin, [package])` |
| Hide system UI | `setLockTaskFeatures(admin, LOCK_TASK_FEATURE_NONE)` (API 28+) |
| Be the launcher | `addPersistentPreferredActivity(admin, MAIN + HOME + DEFAULT filter, MainActivity)` |
| Screen on while plugged | `setGlobalSetting(admin, STAY_ON_WHILE_PLUGGED_IN, AC or USB or WIRELESS)` |
| Block escapes | `addUserRestriction` of `DISALLOW_SAFE_BOOT`, `DISALLOW_FACTORY_RESET`, `DISALLOW_ADD_USER` and, API 28+, `DISALLOW_SYSTEM_ERROR_DIALOGS` |
| Keyguard and status bar | `setKeyguardDisabled(admin, true)` (API 28+), `setStatusBarDisabled(admin, true)` |

Then `startLockTask()` runs on the UI thread and the choice is saved in SharedPreferences `sendero_kiosk`, key
`enabled`. Without device owner only `startLockTask()` runs and the result is `'pinned'`.

`exitKiosk` reverses each call (`stopLockTask`, empty allowlist, `clearPackagePersistentPreferredActivities`,
restrictions cleared, keyguard and status bar back) and saves `enabled = false`; it never throws when already off.

## Surviving a reboot or an accidental exit

The app is the persistent HOME activity (`plugins/with-kiosk.js` adds a separate MAIN, HOME, DEFAULT intent filter to
`MainActivity`, next to the LAUNCHER filter, and sets `android:lockTaskMode="if_whitelisted"`). After a reboot Android
opens the HOME app on its own, so no boot receiver exists. On every activity resume
(`OnActivityEntersForeground`) the module calls `startLockTask()` again when `enabled` is true, the app is device
owner and `isLockTaskPermitted` is true.

## Staff exit

Hidden gesture (`src/kiosk/staffGesture.ts`): five taps within 3000 ms, each inside the upper-left square whose side is
12 percent of the smaller screen side. A tap outside the square, a first-to-fifth gap over 3000 ms or a clock that
goes backwards restarts the count. The fifth qualifying tap opens the PIN dialog.

PIN (`src/kiosk/pin.ts`): 4 to 8 digits, stored as `sha256(salt + ":" + pin)` in hex with a random 16-byte salt; the
digest is `digestStringAsync(CryptoDigestAlgorithm.SHA256, ...)` from expo-crypto, injected into the logic. The PIN is
set at first run and never lives in the repository.

After a correct PIN the staff panel can call `exitKiosk()` and, to free the tablet for good, `releaseDeviceOwner()`
(`DevicePolicyManager.clearDeviceOwnerApp`). `adb shell dpm remove-active-admin` does not work for the device owner of
a release app; a factory reset is the guaranteed fallback.

## JS API

`src/kiosk/kiosk.ts` wraps the module with `requireOptionalNativeModule`: without the module (Jest, a build without
it) `kioskState()` returns `'off'`, `isDeviceOwner()` false, `externalMusicDirectory()` an empty string and
`enterKiosk()` rejects with "kiosk module unavailable".

`externalMusicDirectory()` returns `getExternalFilesDir("music")` (created if missing), where the staff puts the
altar tracks.

## Limits

Provisioning needs a tablet without accounts (see `docs/guides/provision-kiosk.md`). `android:testOnly` is not used.
The exact API-level text of `setKeyguardDisabled` and `setStatusBarDisabled` was not confirmed on a primary page; with
`LOCK_TASK_FEATURE_NONE` lock task mode already hides the status bar and disables the lock screen, so both are
best-effort extras. Behavior on a real tablet is not yet verified.
