const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
for(const file of ['compose.yaml','dev.yaml','prod.yaml']){
 const text=fs.readFileSync(__dirname+'/'+file,'utf8');assert.ok(!text.includes(':latest'));assert.ok(!text.includes('container_name:'));
}
const caddy=fs.readFileSync(__dirname+'/Caddyfile','utf8');assert.ok(!/^\s*handle_path/m.test(caddy));assert.ok(!caddy.includes('header_up Host'));assert.ok(!caddy.includes('log {'));
const env={...process.env,APP_URL:'http://localhost:13000',S3_PUBLIC_URL:'http://localhost:19020',BACKUP_DESTINATION:'test'};
const rejected=cp.spawnSync(process.execPath,[__dirname+'/production-guard.cjs'],{env});assert.notEqual(rejected.status,0);
const good={...process.env,APP_URL:'https://app.example.com',WS_PUBLIC_URL:'wss://app.example.com',S3_PUBLIC_URL:'https://files.example.com',LIVEKIT_HTTP_URL:'https://calls.example.com',LIVEKIT_PUBLIC_URL:'wss://calls.example.com',ALLOW_LOOPBACK_HTTP:'false',COOKIE_SECURE:'true',BACKUP_DESTINATION:'/mounted-offhost',BACKUP_INDEPENDENCE_CONFIRMED:'true',LIVEKIT_NODE_IP:'192.0.2.1',JWT_SECRET:'j'.repeat(64),POSTGRES_PASSWORD:'p'.repeat(64),S3_ACCESS_KEY:'application',S3_SECRET_ACCESS_KEY:'s'.repeat(64),RUSTFS_ACCESS_KEY:'bootstrap',RUSTFS_SECRET_KEY:'r'.repeat(64),LIVEKIT_API_SECRET:'l'.repeat(64)};
good.JWT_SECRET=Buffer.alloc(64,1).toString('base64');
assert.equal(cp.spawnSync(process.execPath,[__dirname+'/production-guard.cjs'],{env:good}).status,0);
for(const change of [{ALLOW_LOOPBACK_HTTP:'true'},{BACKUP_INDEPENDENCE_CONFIRMED:'false'},{JWT_SECRET:''},{S3_ACCESS_KEY:'bootstrap'},{S3_PUBLIC_URL:'https://localhost'}])assert.notEqual(cp.spawnSync(process.execPath,[__dirname+'/production-guard.cjs'],{env:{...good,...change}}).status,0);
const docker=fs.readFileSync(__dirname+'/frontend.Dockerfile','utf8');assert.ok(docker.includes('VITE_PRIVATE_MEDIA_STREAMING=true'));assert.ok(!docker.includes('18081'));
const inGit=cp.spawnSync('pwsh',['-NoProfile','-File',__dirname+'/deploy.ps1','-Action','init','-EnvFile',__dirname+'/../../zvonok-backend/stage5e-must-not-create.env'],{encoding:'utf8'});
assert.notEqual(inGit.status,0);assert.ok((inGit.stdout+inGit.stderr).includes('Secrets must live outside every Git checkout'));
console.log('PASS deployment static invariants and insecure production rejection');

