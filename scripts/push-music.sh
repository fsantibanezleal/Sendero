#!/usr/bin/env bash
# Copy your own music files to the tablet by cable, into Sendero's external music folder
# (Android/data/com.faslwork.sendero/files/music), which the app reads without any permission.
# Usage: scripts/push-music.sh <music folder> [adb-serial]
set -euo pipefail
folder="${1:?usage: scripts/push-music.sh <music folder> [adb-serial]}"
[ -d "$folder" ] || { echo "Folder not found: $folder" >&2; exit 1; }
adb="${ANDROID_HOME:?ANDROID_HOME must point to the Android SDK}/platform-tools/adb"
target=(); [ $# -ge 2 ] && target=(-s "$2")
remote=/sdcard/Android/data/com.faslwork.sendero/files/music
"$adb" "${target[@]}" shell mkdir -p "$remote" >/dev/null
copied=0; total=0
shopt -s nullglob nocaseglob
for f in "$folder"/*.{mp3,m4a,aac,ogg,oga,opus,wav,flac}; do
  total=$((total + 1))
  if "$adb" "${target[@]}" push "$f" "$remote/$(basename "$f")" >/dev/null; then copied=$((copied + 1)); fi
done
[ "$total" -gt 0 ] || { echo "No audio files in $folder" >&2; exit 1; }
echo "Copied $copied of $total files to $remote."
