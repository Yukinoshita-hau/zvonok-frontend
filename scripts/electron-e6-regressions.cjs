const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = process.env.ZVONOK_E6_REGRESSIONS_OUT || 'artifacts/stages/electron-e6/regressions'; fs.mkdirSync(root,{recursive:true});
const suites = [
  ['stage-a','scripts/call-layout-stage-a-check.cjs'],['stage-b','scripts/call-layout-stage-b-check.cjs'],
  ['stage-b1','scripts/call-layout-stage-b1-check.cjs'],['stage-c','scripts/call-layout-stage-c-check.cjs'],['stage-d','scripts/call-layout-stage-d-check.cjs'],
  ['settings-functional','scripts/settingsV2/functional-check.cjs'],['settings-s2a','scripts/settingsV2/s2a-check.cjs'],['settings-s2b','scripts/settingsV2/s2b-check.cjs'],
  ['settings-default','scripts/settingsV2/promotion-check.cjs'],['settings-default-extra','scripts/settingsV2/promotion-extra-check.cjs'],['settings-visual','scripts/settingsV2/visual-check.cjs'],
  ['settings-call','scripts/settingsV2/s2a-call-check.cjs'],['settings-shell','scripts/settingsV2/s1c-check.cjs'],['chat','scripts/chat-layout-check.cjs'],
];
const results=[];
for(const [name,file] of suites) {
  if(process.argv.length>2 && !process.argv.slice(2).includes(name))continue;
  let source=fs.readFileSync(file,'utf8').replaceAll('127.0.0.1:3017','127.0.0.1:3038').replaceAll('127.0.0.1:5199','127.0.0.1:3040');
  for(const dir of ['artifacts/stages/work/settings-promotion','artifacts/stages/work/settings-visual','artifacts/stages/call-layout-stage-c-evidence','artifacts/stages/call-layout-stage-d-evidence','artifacts/stages/work/settings-s1c-evidence']) source=source.replaceAll(dir,`${root}/${name}`);
  const runner=path.resolve(`${root}/${name}.cjs`);fs.writeFileSync(runner,source);
  const log=fs.openSync(`${root}/${name}.log`,'w');
  const env={...process.env,STAGE_A_OUTPUT:`${root}/${name}`,STAGE_B_OUTPUT:`${root}/${name}`,STAGE_B1_OUTPUT:`${root}/${name}`,S2A_EVIDENCE:`${root}/${name}`,S2A_CALL_EVIDENCE:`${root}/${name}`,SETTINGS_PROMOTION_OUTPUT:`${root}/${name}`,CHAT_LAYOUT_BASE:'http://127.0.0.1:3040'};
  const run=spawnSync(process.execPath,[runner],{env,stdio:['ignore',log,log],windowsHide:true,timeout:180000});fs.closeSync(log);
  results.push({name,status:run.status===0?'PASS':'FAIL',exitCode:run.status,error:run.error?.message});fs.writeFileSync(`${root}/results.json`,JSON.stringify(results,null,2));console.log(name,results.at(-1).status);
}
if(results.some(row=>row.status!=='PASS'))process.exitCode=1;
