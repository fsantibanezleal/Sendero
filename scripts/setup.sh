#!/usr/bin/env bash
# Sendero setup: checks the toolchain and installs the JavaScript dependencies.
# Node 22 or newer is required; JDK 17 and the Android SDK are needed only to build the APK.
set -euo pipefail
command -v node >/dev/null || { echo "node not found on PATH: install or switch to Node 22" >&2; exit 1; }
major="$(node --version | sed 's/^v//' | cut -d. -f1)"
[ "$major" -ge 22 ] || { echo "Node $(node --version) found; Sendero needs Node 22 or newer" >&2; exit 1; }
cd "$(dirname "$0")/.."
npm ci
echo "Setup complete. 'npm run check' runs the local gate; scripts/build-apk.sh builds the APK."
