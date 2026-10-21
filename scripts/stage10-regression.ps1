$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force artifacts/stages/stage10-evidence | Out-Null
& npm.cmd test *> artifacts/stages/stage10-evidence/frontend-tests-final.log
if ($LASTEXITCODE) { throw 'Frontend tests failed' }
& npm.cmd run build *> artifacts/stages/stage10-evidence/frontend-build-final.log
if ($LASTEXITCODE) { throw 'TypeScript/Web build failed' }
& npm.cmd run build:electron *> artifacts/stages/stage10-evidence/electron-build-final.log
if ($LASTEXITCODE) { throw 'Electron compilation failed' }
# Run stage10-acceptance.cjs separately with the isolated stack and Vite running.
