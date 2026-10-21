$ErrorActionPreference = 'Stop'
# Only new, explicitly named disposable containers. No production DDL or volumes.
$names = @('zvonok-core-final-pg', 'zvonok-core-final-s3', 'zvonok-core-final-backend')
foreach ($name in $names) {
    if (docker ps -a --filter "name=^/$name`$" --format '{{.Names}}') { throw "Already exists: $name; inspect before reusing" }
}
$state = @{dbPassword=[guid]::NewGuid().ToString('N');s3User='corefinal';s3Password=[guid]::NewGuid().ToString('N');jwt=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))}
$statePath = Join-Path $env:TEMP 'zvonok-core-final-runtime.json'
if (Test-Path $statePath) { throw 'Diagnostic state already exists; inspect before reusing' }
$state | ConvertTo-Json | Set-Content $statePath
function CheckedDocker([string[]]$DockerArgs) { & docker @DockerArgs; if($LASTEXITCODE){throw "Docker failed: $($DockerArgs[0])"} }
$env:POSTGRES_PASSWORD=$state.dbPassword
CheckedDocker @('run','-d','--name',$names[0],'--label','zvonok.acceptance=core-final','--tmpfs','/var/lib/postgresql/data:rw,size=512m','-p','127.0.0.1:15432:5432','-e','POSTGRES_PASSWORD','-e','POSTGRES_USER=corefinal','-e','POSTGRES_DB=zvonok_core_final','postgres:16-alpine')
$env:MINIO_ROOT_USER=$state.s3User; $env:MINIO_ROOT_PASSWORD=$state.s3Password
CheckedDocker @('run','-d','--name',$names[1],'--label','zvonok.acceptance=core-final','--tmpfs','/data:rw,size=512m,mode=1777','-p','127.0.0.1:19001:9000','-e','MINIO_ROOT_USER','-e','MINIO_ROOT_PASSWORD','zvonok-stage10-1-minio:source-pinned')
# Inherit required settings without printing values, then override all external state.
$runtime = docker inspect zvonok-backend --format '{{json .Config.Env}}' | ConvertFrom-Json
$map = @{}
foreach($entry in $runtime){$parts=$entry -split '=',2;$map[$parts[0]]=$parts[1]}
$map.SPRING_DATASOURCE_URL='jdbc:postgresql://host.docker.internal:15432/zvonok_core_final'
$map.SPRING_DATASOURCE_USERNAME='corefinal';$map.SPRING_DATASOURCE_PASSWORD=$state.dbPassword
$map.SPRING_JPA_HIBERNATE_DDL_AUTO='create';$map.SPRING_JPA_SHOW_SQL='false'
$map.APP_JWT_SECRET=$state.jwt;$map.APP_JWT_EXPIRATION_MS='12000000'
$map.S3_ENDPOINT='http://host.docker.internal:19000';$map.S3_ACCESS_KEY=$state.s3User;$map.S3_SECRET_ACCESS_KEY=$state.s3Password
$map.S3_LOCAL_ENDPOINT='http://localhost:18080/api/s3/download'
$map.SECURITY_ALLOWED_ORIGINS='http://127.0.0.1:13000';$map.APP_PUBLIC_URL='http://127.0.0.1:13000'
$map.LIVEKIT_API_URL='http://127.0.0.1:9';$map.LIVEKIT_SERVER_URL='ws://127.0.0.1:9'
$map.LOGGING_LEVEL_APP='INFO';$map.LOGGING_LEVEL_SECURITY='WARN'
$argsList=@('run','-d','--name',$names[2],'--label','zvonok.acceptance=core-final','-p','127.0.0.1:18080:8080','--mount','type=bind,source=C:/project/zvonok-backend/target/zvonok-0.0.1-SNAPSHOT.jar,target=/opt/app/app.jar,readonly')
foreach($key in $map.Keys){if($key -in @('PATH','JAVA_HOME','LANG','LANGUAGE','LC_ALL','JAVA_VERSION')){continue};[Environment]::SetEnvironmentVariable($key,$map[$key],'Process');$argsList+=@('-e',$key)}
CheckedDocker ($argsList+@('zvonok-backend-backend'))
Write-Output 'Disposable PostgreSQL/MinIO/backend started; state is private in TEMP. create applies only to empty diagnostic DB.'
