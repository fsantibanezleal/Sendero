#!/usr/bin/env bash
# Install a Sendero APK on the connected tablet or emulator with adb, and start the app.
# Usage: scripts/install-apk.sh [path/to/app.apk] [adb-serial]
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
apk="${1:-$(ls -t "$root"/dist/*.apk 2>/dev/null | head -1)}"
[ -n "$apk" ] && [ -f "$apk" ] || { echo "No APK found; run scripts/build-apk.sh first" >&2; exit 1; }
adb="${ANDROID_HOME:?ANDROID_HOME must point to the Android SDK}/platform-tools/adb"
target=(); [ $# -ge 2 ] && target=(-s "$2")
"$adb" "${target[@]}" install -r -g "$apk"
"$adb" "${target[@]}" shell monkey -p com.faslwork.sendero -c android.intent.category.LAUNCHER 1 >/dev/null
echo "Installed and started: $apk"
