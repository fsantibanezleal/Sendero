#!/usr/bin/env bash
# Make Sendero the device owner of the connected tablet (kiosk mode, docs/guides/provision-kiosk.md).
# Usage: scripts/provision-kiosk.sh [--release] [adb-serial]
#   --release  print how to release the device owner (in the app) instead of provisioning.
set -euo pipefail
component="com.faslwork.sendero/expo.modules.senderokiosk.SenderoAdminReceiver"
package="com.faslwork.sendero"

release=0
serial=""
for arg in "$@"; do
  case "$arg" in
    --release) release=1 ;;
    *) serial="$arg" ;;
  esac
done

if [ "$release" -eq 1 ]; then
  cat <<'EOF'
Releasing the kiosk device owner is done inside the app, not with adb:
  1. Open Sendero, tap five times in the upper-left corner within 3 seconds, enter the staff PIN.
  2. In the staff panel choose "Exit kiosk", then "Release device owner".
`adb shell dpm remove-active-admin` does not work for the device owner of a release app.
If the app cannot be opened, a factory reset frees the tablet.
EOF
  exit 0
fi

adb="adb"
if [ -n "${ANDROID_HOME:-}" ] && [ -x "$ANDROID_HOME/platform-tools/adb" ]; then adb="$ANDROID_HOME/platform-tools/adb"; fi
command -v "$adb" >/dev/null 2>&1 || { echo "adb not found; set ANDROID_HOME or add platform-tools to PATH." >&2; exit 1; }
target=(); [ -n "$serial" ] && target=(-s "$serial")

devices="$("$adb" devices | tail -n +2 | grep -c -w device || true)"
if [ -z "$serial" ] && [ "$devices" -ne 1 ]; then
  echo "Expected exactly one connected device, found $devices. Connect the tablet or pass the adb serial." >&2
  exit 1
fi

accounts="$("$adb" "${target[@]}" shell dumpsys account | tr -d '\r' | grep -E '^ +Account \{' || true)"
count="$(printf '%s' "$accounts" | grep -c . || true)"
echo "Accounts on the device: $count"
if [ "$count" -gt 0 ]; then
  printf '%s\n' "$accounts"
  cat >&2 <<'EOF'
The device still has accounts, so Android refuses a device owner. Remove every account in
Settings > Accounts (Google, Samsung, Outlook), or factory reset and skip account sign-in in the
setup wizard, then run this script again.
EOF
  exit 1
fi

if ! "$adb" "${target[@]}" shell pm path "$package" | tr -d '\r' | grep -q '^package:'; then
  echo "$package is not installed. Run scripts/install-apk.sh first." >&2
  exit 1
fi

"$adb" "${target[@]}" shell dpm set-device-owner "$component"
echo "Device owners:"
"$adb" "${target[@]}" shell dpm list-owners
echo "Done. Open Sendero and enter kiosk from the staff panel."
