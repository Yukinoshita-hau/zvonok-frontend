$ErrorActionPreference='Stop'
$directory=Join-Path ([IO.Path]::GetTempPath()) ('stage5e-corrupt-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $directory | Out-Null
$envFile=Join-Path $directory 'test.env'
[IO.File]::WriteAllText($envFile,'COMPOSE_PROJECT_NAME=zvonok-stage5e-negative')
foreach($name in @('postgres.dump','objects.tar','references.json')){[IO.File]::WriteAllText((Join-Path $directory $name),'test fixture')}
$hashes=@{};foreach($name in @('postgres.dump','objects.tar','references.json')){$hashes[$name]=(Get-FileHash (Join-Path $directory $name) -Algorithm SHA256).Hash}
@{format='zvonok-stage5e-paired-v1';sha256=$hashes} | ConvertTo-Json | Set-Content (Join-Path $directory 'manifest.json')
[IO.File]::WriteAllText((Join-Path $directory 'postgres.dump'),'corrupted fixture')
$output=& pwsh -NoProfile -File "$PSScriptRoot/snapshot.ps1" -Action restore -EnvFile $envFile -Destination $directory 2>&1
if($LASTEXITCODE -eq 0 -or ($output -join "`n") -notmatch 'Checksum mismatch: postgres.dump'){throw 'Corrupt archive was not rejected before Docker operations'}
$output=& pwsh -NoProfile -File "$PSScriptRoot/../../zvonok-backend/storage/restore-local-test.ps1" -DeploymentEnvFile $envFile -BackupDirectory $directory 2>&1
if($LASTEXITCODE -eq 0 -or ($output -join "`n") -notmatch 'Checksum mismatch: postgres.dump'){throw 'Stage 5D entrypoint did not retain fail-before-mutation behavior'}
Write-Output 'PASS corrupt archive rejected before any Docker operation; tiny test fixtures retained in temp'
