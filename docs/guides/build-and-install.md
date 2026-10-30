# Build and install

Sendero is always delivered as a standalone APK: the JavaScript bundle is inside, and no development server is
needed. The APK is built locally with Gradle; no cloud build service is required.

## Toolchain

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 or newer | `node --version` |
| JDK | 17 | `JAVA_HOME` must point to it for the Gradle build |
| Android SDK | platform `android-37.0`, build-tools `37.0.0`, NDK `27.1.12297006`, CMake `3.22.1` | `ANDROID_HOME`; on Windows the default SDK folder under `%LOCALAPPDATA%\Android\Sdk` is used when it is unset |
| Python | 3.12 | repository guards and the offline pipeline |

Install the SDK packages with the command line tools:

```bash
sdkmanager "platform-tools" "platforms;android-37.0" "build-tools;37.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
```

## Check

```bash
scripts/setup.sh          # or scripts\setup.ps1
npm run check             # typecheck, lint, tests, guards
```

## Build the APK

```powershell
.\scripts\build-apk.ps1                         # tablet (arm64-v8a), release
.\scripts\build-apk.ps1 -Abi arm64-v8a,x86_64   # also runs on the x86_64 emulator
.\scripts\build-apk.ps1 -Clean                  # regenerate the android folder
```

```bash
scripts/build-apk.sh --abi arm64-v8a,x86_64
```

On Windows the native C++ builds pass the 260-character path limit (CMake names object folders after
the absolute source path, so the repository path appears twice), and ninja fails with
`mkdir(...): No such file or directory`. Pass a short folder for those build trees:
`-CxxRoot <temp root>\sx` (or set `SENDERO_CXX_ROOT`); the config plugin
`plugins/with-short-native-build.js` moves each module's CMake staging folder there. The full Gradle
output is written to `dist\gradle-<variant>.log`.

The script runs `expo prebuild` (the `android` folder is generated and never committed), then
`gradlew assembleRelease` with the chosen ABIs, and copies the result to `dist/sendero-<version>-release-<abi>.apk`.
The first build compiles every native library and takes a long time; later builds are incremental.

Release signing: when the user Gradle properties file defines `SENDERO_UPLOAD_STORE_FILE`,
`SENDERO_UPLOAD_STORE_PASSWORD`, `SENDERO_UPLOAD_KEY_ALIAS` and `SENDERO_UPLOAD_KEY_PASSWORD`, the release is signed
with that keystore; the keystore is never part of this repository.

## Install

Connect the tablet by USB with developer options and USB debugging on, then:

```powershell
.\scripts\install-apk.ps1                 # newest APK in dist, installed and started
.\scripts\install-apk.ps1 -Serial <id>    # when several devices are connected
```

The camera permission is granted at install (`adb install -g`).
