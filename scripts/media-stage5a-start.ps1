$ErrorActionPreference='Stop'
if(docker ps -a --filter 'name=^/zvonok-stage5a-backend$' --format '{{.Names}}'){throw 'Diagnostic container already exists; inspect before reusing'}
$config=docker inspect zvonok-backend | ConvertFrom-Json
$network=($config[0].NetworkSettings.Networks.PSObject.Properties | Select-Object -First 1).Name
$argsList=@('run','-d','--name','zvonok-stage5a-backend','--label','zvonok.acceptance=stage5a','--network',$network,'-p','127.0.0.1:18081:8080','--mount','type=bind,source=C:/project/zvonok-backend/target/zvonok-0.0.1-SNAPSHOT.jar,target=/opt/app/app.jar,readonly')
foreach($entry in $config[0].Config.Env){$pair=$entry -split '=',2;if($pair[0] -in @('PATH','JAVA_HOME','LANG','LANGUAGE','LC_ALL','JAVA_VERSION')){continue};[Environment]::SetEnvironmentVariable($pair[0],$pair[1],'Process');$argsList+=@('-e',$pair[0])}
$env:SPRING_JPA_HIBERNATE_DDL_AUTO='validate';$env:SPRING_JPA_SHOW_SQL='false';$env:SECURITY_ALLOWED_ORIGINS='http://localhost:3001';$env:LOGGING_LEVEL_APP='INFO'
$argsList+=@('-e','SPRING_JPA_HIBERNATE_DDL_AUTO','-e','SPRING_JPA_SHOW_SQL','-e','SECURITY_ALLOWED_ORIGINS','-e','LOGGING_LEVEL_APP',$config[0].Config.Image)
& docker @argsList
if($LASTEXITCODE){throw 'Diagnostic backend failed'}
