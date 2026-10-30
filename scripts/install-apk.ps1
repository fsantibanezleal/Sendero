<#
.SYNOPSIS
  Install a Sendero APK on the connected tablet or emulator with adb, and start the app.

.PARAMETER Apk
  Path to the APK (default: the newest APK under dist).

.PARAMETER Serial
  adb serial of the target device when more than one is connected (see `adb devices`).

.PARAMETER Replace
  Uninstall the installed copy first. Needed when the installed copy was signed with another key
  (for example a debug-signed test build). This also erases the app's data (staff PIN, imported
  music). A device-owner copy cannot be uninstalled: release it first from the staff panel
  ("Liberar el dispositivo").
#>
param(
  [string]$Apk,
  [string]$Serial,
  [switch]$Replace
)
# Native tools write to stderr; exit codes are checked instead (Windows PowerShell 5.1).
$ErrorActionPreference = 'Continue'
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

if ($Replace) {
  & $adb @target uninstall com.faslwork.sendero | Out-Null
}
$output = (& $adb @target install -r -g $Apk 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0) {
  if ($output -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') {
    throw 'The installed Sendero was signed with another key. Run again with -Replace (it erases the PIN and imported music; a device owner must be released first from the staff panel).'
  }
  throw "adb install failed ($LASTEXITCODE): $output"
}
& $adb @target shell monkey -p com.faslwork.sendero -c android.intent.category.LAUNCHER 1 2>&1 | Out-Null
Write-Host "Installed and started: $Apk" -ForegroundColor Green
