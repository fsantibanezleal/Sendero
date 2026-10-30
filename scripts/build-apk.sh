#!/usr/bin/env bash
# Build the standalone Sendero APK locally (expo prebuild + Gradle), no EAS and no dev server.
# Usage: scripts/build-apk.sh [--abi arm64-v8a[,x86_64]] [--variant release|debug] [--clean]
# Requirements: Node 22, JDK 17 in JAVA_HOME, ANDROID_HOME with platform 37.0 and build-tools 37.0.0.
# Release signing reads SENDERO_UPLOAD_* Gradle properties when present (see build-apk.ps1).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
abi="arm64-v8a"; variant="release"; clean=0
while [ $# -gt 0 ]; do
  case "$1" in
    --abi) abi="$2"; shift 2 ;;
    --variant) variant="$2"; shift 2 ;;
    --clean) clean=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
major="$(node --version | sed 's/^v//' | cut -d. -f1)"
[ "$major" -ge 22 ] || { echo "Node 22 or newer is required" >&2; exit 1; }
"${JAVA_HOME:?JAVA_HOME must point to a JDK 17}/bin/java" -version 2>&1 | head -1 | grep -q '"17\.' \
  || { echo "JDK 17 is required for the Android build" >&2; exit 1; }
: "${ANDROID_HOME:?ANDROID_HOME must point to the Android SDK}"

cd "$root"
args=(expo prebuild --platform android --no-install)
if [ "$clean" = 1 ] || [ ! -d android ]; then args+=(--clean); fi
npx "${args[@]}"
task="assembleRelease"; [ "$variant" = "debug" ] && task="assembleDebug"
(cd android && ./gradlew "$task" "-PreactNativeArchitectures=$abi" --no-daemon)
version="$(tr -d '[:space:]' < VERSION)"
mkdir -p dist
out="dist/sendero-$version-$variant-${abi//,/+}.apk"
cp "android/app/build/outputs/apk/$variant/app-$variant.apk" "$out"
echo "APK: $out"
