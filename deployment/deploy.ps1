param(
  [ValidateSet('dev','prod')][string]$Mode='dev',
  [ValidateSet('init','validate','build','up','health','restart','stop')][string]$Action='validate',
  [Parameter(Mandatory=$true)][string]$EnvFile
)
$ErrorActionPreference='Stop'
$EnvFile=[IO.Path]::GetFullPath($EnvFile)
$ancestor=Split-Path $EnvFile -Parent
while($ancestor){
  if(Test-Path -LiteralPath (Join-Path $ancestor '.git')){throw 'Secrets must live outside every Git checkout'}
  $parent=Split-Path $ancestor -Parent
  if($parent -eq $ancestor){break}
  $ancestor=$parent
}
if($Action -eq 'init'){
  if($Mode -ne 'dev'){throw 'Production must be configured explicitly from .env.example'}
  if(Test-Path -LiteralPath $EnvFile){throw 'Refusing to overwrite existing credentials'}
  $directory=Split-Path $EnvFile -Parent
  New-Item -ItemType Directory -Force $directory | Out-Null
  function New-Secret { $bytes=New-Object byte[] 48;[Security.Cryptography.RandomNumberGenerator]::Fill($bytes);[Convert]::ToHexString($bytes).ToLowerInvariant() }
  $content=Get-Content "$PSScriptRoot/.env.example" -Raw
  foreach($key in @('POSTGRES_PASSWORD','JWT_SECRET','RUSTFS_ACCESS_KEY','RUSTFS_SECRET_KEY','S3_ACCESS_KEY','S3_SECRET_ACCESS_KEY','LIVEKIT_API_KEY','LIVEKIT_API_SECRET')){
    $value=New-Secret
    if($key -in @('RUSTFS_ACCESS_KEY','S3_ACCESS_KEY','LIVEKIT_API_KEY')){$value=$value.Substring(0,20).ToUpperInvariant()}
    $content=$content -replace "(?m)^$key=.*$",("$key="+$value)
  }
  $caddy=(Join-Path $PSScriptRoot 'Caddyfile').Replace('\','/')
  $livekit=(Join-Path $directory 'livekit.yaml').Replace('\','/')
  $content=$content -replace '(?m)^CADDY_CONFIG_FILE=.*$',"CADDY_CONFIG_FILE=$caddy"
  $content=$content -replace '(?m)^LIVEKIT_CONFIG_FILE=.*$',"LIVEKIT_CONFIG_FILE=$livekit"
  [IO.File]::WriteAllText($EnvFile,$content)
  if($IsWindows){icacls $EnvFile /inheritance:r /grant:r "$([Security.Principal.WindowsIdentity]::GetCurrent().Name):(R,W)" | Out-Null;if($LASTEXITCODE){throw 'Cannot protect secret file'}}
  else { & chmod 600 $EnvFile; if($LASTEXITCODE){throw 'Cannot protect secret file'} }
}
$values=@{}
foreach($line in Get-Content -LiteralPath $EnvFile){if($line -match '^([A-Z][A-Z0-9_]*)=(.*)$'){$values[$matches[1]]=$matches[2]}}
foreach($key in @('COMPOSE_PROJECT_NAME','DEPLOY_TAG','POSTGRES_PASSWORD','JWT_SECRET','RUSTFS_ACCESS_KEY','RUSTFS_SECRET_KEY','S3_ACCESS_KEY','S3_SECRET_ACCESS_KEY','LIVEKIT_API_KEY','LIVEKIT_API_SECRET')){
  if(!$values[$key]){throw "Missing $key"}
}
if($values.COMPOSE_PROJECT_NAME -notmatch '^zvonok-[a-z0-9-]+$'){throw 'Use an explicit zvonok-* isolated project name'}
if($values.S3_ACCESS_KEY -eq $values.RUSTFS_ACCESS_KEY){throw 'Backend must not use root credentials'}
foreach($key in @('POSTGRES_PASSWORD','JWT_SECRET','RUSTFS_SECRET_KEY','S3_SECRET_ACCESS_KEY','LIVEKIT_API_SECRET')){if($values[$key].Length -lt 32){throw "Weak $key"}}
try{if([Convert]::FromBase64String($values.JWT_SECRET).Length -lt 64){throw 'short'}}catch{throw 'JWT_SECRET must be Base64 encoding of at least 64 bytes for the existing HS512 provider'}
foreach($key in @('APP_URL','S3_PUBLIC_URL','LIVEKIT_HTTP_URL','WS_PUBLIC_URL','LIVEKIT_PUBLIC_URL')){
  $uri=[uri]$values[$key]
  if(!$uri.IsAbsoluteUri -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/'){throw "Invalid public origin: $key"}
  if($Mode -eq 'prod'){
    $scheme=if($key -in @('WS_PUBLIC_URL','LIVEKIT_PUBLIC_URL')){'wss'}else{'https'}
    if($uri.Scheme -ne $scheme -or $uri.IsLoopback -or !$uri.Host.Contains('.') -or $uri.Host.EndsWith('.invalid')){throw "Production requires real public $scheme origin: $key"}
  }elseif(!$uri.IsLoopback){throw 'Development permits only explicit loopback origins'}
}
if($Mode -eq 'prod'){
  if($values.ALLOW_LOOPBACK_HTTP -ne 'false' -or $values.COOKIE_SECURE -ne 'true'){throw 'Production requires TLS and secure cookies'}
  if(!$values.BACKUP_DESTINATION){throw 'Configure independent BACKUP_DESTINATION before production use'}
  if($values.BACKUP_INDEPENDENCE_CONFIRMED -ne 'true'){throw 'Independence of production backup destination must be confirmed'}
  if($values.LIVEKIT_NODE_IP -in @('','127.0.0.1','localhost','0.0.0.0')){throw 'Set real advertised ICE address'}
}
if($Action -eq 'init'){
  $config=@{port=7880;rtc=@{tcp_port=[int]$values.ICE_TCP_PORT;port_range_start=[int]$values.ICE_UDP_START;port_range_end=[int]$values.ICE_UDP_END;use_external_ip=$false};redis=@{address='redis:6379'}}
  # JSON is YAML; credentials are supplied through LIVEKIT_KEYS, never written here.
  $config | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $values.LIVEKIT_CONFIG_FILE
  Write-Output 'Initialized isolated development config; secrets were not printed.'
  exit
}
foreach($key in @('CADDY_CONFIG_FILE','LIVEKIT_CONFIG_FILE')){if(!(Test-Path -LiteralPath $values[$key])){throw "Missing $key file"}}
$argsList=@('compose','--env-file',$EnvFile,'-f',"$PSScriptRoot/compose.yaml",'-f',"$PSScriptRoot/$Mode.yaml")
if($Action -in @('up','restart','stop')){
  $containers=docker ps -aq --filter "label=com.docker.compose.project=$($values.COMPOSE_PROJECT_NAME)"
  if($LASTEXITCODE){throw 'Cannot inspect project ownership'}
  foreach($id in $containers){
    $owner=docker inspect $id --format '{{index .Config.Labels "io.zvonok.deployment"}}'
    if($LASTEXITCODE -or $owner -ne 'stage5e'){throw 'Refusing to change containers from another deployment'}
  }
  foreach($name in @('postgres','redis','objects','caddy_data','caddy_config')){
    $volume="$($values.COMPOSE_PROJECT_NAME)_$name"
    $existing=docker volume ls -q --filter "name=^${volume}$"
    if($LASTEXITCODE){throw 'Cannot inspect volume ownership'}
    if($existing){
      $owner=docker volume inspect $volume --format '{{index .Labels "io.zvonok.deployment"}}'
      if($LASTEXITCODE -or $owner -ne 'stage5e'){throw 'Refusing to reuse volumes from another deployment'}
    }
  }
}
switch($Action){
  validate {docker @argsList config --quiet}
  build {docker @argsList build}
  up {docker @argsList up -d --wait --wait-timeout 360}
  restart {docker @argsList restart rustfs backend frontend}
  stop {docker @argsList stop}
  health {
    docker @argsList ps
    $result=Invoke-RestMethod "$($values.APP_URL)/api/health"
    if($result.status -ne 'UP'){throw 'Application health failed'}
    $disk=Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Root -eq [IO.Path]::GetPathRoot($EnvFile)} | Select-Object -First 1
    if($disk.Free -lt ([double]$values.DISK_WARNING_FREE_GIB * 1GB)){Write-Warning 'Local disk below configured warning threshold; this does not describe the future server'}
  }
}
if($LASTEXITCODE){throw "Compose $Action failed"}
