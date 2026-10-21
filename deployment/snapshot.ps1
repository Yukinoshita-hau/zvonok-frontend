param(
 [Parameter(Mandatory=$true)][ValidateSet('backup','verify','restore')][string]$Action,
 [Parameter(Mandatory=$true)][string]$EnvFile,
 [Parameter(Mandatory=$true)][string]$Destination,
 [ValidateSet('dev','prod')][string]$Mode='dev'
)
$ErrorActionPreference='Stop'
# Stage 5D procedure: quiesce writes, paired pg_dump + object snapshot, SHA256 before restore.
$Destination=[IO.Path]::GetFullPath($Destination)
$values=@{};foreach($line in Get-Content -LiteralPath $EnvFile){if($line -match '^([A-Z][A-Z0-9_]*)=(.*)$'){$values[$matches[1]]=$matches[2]}}
$project=$values.COMPOSE_PROJECT_NAME
if($project -notmatch '^zvonok-[a-z0-9-]+$'){throw 'Explicit isolated zvonok-* project required'}
$compose=@('compose','--env-file',$EnvFile,'-f',"$PSScriptRoot/compose.yaml",'-f',"$PSScriptRoot/$Mode.yaml")
function Run-Docker { & docker @args; if($LASTEXITCODE){throw 'Docker backup/restore operation failed'} }
function Verify-Archive {
 $manifest=Get-Content -LiteralPath (Join-Path $Destination 'manifest.json') -Raw | ConvertFrom-Json
 if($manifest.format -ne 'zvonok-stage5e-paired-v1'){throw 'Unsupported snapshot format'}
 foreach($name in @('postgres.dump','objects.tar','references.json')){
  $expected=$manifest.sha256.$name
  if(!$expected -or (Get-FileHash -LiteralPath (Join-Path $Destination $name) -Algorithm SHA256).Hash -ne $expected){throw "Checksum mismatch: $name"}
 }
 # Check archive members before creating any target resources; extraction never follows absolute/traversal paths.
 $entries=Run-Docker run --rm --mount "type=bind,source=$Destination,target=/backup,readonly" node:22.14.0-alpine tar -tf /backup/objects.tar
 foreach($entry in $entries){if($entry -match '^/' -or $entry -match '(^|/)\.\.(/|$)'){throw 'Unsafe archive path'}}
 return $manifest
}
if($Action -eq 'verify'){ $null=Verify-Archive;Write-Output 'PASS snapshot checksums and archive paths';exit }
if($Action -eq 'backup'){
 if(Test-Path -LiteralPath $Destination){throw 'Choose a new snapshot destination; overwrite prohibited'}
 New-Item -ItemType Directory -Path $Destination | Out-Null
 if($IsWindows){icacls $Destination /inheritance:r /grant:r "$([Security.Principal.WindowsIdentity]::GetCurrent().Name):(OI)(CI)F" | Out-Null;if($LASTEXITCODE){throw 'Cannot protect snapshot'}}
 else{ & chmod 700 $Destination;if($LASTEXITCODE){throw 'Cannot protect snapshot'} }
 $db=(& docker @compose ps -q postgres).Trim()
 $storage=(& docker @compose ps -q rustfs).Trim()
 foreach($id in @($db,$storage)){
  if(!$id){throw 'Source services must be running'}
  $owner=(& docker inspect $id --format '{{index .Config.Labels "com.docker.compose.project"}}').Trim()
  if($owner -ne $project){throw 'Container ownership mismatch'}
  $generation=(& docker inspect $id --format '{{index .Config.Labels "io.zvonok.deployment"}}').Trim()
  if($generation -ne 'stage5e'){throw 'Refusing to stop containers outside Stage 5E'}
 }
 $volume=(& docker inspect $storage --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}').Trim()
 if($volume -ne ($project+'_objects')){throw 'Unexpected storage volume'}
 Run-Docker @compose stop backend rustfs
 try{
  Run-Docker exec $db pg_dump -U zvonok -d zvonok -Fc -f /tmp/stage5e-backup.dump
  Run-Docker cp "${db}:/tmp/stage5e-backup.dump" (Join-Path $Destination 'postgres.dump')
  $refs=Run-Docker exec $db psql -U zvonok -d zvonok -Atc "SELECT coalesce(json_agg(x),'[]') FROM (SELECT storage_key,size_bytes FROM message_attachment ORDER BY id) x"
  [IO.File]::WriteAllText((Join-Path $Destination 'references.json'),($refs -join "`n"))
  Run-Docker run --rm --mount "type=volume,source=$volume,target=/source,readonly" --mount "type=bind,source=$Destination,target=/backup" node:22.14.0-alpine tar -C /source -cf /backup/objects.tar .
  $hashes=@{};foreach($name in @('postgres.dump','objects.tar','references.json')){$hashes[$name]=(Get-FileHash (Join-Path $Destination $name) -Algorithm SHA256).Hash}
  @{format='zvonok-stage5e-paired-v1';sourceProject=$project;createdUtc=[DateTime]::UtcNow.ToString('o');sha256=$hashes;rustfs='1.0.3';postgres='16';storage='Quiesced full RustFS volume including IAM; restore only to same pinned RustFS';backupIndependence='Operator must verify independent/off-host destination';deployTag=$values.DEPLOY_TAG} | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $Destination 'manifest.json')
 }finally{
  Run-Docker exec $db rm -f /tmp/stage5e-backup.dump
  Run-Docker @compose start rustfs backend
 }
 $null=Verify-Archive
 Write-Output 'PASS paired backup and checksum verification'
 exit
}
$manifest=Verify-Archive
if($project -eq $manifest.sourceProject){throw 'Restore requires a DIFFERENT empty project'}
$existing=(& docker ps -aq --filter "label=com.docker.compose.project=$project")
$volumes=(& docker volume ls -q --filter "label=com.docker.compose.project=$project")
if($existing -or $volumes){throw 'Restore target must have no containers or volumes; nothing was modified'}
# Same credentials are required: IAM state and application signatures are part of the snapshot.
Run-Docker @compose create postgres rustfs
$storage=(& docker @compose ps -aq rustfs).Trim()
$volume=(& docker inspect $storage --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}').Trim()
if($volume -ne ($project+'_objects')){throw 'Unexpected restore target volume'}
Run-Docker run --rm --mount "type=volume,source=$volume,target=/restore" --mount "type=bind,source=$Destination,target=/backup,readonly" node:22.14.0-alpine tar -C /restore -xf /backup/objects.tar
Run-Docker @compose up -d --wait postgres
$db=(& docker @compose ps -q postgres).Trim()
Run-Docker cp (Join-Path $Destination 'postgres.dump') "${db}:/tmp/stage5e-restore.dump"
try{Run-Docker exec $db pg_restore -U zvonok --no-owner --no-privileges --exit-on-error -d zvonok /tmp/stage5e-restore.dump}
finally{Run-Docker exec $db rm -f /tmp/stage5e-restore.dump}
$refs=Run-Docker exec $db psql -U zvonok -d zvonok -Atc "SELECT coalesce(json_agg(x),'[]') FROM (SELECT storage_key,size_bytes FROM message_attachment ORDER BY id) x"
if(($refs -join "`n") -ne [IO.File]::ReadAllText((Join-Path $Destination 'references.json'))){throw 'Restored references differ'}
Write-Output 'PASS isolated restore and reference comparison; run deployment up and original-file verification next'
