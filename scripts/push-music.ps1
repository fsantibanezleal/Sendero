<#
.SYNOPSIS
  Copy your own music files to the tablet by cable, into Sendero's external music folder.

.DESCRIPTION
  The app reads Android/data/com.faslwork.sendero/files/music without any permission. Only audio files
  (mp3, m4a, aac, ogg, oga, opus, wav, flac) are copied; the app must have been opened once so the
  folder exists. Your files never enter the repository.

.PARAMETER Folder
  The folder on this computer with the music files.

.PARAMETER Serial
  adb serial of the tablet when more than one device is connected.
#>
param(
  [Parameter(Mandatory = $true)][string]$Folder,
  [string]$Serial
)
$ErrorActionPreference = 'Continue'
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "adb not found at $adb." }
if (-not (Test-Path $Folder)) { throw "Folder not found: $Folder" }
$target = @(); if ($Serial) { $target = @('-s', $Serial) }
$remote = '/sdcard/Android/data/com.faslwork.sendero/files/music'
& $adb @target shell mkdir -p $remote | Out-Null
$extensions = '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac'
$files = Get-ChildItem -Path $Folder -File | Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() }
if ($files.Count -eq 0) { throw "No audio files in $Folder." }
$copied = 0
foreach ($f in $files) {
  & $adb @target push $f.FullName "$remote/$($f.Name)" | Out-Null
  if ($LASTEXITCODE -eq 0) { $copied++ } else { Write-Warning "Could not copy $($f.Name)" }
}
Write-Host "Copied $copied of $($files.Count) files to $remote. Open the staff panel to see them, or restart the app." -ForegroundColor Green
