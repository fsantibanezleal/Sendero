<#
.SYNOPSIS
  Screenshot one full visit on a connected device or emulator, at chosen moments of the timeline.

.DESCRIPTION
  Starts Sendero, captures the idle screen, taps the centre of the screen and captures the screen at
  each requested time (seconds after the tap, see src/experience/timeline.ts). Writes PNG files to
  -OutDir, which must be outside the repository (screenshots may show a person).

.PARAMETER OutDir
  Folder for the screenshots (created if missing).

.PARAMETER Times
  Seconds after the tap (default: shrink, path, gather, walk, arrival, reveal, message, return).

.PARAMETER Serial
  adb serial when more than one device is connected.
#>
param(
  [Parameter(Mandatory = $true)][string]$OutDir,
  [double[]]$Times = @(1.0, 3.0, 4.0, 7.5, 10.5, 12.0, 14.0, 18.0, 25.9),
  [string]$Serial,
  [double]$IdleWait = 8
)
$ErrorActionPreference = 'Continue'
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$root = Split-Path -Parent $PSScriptRoot
$full = [IO.Path]::GetFullPath($OutDir)
if ($full.StartsWith([IO.Path]::GetFullPath($root), [StringComparison]::OrdinalIgnoreCase)) { throw 'OutDir must be outside the repository.' }
New-Item -ItemType Directory -Force $full | Out-Null
$target = ''; if ($Serial) { $target = "-s $Serial" }

function Shot([string]$name) {
  $file = Join-Path $full "$name.png"
  cmd /c "`"$adb`" $target exec-out screencap -p > `"$file`""
  return $file
}

& $adb $(if ($Serial) { '-s', $Serial }) shell monkey -p com.faslwork.sendero -c android.intent.category.LAUNCHER 1 2>&1 | Out-Null
Start-Sleep -Seconds $IdleWait
Shot 'idle' | Out-Null
$size = (& $adb $(if ($Serial) { '-s', $Serial }) shell wm size) -replace '.*:\s*', ''
$w, $h = ($size.Trim() -split 'x') | ForEach-Object { [int]$_ }
$cx = [int]([Math]::Max($w, $h) / 2); $cy = [int]([Math]::Min($w, $h) / 2)
$clock = [Diagnostics.Stopwatch]::StartNew()
& $adb $(if ($Serial) { '-s', $Serial }) shell input tap $cx $cy
foreach ($t in ($Times | Sort-Object)) {
  $wait = $t - $clock.Elapsed.TotalSeconds
  if ($wait -gt 0) { Start-Sleep -Milliseconds ([int]($wait * 1000)) }
  $name = 't{0:00.0}' -f $t
  Shot $name | Out-Null
  Write-Host ("captured {0} at {1:0.00} s" -f $name, $clock.Elapsed.TotalSeconds)
}
Write-Host "Screenshots in $full" -ForegroundColor Green
