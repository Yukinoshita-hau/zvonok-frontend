$ErrorActionPreference='Stop'
$directory=Join-Path ([IO.Path]::GetTempPath()) ('stage5e-log-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $directory | Out-Null
$config=Join-Path $directory 'Caddyfile'
[IO.File]::WriteAllText($config,([IO.File]::ReadAllText("$PSScriptRoot/Caddyfile").Replace('livekit:7880','127.0.0.1:1')))
$name='zvonok-stage5e-log-'+[guid]::NewGuid().ToString('N').Substring(0,8)
$id=docker run -d --name $name --label io.zvonok.deployment=stage5e-log-probe --network zvonok-stage5e_private -p 127.0.0.1:17990:17990 --tmpfs /data --tmpfs /config -e APP_SITE=http://localhost:13990 -e S3_SITE=http://localhost:19090 -e LIVEKIT_SITE=http://localhost:17990 --mount "type=bind,source=$config,target=/etc/caddy/Caddyfile,readonly" caddy:2.10.2-alpine
if($LASTEXITCODE){throw 'Cannot start isolated log probe'}
try{
 $response=$null
 for($attempt=0;$attempt -lt 20;$attempt++){
  try{$response=Invoke-WebRequest 'http://localhost:17990/rtc?access_token=S5E-SECRET-ALPHA&token=S5E-SECRET-BETA&X-Amz-Signature=S5E-SECRET-GAMMA' -Headers @{Authorization='Bearer S5E-SECRET-ALPHA';'Sec-WebSocket-Protocol'='v12.stomp, zvonok.auth.S5E-SECRET-DELTA';Cookie='session=S5E-SECRET-COOKIE'} -SkipHttpErrorCheck;break}catch{Start-Sleep -Milliseconds 200}
 }
 if(!$response -or $response.StatusCode -ne 502){throw 'Expected actual reverse-proxy 502'}
 $logs=(docker logs $name 2>&1 | ForEach-Object {[string]$_}) -join "`n"
 if($logs.Contains('S5E-SECRET-')){throw 'Sensitive synthetic value leaked into runtime logs'}
 $errors=@($logs -split "`n" | Where-Object {$_ -match '^\{' } | ForEach-Object {$_ | ConvertFrom-Json} | Where-Object {$_.logger -eq 'http.log.error'})
 if(!$errors.Count -or $errors[0].request.uri -ne '/rtc' -or $errors[0].request.headers){throw 'Unexpected Caddy error log format/redaction'}
 $out=Join-Path $PSScriptRoot '../media-stage5e-evidence'
 [IO.File]::WriteAllText((Join-Path $out 'caddy-log-probe.json'),($errors | ConvertTo-Json -Depth 8))
 @{status='PASS';realProxyError=502;accessTokenQueryRemoved=$true;signatureQueryRemoved=$true;requestHeadersRemoved=$true;testValues='synthetic only';probeContainer=$name} | ConvertTo-Json | Set-Content (Join-Path $out 'log-redaction.json')
 Write-Output 'PASS actual Caddy 502 logs redact access_token, token, S3 signature and credential headers'
}finally{docker stop $name | Out-Null}
