$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path "$PSScriptRoot/../..").Path
$taskBrowser = 'C:/project/zvonok-browser'
$taskBackend = 'C:/project/zvonok-backend'
$taskEvidence = "$taskRoot/artifacts/stages/work/browser-activity-20261021"
New-Item -ItemType Directory -Force $taskEvidence | Out-Null
function RandomKey { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
$taskEnvFile = "$taskBrowser/.env.integration.local"
if (!(Test-Path $taskEnvFile)) { "BROWSER_INTEGRATION_KEY=$(RandomKey)" | Set-Content $taskEnvFile }
$env:BROWSER_INTEGRATION_KEY = ((Get-Content $taskEnvFile -Raw).Trim() -split '=',2)[1]
if ($env:BROWSER_INTEGRATION_KEY.Length -lt 43) { throw 'Integration key invalid' }
$taskConfigFile = "$taskEvidence/core.properties.local"
if (!(Test-Path $taskConfigFile)) {
  $taskDbPassword = RandomKey
  $taskVoiceSecret = RandomKey
  $taskJwt = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
  @"
port: 48880
bind_addresses: [0.0.0.0]
rtc:
  tcp_port: 48881
  udp_port: 48882
  use_external_ip: false
keys:
  activity-local: $taskVoiceSecret
"@ | Set-Content "$taskEvidence/voice.local.yaml"
  @"
server.address=127.0.0.1
server.port=18080
server.servlet.context-path=/api
spring.application.name=zvonok-activity-acceptance
spring.datasource.url=jdbc:postgresql://127.0.0.1:55432/activity_acceptance
spring.datasource.username=activity_test
spring.datasource.password=$taskDbPassword
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.globally_quoted_identifiers=true
app.jwt.secret=$taskJwt
app.jwt.ExpirationMs=3600000
app.jwt.refreshExpirationMs=3600000
app.public-url=http://127.0.0.1:3018
security.allowedOrigins=http://127.0.0.1:3018,http://localhost
security.cookie.same-site=Lax
security.cookie.secure=false
security.cookie.max-age=3600
security.cookie.path=/api/auth
livekit.server-url=ws://127.0.0.1:48880
livekit.api-url=http://127.0.0.1:48880
livekit.api-key=activity-local
livekit.api-secret=$taskVoiceSecret
s3.endpoint=http://127.0.0.1:1
s3.localEndpoint=http://127.0.0.1:1
s3.access-key=unused-local-test
s3.secret-access-key=unused-local-test
zvonok.java-lsp.enabled=false
browser.activity.enabled=true
browser.activity.key=$env:BROWSER_INTEGRATION_KEY
logging.level.root=WARN
logging.level.com.zvonok.security.JwtAuthenticationFilter=WARN
logging.level.org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration=ERROR
"@ | Set-Content $taskConfigFile
}
$env:ACTIVITY_DB_PASSWORD = ((Get-Content $taskConfigFile | Where-Object { $_.StartsWith('spring.datasource.password=') }) -split '=',2)[1]
# Refuse to reuse a non-loopback Core configuration.
if (!(Select-String -Quiet -LiteralPath $taskConfigFile -SimpleMatch 'spring.datasource.url=jdbc:postgresql://127.0.0.1:55432/activity_acceptance')) { throw 'Unexpected Core database' }
& docker --context desktop-linux compose -f "$PSScriptRoot/compose.acceptance.yaml" up -d
if ($LASTEXITCODE) { throw 'Isolated dependencies failed' }
Push-Location $taskBrowser
try {
  & docker --context desktop-linux compose -f compose.session.yaml -f compose.integration.yaml up -d --build api worker
  if ($LASTEXITCODE) { throw 'Browser integration failed' }
} finally { Pop-Location }
$taskJar = "$taskBackend/target/zvonok-0.0.1-SNAPSHOT.jar"
$taskJava = 'C:/Users/Пользователь/.jdks/semeru-21.0.9/bin/java.exe'
if (Get-NetTCPConnection -LocalPort 18080 -State Listen -ErrorAction SilentlyContinue) { throw 'Acceptance Core port already occupied' }
$taskCore = Start-Process $taskJava -ArgumentList @('-jar', $taskJar, "--spring.config.location=file:$taskConfigFile[.properties]") -WorkingDirectory $taskBackend -WindowStyle Hidden -PassThru -RedirectStandardOutput "$taskEvidence/core.log" -RedirectStandardError "$taskEvidence/core-error.log"
$taskCore.Id | Set-Content "$taskEvidence/core.pid.local"
if (!(Get-NetTCPConnection -LocalPort 3018 -State Listen -ErrorAction SilentlyContinue)) {
  Push-Location $taskRoot
  try { & node node_modules/vite/bin/vite.js build --config scripts/browser-activity/vite.config.ts; if ($LASTEXITCODE) { throw 'Acceptance build failed' } } finally { Pop-Location }
  $taskVite = Start-Process (Get-Command node.exe).Source -ArgumentList @('node_modules/vite/bin/vite.js', 'preview', '--config', 'scripts/browser-activity/vite.config.ts') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$taskEvidence/vite.log" -RedirectStandardError "$taskEvidence/vite-error.log"
  $taskVite.Id | Set-Content "$taskEvidence/vite.pid.local"
}
Write-Output 'Isolated acceptance Core started at 127.0.0.1:18080; UI at 127.0.0.1:3018. Production Core untouched.'
