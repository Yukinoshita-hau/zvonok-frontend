param([ValidateSet('Auth','Storage','Chat','Media')][string]$Suite)
$ErrorActionPreference='Stop'
Set-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
$label=docker inspect --format '{{index .Config.Labels "zvonok.acceptance"}}' zvonok-stage10-pg
if($LASTEXITCODE -or $label -ne 'stage10'){throw 'Expected isolated acceptance PostgreSQL container'}
$entries=switch($Suite){'Auth'{@('auth')};'Storage'{@('s3','s3-delete','storage-audit')};'Chat'{@('chat','unread','history','history-ui')};'Media'{@('media')}}
$failed=$false
foreach($entry in $entries){& node "scripts/stage10-1/$entry.cjs";if($LASTEXITCODE){$failed=$true}}
if($failed){throw 'Acceptance contains FAIL; inspect per-scenario evidence. Do not relabel fault failures PASS.'}
