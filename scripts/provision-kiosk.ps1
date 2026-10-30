<#
.SYNOPSIS
  Make Sendero the device owner of the connected tablet (kiosk mode, docs/guides/provision-kiosk.md).

.PARAMETER Release
  Print how to release the device owner (done in the app) instead of provisioning.

.PARAMETER Serial
  adb serial of the target device when more than one is connected (see `adb devices`).
#>
param(
  [switch]$Release,
  [string]$Serial
)
$ErrorActionPreference = 'Stop'
$component = 'com.faslwork.sendero/expo.modules.senderokiosk.SenderoAdminReceiver'
$package = 'com.faslwork.sendero'

if ($Release) {
  Write-Host @'
Releasing the kiosk device owner is done inside the app, not with adb:
  1. Open Sendero, tap five times in the upper-left corner within 3 seconds, enter the staff PIN.
  2. In the staff panel choose "Exit kiosk", then "Release device owner".
`adb shell dpm remove-active-admin` does not work for the device owner of a release app.
If the app cannot be opened, a factory reset frees the tablet.
'@
  return
}

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "adb not found at $adb." }
$target = @(); if ($Serial) { $target = @('-s', $Serial) }

$devices = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' })
if (-not $Serial -and $devices.Count -ne 1) {
  throw "Expected exactly one connected device, found $($devices.Count). Connect the tablet or pass -Serial."
}

$accounts = @(& $adb @target shell dumpsys account | Where-Object { $_ -match '^\s+Account \{' })
Write-Host "Accounts on the device: $($accounts.Count)"
if ($accounts.Count -gt 0) {
  $accounts | ForEach-Object { Write-Host $_ }
  throw @'
The device still has accounts, so Android refuses a device owner. Remove every account in
Settings > Accounts (Google, Samsung, Outlook), or factory reset and skip account sign-in in the
setup wizard, then run this script again.
'@
}

$installed = & $adb @target shell pm path $package
if (-not ($installed -match '^package:')) { throw "$package is not installed. Run scripts\install-apk.ps1 first." }

& $adb @target shell dpm set-device-owner $component
if ($LASTEXITCODE -ne 0) { throw "dpm set-device-owner failed ($LASTEXITCODE)." }
Write-Host 'Device owners:'
& $adb @target shell dpm list-owners
Write-Host 'Done. Open Sendero and enter kiosk from the staff panel.' -ForegroundColor Green
