# Sendero setup (Windows): checks the toolchain and installs the JavaScript dependencies.
# Node 22 or newer is required; JDK 17 and the Android SDK are needed only to build the APK.
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'node not found on PATH: install or switch to Node 22.' }
$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw "Node $(node --version) found; Sendero needs Node 22 or newer." }

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "Setup complete. 'npm run check' runs the local gate; scripts\build-apk.ps1 builds the APK." -ForegroundColor Green
} finally { Pop-Location }
