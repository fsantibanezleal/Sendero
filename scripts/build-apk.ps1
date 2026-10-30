<#
.SYNOPSIS
  Build the standalone Sendero APK locally (expo prebuild + Gradle), no EAS and no dev server.

.DESCRIPTION
  Requirements: Node 22 on PATH, JDK 17 in JAVA_HOME, the Android SDK in ANDROID_HOME (or the default
  SDK folder under LOCALAPPDATA) with platform 37.0 and build-tools 37.0.0.
  Release signing reads the Gradle properties SENDERO_UPLOAD_STORE_FILE, SENDERO_UPLOAD_STORE_PASSWORD,
  SENDERO_UPLOAD_KEY_ALIAS and SENDERO_UPLOAD_KEY_PASSWORD from the user Gradle properties file when
  they are present; the keystore itself never enters this repository.

.PARAMETER Abi
  Comma-separated ABIs to build (default arm64-v8a, the tablet). Add x86_64 for the emulator.

.PARAMETER Variant
  release (default) or debug.

.PARAMETER Clean
  Regenerate the android folder from scratch (expo prebuild --clean).

.PARAMETER CxxRoot
  A SHORT folder for the native C++ build trees (default: the SENDERO_CXX_ROOT environment variable).
  Required on Windows: the native build passes the 260-character path limit otherwise
  (plugins/with-short-native-build.js). Use a folder in your temporary-files area, for example
  <temp root>\sx.

.PARAMETER LogFile
  Where the full Gradle output is written (default: dist\gradle-<variant>.log).

.EXAMPLE
  .\scripts\build-apk.ps1 -Abi arm64-v8a,x86_64
#>
param(
  [string]$Abi = 'arm64-v8a',
  [ValidateSet('release', 'debug')][string]$Variant = 'release',
  [switch]$Clean,
  [string]$CxxRoot = $env:SENDERO_CXX_ROOT,
  [string]$LogFile
)
# Native tools write progress to stderr; Windows PowerShell 5.1 would turn that into errors under 'Stop'.
# Every native call below checks its exit code instead.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw "Node 22 or newer is required (found $(node --version))." }
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw 'JAVA_HOME must point to a JDK 17.' }
$javaVersion = (cmd /c "`"$env:JAVA_HOME\bin\java.exe`" -version 2>&1" | Select-Object -First 1)
if ($javaVersion -notmatch '"17\.') { throw "JDK 17 is required for the Android build (found: $javaVersion)." }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path "$env:ANDROID_HOME\platforms")) { throw "Android SDK not found at $env:ANDROID_HOME." }
if (-not $CxxRoot) { throw 'Set -CxxRoot (or SENDERO_CXX_ROOT) to a short folder, for example <temp root>\sx: Windows paths over 260 characters break the native build.' }
if ($CxxRoot.Length -gt 20) { Write-Warning "CxxRoot '$CxxRoot' is long; keep it under about 20 characters." }
New-Item -ItemType Directory -Force $CxxRoot | Out-Null
$env:SENDERO_CXX_ROOT = (Resolve-Path $CxxRoot).Path

Push-Location $root
try {
  $prebuild = @('expo', 'prebuild', '--platform', 'android', '--no-install')
  if ($Clean -or -not (Test-Path 'android')) { $prebuild += '--clean' }
  npx @prebuild
  if ($LASTEXITCODE -ne 0) { throw "expo prebuild failed ($LASTEXITCODE)." }

  $task = if ($Variant -eq 'release') { 'assembleRelease' } else { 'assembleDebug' }
  New-Item -ItemType Directory -Force dist | Out-Null
  if (-not $LogFile) { $LogFile = Join-Path $root "dist\gradle-$Variant.log" }
  Push-Location android
  try {
    # Full output goes to the log file (a failing native step prints its cause far above the summary).
    cmd /c ".\gradlew.bat $task -PreactNativeArchitectures=$Abi --no-daemon > `"$LogFile`" 2>&1"
    $code = $LASTEXITCODE
    Get-Content $LogFile -Tail 5
    if ($code -ne 0) {
      Select-String $LogFile -Pattern 'What went wrong' -Context 0, 12 | Select-Object -First 1 |
        ForEach-Object { $_.Line; $_.Context.PostContext }
      throw "Gradle $task failed ($code); full log: $LogFile"
    }
  } finally { Pop-Location }

  $version = (Get-Content VERSION -Raw).Trim()
  $apk = "android\app\build\outputs\apk\$Variant\app-$Variant.apk"
  $out = "dist\sendero-$version-$Variant-$($Abi -replace ',', '+').apk"
  Copy-Item $apk $out -Force
  Write-Host "APK: $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB)" -ForegroundColor Green
} finally { Pop-Location }
