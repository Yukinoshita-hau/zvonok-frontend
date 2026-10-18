$ErrorActionPreference='Stop'
Set-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
foreach($step in @(@('test'),@('run','build'),@('run','build:electron'))){
 & npm.cmd @step
 if($LASTEXITCODE){throw "Frontend regression failed: $step"}
}
