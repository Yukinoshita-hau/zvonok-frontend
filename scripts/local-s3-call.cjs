// Reuse the existing short Stage5C DM/RTP/media regression against the isolated backend.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('scripts/ui-call-stage-acceptance.cjs');
let source=fs.readFileSync(file,'utf8');
const marker="if (process.argv.includes('--settings')) {";
if(!source.includes(marker))throw Error('Call harness changed; inspect before running');
source=source.replace(marker,"if (true) { await require('./media-stage5c-call.cjs').run({a,b,c,dm,group,out,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes});return; }\n"+marker);
process.env.UI_STAGE_BASE='http://localhost:3001';process.env.UI_STAGE_EVIDENCE='artifacts/stages/media-stage5d-evidence/call';
const runner=new Module(file,module);runner.filename=file;runner.paths=Module._nodeModulePaths(path.dirname(file));runner._compile(source,file);
