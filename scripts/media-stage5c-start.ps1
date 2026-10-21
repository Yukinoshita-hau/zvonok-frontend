$ErrorActionPreference='Stop'
if(docker ps -a --filter 'name=^/zvonok-stage5c-backend$' --format '{{.Names}}'){throw 'Inspect existing diagnostic container first'}
$config=docker inspect zvonok-stage5b-backend | ConvertFrom-Json
$network=($config[0].NetworkSettings.Networks.PSObject.Properties | Select-Object -First 1).Name
$argsList=@('run','-d','--name','zvonok-stage5c-backend','--label','zvonok.acceptance=stage5c','--network',$network,'-p','127.0.0.1:18081:8080','--mount','type=bind,source=C:/project/zvonok-backend/target/zvonok-0.0.1-SNAPSHOT.jar,target=/opt/app/app.jar,readonly')
foreach($entry in $config[0].Config.Env){
  $pair=$entry -split '=',2
  if($pair[0] -in @('PATH','JAVA_HOME','LANG','LANGUAGE','LC_ALL','JAVA_VERSION')){continue}
  if($pair[0] -eq 'SPRING_DATASOURCE_URL'){$pair[1]=$pair[1] -replace '/zvonok(?=\?|$)','/zvonok_stage5c_diag'}
  [Environment]::SetEnvironmentVariable($pair[0],$pair[1],'Process');$argsList+=@('-e',$pair[0])
}
$env:SPRING_JPA_HIBERNATE_DDL_AUTO='validate';$argsList+=@('-e','SPRING_JPA_HIBERNATE_DDL_AUTO',$config[0].Config.Image)
& docker @argsList
if($LASTEXITCODE){throw 'Diagnostic backend failed'}
