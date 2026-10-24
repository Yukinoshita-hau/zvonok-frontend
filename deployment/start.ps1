#requires -Version 7.0
param([ValidateSet('start','stop','status')][string]$Action='start')
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$browserRoot=(Resolve-Path (Join-Path $root '..\zvonok-browser')).Path
$state=Join-Path $env:LOCALAPPDATA 'Zvonok\local-browser-activity'
$envFile=Join-Path $state 'compose.env'
$livekitFile=Join-Path $state 'browser-livekit.yaml'
$voiceFile=Join-Path $state 'voice-livekit.yaml'
$guardFile=Join-Path $PSScriptRoot 'browser-guard-local.sh'
$composeFile=Join-Path $PSScriptRoot 'compose.local-browser-activity.yaml'

function Invoke-LocalCompose([string[]]$Arguments) {
  # Persisted configuration wins over leftover flags/secrets from other shell sessions.
  $keys=@('COMPOSE_PROFILES','COMPOSE_FILE','COMPOSE_ENV_FILES','COMPOSE_REMOVE_ORPHANS')
  $keys+=Get-Content -LiteralPath $envFile | ForEach-Object {if($_ -match '^([A-Z][A-Z0-9_]*)='){$matches[1]}}
  $previous=@{}
  foreach($key in ($keys | Select-Object -Unique)){
    $previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')
    Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue
  }
  try {
    & docker --context desktop-linux compose @Arguments
    if($LASTEXITCODE){throw "Local Compose $Action failed (exit $LASTEXITCODE)"}
  } finally {
    foreach($key in $previous.Keys){
      if($null -eq $previous[$key]){Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue}
      else{Set-Item -LiteralPath "Env:$key" -Value $previous[$key]}
    }
  }
}
function Invoke-CoreCompose([string[]]$Arguments) {
  Invoke-LocalCompose -Arguments (@('-p','zvonok-local-browser','--env-file',$envFile,'-f',(Join-Path $PSScriptRoot 'compose.yaml'),'-f',(Join-Path $PSScriptRoot 'dev.yaml'),'-f',$composeFile)+$Arguments)
}
function Invoke-BrowserCompose([string[]]$Arguments) {
  Invoke-LocalCompose -Arguments (@('-p','zvonok-local-browser-session','--project-directory',$browserRoot,'--env-file',$envFile,'-f',(Join-Path $browserRoot 'compose.session.yaml'),'-f',(Join-Path $PSScriptRoot 'compose.browser-session.local.yaml'))+$Arguments)
}
function Ensure-CoreNetwork {
  $networks=@(& docker --context desktop-linux network ls --filter 'name=^zvonok-local-browser-core$' --format '{{.Name}}')
  if($LASTEXITCODE){throw 'Docker engine is unavailable.'}
  if($networks -notcontains 'zvonok-local-browser-core'){
    & docker --context desktop-linux network create --internal --label io.zvonok.local=browser-activity zvonok-local-browser-core | Out-Null
    if($LASTEXITCODE){throw 'Could not create the isolated Core-to-Browser network.'}
  } else {
    $owner=& docker --context desktop-linux network inspect zvonok-local-browser-core --format '{{index .Labels "io.zvonok.local"}} {{.Internal}}'
    if($LASTEXITCODE -or $owner -ne 'browser-activity true'){throw 'Refusing to use an existing network with unexpected ownership or isolation.'}
  }
}
function Ensure-BrowserNetwork {
  $networks=@(& docker --context desktop-linux network ls --filter 'name=^zvonok-local-browser-session_browser$' --format '{{.Name}}')
  if($LASTEXITCODE){throw 'Docker engine is unavailable.'}
  if($networks -notcontains 'zvonok-local-browser-session_browser'){
    & docker --context desktop-linux network create --internal --subnet 172.30.88.0/24 --label io.zvonok.local=browser-activity zvonok-local-browser-session_browser | Out-Null
    if($LASTEXITCODE){throw 'Could not create the isolated Browser Worker/Proxy network; the selected subnet may be occupied.'}
  } else {
    $owner=& docker --context desktop-linux network inspect zvonok-local-browser-session_browser --format '{{index .Labels "io.zvonok.local"}} {{.Internal}} {{range .IPAM.Config}}{{.Subnet}}{{end}}'
    if($LASTEXITCODE -or $owner -ne 'browser-activity true 172.30.88.0/24'){throw 'Refusing to use a Browser network with unexpected ownership, isolation or subnet.'}
  }
}
function Remove-BrowserNetwork {
  $networks=@(& docker --context desktop-linux network ls --filter 'name=^zvonok-local-browser-session_browser$' --format '{{.Name}}')
  if($LASTEXITCODE){throw 'Could not inspect the local Browser Worker/Proxy network.'}
  if($networks -contains 'zvonok-local-browser-session_browser'){
    $owner=& docker --context desktop-linux network inspect zvonok-local-browser-session_browser --format '{{index .Labels "io.zvonok.local"}}'
    if($LASTEXITCODE -or $owner -ne 'browser-activity'){throw 'Refusing to remove a Browser network not owned by this local stack.'}
    & docker --context desktop-linux network rm zvonok-local-browser-session_browser | Out-Null
    if($LASTEXITCODE){throw 'Browser network is still in use; containers and volumes are preserved.'}
  }
}
function Remove-CoreNetwork {
  $networks=@(& docker --context desktop-linux network ls --filter 'name=^zvonok-local-browser-core$' --format '{{.Name}}')
  if($LASTEXITCODE){throw 'Could not inspect the local Browser network.'}
  if($networks -contains 'zvonok-local-browser-core'){
    $owner=& docker --context desktop-linux network inspect zvonok-local-browser-core --format '{{index .Labels "io.zvonok.local"}}'
    if($LASTEXITCODE -or $owner -ne 'browser-activity'){throw 'Refusing to remove a network not owned by this local stack.'}
    & docker --context desktop-linux network rm zvonok-local-browser-core | Out-Null
    if($LASTEXITCODE){throw 'Local network is still in use; containers and volumes are preserved.'}
  }
}
function New-HexSecret([int]$Bytes=48) {
  $buffer=[byte[]]::new($Bytes)
  [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  [Convert]::ToHexString($buffer).ToLowerInvariant()
}
function Assert-ProjectOwnership {
  foreach($project in @('zvonok-local-browser','zvonok-local-browser-session')){
    $expected=if($project -eq 'zvonok-local-browser'){$composeFile}else{Join-Path $PSScriptRoot 'compose.browser-session.local.yaml'}
    $containers=@(& docker --context desktop-linux ps -aq --filter "label=com.docker.compose.project=$project")
    if($LASTEXITCODE){throw 'Docker engine is unavailable.'}
    foreach($container in $containers){
      $files=& docker --context desktop-linux inspect $container --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
      if($LASTEXITCODE -or !$files.Replace('\','/').ToLowerInvariant().Contains($expected.Replace('\','/').ToLowerInvariant())){throw "Project $project belongs to a different configuration; no containers were changed."}
    }
  }
}

if($Action -ne 'stop' -and !(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Docker CLI is required.'}
if($Action -eq 'stop' -and !(Test-Path -LiteralPath $envFile)){Write-Output 'Local stack has not been initialized.';exit 0}
if($Action -eq 'status'){
  if(!(Test-Path -LiteralPath $envFile)){Write-Output 'Локальный стек ещё не запускался.';exit 0}
  Invoke-BrowserCompose @('ps')
  Invoke-CoreCompose @('ps')
  exit 0
}
Assert-ProjectOwnership
if($Action -ne 'stop'){
  New-Item -ItemType Directory -Force -Path $state | Out-Null
  if(!(Test-Path -LiteralPath $envFile)){
    $existing=@(& docker --context desktop-linux volume ls -q --filter 'name=^zvonok-local-browser_postgres$')
    if($LASTEXITCODE){throw 'Cannot inspect local data volumes.'}
    if($existing.Count){throw 'Local database already exists. Restore the original secrets folder before starting; credentials will not be regenerated.'}
    $lines=@(
      'COMPOSE_PROJECT_NAME=zvonok-local-browser',
      'DEPLOY_TAG=local-browser-activity',
      'BACKEND_TAG=local-browser-activity',
      'FRONTEND_TAG=local-browser-activity',
      "POSTGRES_PASSWORD=$(New-HexSecret)",
      "JWT_SECRET=$([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64)))",
      "RUSTFS_ACCESS_KEY=$(New-HexSecret 20)",
      "RUSTFS_SECRET_KEY=$(New-HexSecret)",
      "S3_ACCESS_KEY=$(New-HexSecret 20)",
      "S3_SECRET_ACCESS_KEY=$(New-HexSecret)",
      "LIVEKIT_API_KEY=$(New-HexSecret 20)",
      "LIVEKIT_API_SECRET=$(New-HexSecret)",
      "BROWSER_INTEGRATION_KEY=$(New-HexSecret 32)",
      "DEV_TOKEN=$(New-HexSecret)",
      "BROWSER_LIVEKIT_CONFIG=$($livekitFile.Replace('\','/'))",
      "BROWSER_GUARD_SCRIPT=$($guardFile.Replace('\','/'))",
      'APP_URL=http://localhost:13000',
      'APP_PORT=13000',
      'API_URL=http://localhost:13000/api',
      'S3_PORT=19020',
      'S3_PUBLIC_URL=http://localhost:19020',
      'LIVEKIT_HTTP_PORT=17880',
      'LIVEKIT_HTTP_URL=http://localhost:17880',
      'WS_PUBLIC_URL=ws://localhost:13000',
      'LIVEKIT_PUBLIC_URL=ws://localhost:17880',
      'LIVEKIT_NODE_IP=127.0.0.1',
      'ICE_BIND_IP=127.0.0.1',
      'ICE_TCP_PORT=17881',
      'ICE_UDP_START=50200',
      'ICE_UDP_END=50300',
      'COOKIE_SECURE=false',
      'ALLOW_LOOPBACK_HTTP=true',
      'CADDY_CONFIG_FILE=',
      'LIVEKIT_CONFIG_FILE=',
      'BACKUP_DESTINATION=',
      'BACKUP_INDEPENDENCE_CONFIRMED=false',
      'DISK_WARNING_FREE_GIB=15',
      'BROWSER_CORE_ORIGIN=http://localhost:13000',
      'BROWSER_MEDIA_PROFILE=',
      'MEDIA_FPS=15',
      'SESSION_IDLE_MS=300000',
      'SESSION_TTL_MS=1200000',
      'VITE_BROWSER_ACTIVITY=true'
    )
    # Keep the first-run secrets private and never print their values.
    [IO.File]::WriteAllLines($envFile,$lines,[Text.UTF8Encoding]::new($false))
    if($env:OS -eq 'Windows_NT'){icacls $envFile /inheritance:r /grant:r "$([Security.Principal.WindowsIdentity]::GetCurrent().Name):(R,W)" | Out-Null;if($LASTEXITCODE){throw 'Could not restrict local secret file permissions.'}}
  }
  if(!(Test-Path -LiteralPath $livekitFile)){
    $secret=New-HexSecret
    @"
port: 7880
bind_addresses: ["0.0.0.0"]
rtc:
  tcp_port: 48034
  udp_port: 48035
  node_ip: 127.0.0.1
  use_external_ip: false
  enable_loopback_candidate: true
keys:
  spike: $secret
logging:
  level: warn
"@ | Set-Content -LiteralPath $livekitFile -Encoding ascii
    if($env:OS -eq 'Windows_NT'){icacls $livekitFile /inheritance:r /grant:r "$([Security.Principal.WindowsIdentity]::GetCurrent().Name):(R,W)" | Out-Null;if($LASTEXITCODE){throw 'Could not restrict local LiveKit config permissions.'}}
  }
  Push-Location $root
  try {
    if(!(Test-Path -LiteralPath $voiceFile)){
      '{"port":7880,"rtc":{"tcp_port":17881,"port_range_start":50200,"port_range_end":50300,"use_external_ip":false,"enable_loopback_candidate":true},"redis":{"address":"redis:6379"}}' | Set-Content -LiteralPath $voiceFile -Encoding ascii
    }
    # Ensure generated service URLs point to this isolated local project.
    $localIceIp='127.0.0.1'
    if($env:OS -eq 'Windows_NT'){
      $wslIp=Get-NetIPAddress -InterfaceAlias 'vEthernet (WSL)' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object AddressState -eq Preferred | Select-Object -First 1 -ExpandProperty IPAddress
      if($wslIp){$localIceIp=$wslIp}
    }
    $content=Get-Content -LiteralPath $envFile
    if(!($content | Where-Object {$_ -like 'BROWSER_GUARD_SCRIPT=*'})){$content+= "BROWSER_GUARD_SCRIPT=$($guardFile.Replace('\','/'))"}
    $content=$content | ForEach-Object {
      if($_ -like 'CADDY_CONFIG_FILE=*'){"CADDY_CONFIG_FILE=$($PSScriptRoot.Replace('\','/'))/Caddyfile"}
      elseif($_ -like 'LIVEKIT_CONFIG_FILE=*'){"LIVEKIT_CONFIG_FILE=$($voiceFile.Replace('\','/'))"}
      elseif($_ -match '^(LIVEKIT_NODE_IP|ICE_BIND_IP)='){"$($matches[1])=$localIceIp"}
      else{$_}
    }
    [IO.File]::WriteAllLines($envFile,$content,[Text.UTF8Encoding]::new($false))
    Invoke-CoreCompose @('config','--quiet')
    Invoke-BrowserCompose @('config','--quiet')
    Ensure-CoreNetwork
    Ensure-BrowserNetwork
    Invoke-CoreCompose @('up','-d','--wait','--wait-timeout','600','postgres','redis','rustfs','livekit')
    Invoke-BrowserCompose @('build')
    Invoke-BrowserCompose @('up','-d','--no-build','--pull','never','--wait','--wait-timeout','600')
    Invoke-CoreCompose @('up','-d','--build','--wait','--wait-timeout','600','backend','frontend','caddy')
  } finally {Pop-Location}
  Write-Output 'Локальный Zvonok с Browser Activity: http://localhost:13000 . Секреты сохранены вне репозитория.'
} else {
  Invoke-BrowserCompose @('down')
  Remove-BrowserNetwork
  Invoke-CoreCompose @('down')
  Remove-CoreNetwork
  Write-Output 'Контейнеры остановлены; named volumes и данные сохранены.'
}
