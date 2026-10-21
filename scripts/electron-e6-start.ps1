param([switch]$DesktopCookieFixture)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path "$PSScriptRoot/..").Path
$taskOut = "$taskRoot/artifacts/stages/electron-e6"
$taskConfig = "$taskOut/core.properties.local"
if (Test-Path $taskConfig) { throw 'Inspect the existing E6 test infrastructure before starting again' }
function NewTestSecret { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
$taskDbSecret = NewTestSecret
$taskVoiceSecret = NewTestSecret
@"
port: 48886
bind_addresses: [0.0.0.0]
rtc:
  tcp_port: 48887
  udp_port: 48888
  use_external_ip: false
keys:
  e6-local: $taskVoiceSecret
"@ | Set-Content "$taskOut/voice.local.yaml"
@"
server.address=127.0.0.1
server.port=18086
server.servlet.context-path=/api
spring.datasource.url=jdbc:postgresql://127.0.0.1:55436/e6_test
spring.datasource.username=e6_test
spring.datasource.password=$taskDbSecret
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.globally_quoted_identifiers=true
app.jwt.secret=$([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64)))
app.jwt.ExpirationMs=3600000
app.jwt.refreshExpirationMs=3600000
app.public-url=http://127.0.0.1:3038
security.allowedOrigins=http://127.0.0.1:3038,http://127.0.0.1:18086,null
security.cookie.same-site=$(if ($DesktopCookieFixture) { 'None' } else { 'Lax' })
security.cookie.secure=$(if ($DesktopCookieFixture) { 'true' } else { 'false' })
security.cookie.max-age=3600
security.cookie.path=/api/auth
livekit.server-url=ws://127.0.0.1:48886
livekit.api-url=http://127.0.0.1:48886
livekit.api-key=e6-local
livekit.api-secret=$taskVoiceSecret
s3.endpoint=http://127.0.0.1:1
s3.localEndpoint=http://127.0.0.1:1
s3.access-key=unused-local-test
s3.secret-access-key=unused-local-test
zvonok.java-lsp.enabled=false
browser.activity.enabled=false
logging.level.root=WARN
logging.level.org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration=ERROR
"@ | Set-Content $taskConfig
$env:POSTGRES_PASSWORD = $taskDbSecret
docker run -d --name zvonok-e6-postgres --label zvonok.acceptance=electron-e6 -p 127.0.0.1:55436:5432 -e POSTGRES_DB=e6_test -e POSTGRES_USER=e6_test -e POSTGRES_PASSWORD postgres:16-alpine
if ($LASTEXITCODE) { throw 'E6 PostgreSQL launch failed' }
docker run -d --name zvonok-e6-livekit --label zvonok.acceptance=electron-e6 -p 127.0.0.1:48886:48886 -p 127.0.0.1:48887:48887 -p 127.0.0.1:48888:48888/udp --mount "type=bind,source=$taskOut/voice.local.yaml,target=/config/livekit.yaml,readonly" livekit/livekit-server:v1.9.12 --config /config/livekit.yaml --node-ip 127.0.0.1
if ($LASTEXITCODE) { throw 'E6 LiveKit launch failed' }
$taskJava = Join-Path $env:USERPROFILE '.jdks/semeru-21.0.9/bin/java.exe'
$taskCore = Start-Process $taskJava -ArgumentList @('-jar', 'C:/project/zvonok-backend/target/zvonok-0.0.1-SNAPSHOT.jar', "--spring.config.location=file:$taskConfig[.properties]") -WindowStyle Hidden -PassThru -RedirectStandardOutput "$taskOut/core.log" -RedirectStandardError "$taskOut/core-error.log"
$taskCore.Id | Set-Content "$taskOut/core.pid.local"
Write-Output 'Isolated E6 Core started on 18086; PostgreSQL 55436; LiveKit 48886.'
