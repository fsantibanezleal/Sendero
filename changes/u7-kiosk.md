- Kiosk mode on Android: local Kotlin Expo module `modules/sendero-kiosk` (device owner, lock task mode, persistent
  HOME activity, screen on while plugged, user restrictions, screen pinning fallback) and config plugin
  `plugins/with-kiosk.js` (HOME intent filter and `lockTaskMode`, idempotent).
- Staff exit logic in `src/kiosk`: hidden five-tap corner gesture, hashed 4 to 8 digit PIN and a kiosk wrapper that
  degrades to `'off'` without the native module.
- Provisioning scripts `scripts/provision-kiosk.ps1` and `.sh`, and the docs `docs/kiosk.md` and
  `docs/guides/provision-kiosk.md`.
