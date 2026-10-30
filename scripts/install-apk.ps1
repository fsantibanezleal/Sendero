<#
.SYNOPSIS
  Install a Sendero APK on the connected tablet or emulator with adb, and start the app.

.PARAMETER Apk
  Path to the APK (default: the newest APK under dist).

.PARAMETER Serial
  adb serial of the target device when more than one is connected (see `adb devices`).
#>
param(
  [string]$Apk,
  [string]$Serial
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "adb not found at $adb." }
if (-not $Apk) {
  $Apk = Get-ChildItem (Join-Path $root 'dist') -Filter '*.apk' | Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Apk -or -not (Test-Path $Apk)) { throw 'No APK found; run scripts\build-apk.ps1 first.' }
$target = @(); if ($Serial) { $target = @('-s', $Serial) }

& $adb @target install -r -g $Apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed ($LASTEXITCODE)." }
& $adb @target shell monkey -p com.faslwork.sendero -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host "Installed and started: $Apk" -ForegroundColor Green
