$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force stage10-evidence | Out-Null
& npm.cmd test *> stage10-evidence/frontend-tests-final.log
if ($LASTEXITCODE) { throw 'Frontend tests failed' }
& npm.cmd run build *> stage10-evidence/frontend-build-final.log
if ($LASTEXITCODE) { throw 'TypeScript/Web build failed' }
& npm.cmd run build:electron *> stage10-evidence/electron-build-final.log
if ($LASTEXITCODE) { throw 'Electron compilation failed' }
# Run stage10-acceptance.cjs separately with the isolated stack and Vite running.
