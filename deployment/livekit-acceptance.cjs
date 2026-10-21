// Reuse the Stage 5C real-call harness; only deployment URLs and evidence destination differ.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
process.chdir(root);
process.env.UI_STAGE_BASE=process.env.STAGE5E_BASE||'http://localhost:13000';
process.env.UI_STAGE_API=process.env.UI_STAGE_BASE+'/api';
process.env.UI_STAGE_EVIDENCE='media-stage5e-evidence/call';
const file=path.join(root,'scripts/ui-call-stage-acceptance.cjs');
let source=fs.readFileSync(file,'utf8');
source='let tokenDiagnosticsLeak=false;\n'+source.replace('page.on("console", (m) => {','page.on("console", (m) => { if (/eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\./.test(m.text())) tokenDiagnosticsLeak=true;');
const marker="if (process.argv.includes('--settings')) {";
if(!source.includes(marker))throw Error('Existing call harness changed; review injection point');
source=source.replace(marker,"if (true) { const security=await require('../deployment/livekit-security-check.cjs').check([a,b]);record('room-scoped 10-minute grants, no persistent tokens, accepted SDK transport',{security});await require('./media-stage5c-call.cjs').run({a,b,c,dm,group,out,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes});if(tokenDiagnosticsLeak)throw Error('JWT leaked into browser diagnostics');record('no JWT in captured browser console');return; }\n"+marker);
const runner=new Module(file,module);runner.filename=file;runner.paths=Module._nodeModulePaths(path.dirname(file));runner._compile(source,file);
