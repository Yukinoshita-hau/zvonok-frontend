$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path "$PSScriptRoot/../..").Path
$taskEvidence="$taskRoot/artifacts/stages/work/browser-activity-20261021"
foreach($taskName in @('core','vite','preview','regression-vite','settings-vite')) {
  $taskPidFile="$taskEvidence/$taskName.pid.local"
  if(!(Test-Path $taskPidFile)){continue}
  $taskProcessId=[int](Get-Content $taskPidFile)
  $taskProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if(!$taskProcess){continue}
  $taskCommand=$taskProcess.CommandLine
  $taskOwned=if($taskName -eq 'core'){$taskCommand -like '*browser-activity-20261021/core.properties.local*'}
    elseif($taskName -eq 'regression-vite'){$taskCommand -like '*vite*' -and $taskCommand -like '*3019*'}
    elseif($taskName -eq 'settings-vite'){$taskCommand -like '*fixture.vite.config.ts*' -and $taskCommand -like '*3020*'}
    else{$taskCommand -like '*scripts/browser-activity/vite.config.ts*'}
  if(!$taskOwned){throw "Refusing to stop unrelated process in $taskPidFile"}
  Stop-Process -Id $taskProcessId
}
$env:ACTIVITY_DB_PASSWORD=((Get-Content "$taskEvidence/core.properties.local" | Where-Object {$_.StartsWith('spring.datasource.password=')}) -split '=',2)[1]
& docker --context desktop-linux compose -f "$PSScriptRoot/compose.acceptance.yaml" stop
if($LASTEXITCODE){throw 'Acceptance stop failed'}
Write-Output 'Acceptance host processes and isolated DB/voice stopped. Volumes and evidence preserved; Core Docker untouched.'
