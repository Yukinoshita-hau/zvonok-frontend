const assert=require('node:assert/strict');
const e=process.env;
for(const key of ['APP_URL','S3_PUBLIC_URL','LIVEKIT_HTTP_URL','LIVEKIT_PUBLIC_URL','WS_PUBLIC_URL']){
 const u=new URL(e[key]);
 assert.equal(u.protocol,key.includes('WS_')||key==='LIVEKIT_PUBLIC_URL'?'wss:':'https:',key+' requires TLS');
 assert.ok(!['localhost','127.0.0.1','0.0.0.0','::1'].includes(u.hostname)&&u.hostname.includes('.')&&!u.hostname.endsWith('.invalid'),'Real public host required');
 assert.ok(!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname===(key==='WS_PUBLIC_URL'?'/api/ws-raw':'/'));
}
assert.equal(e.ALLOW_LOOPBACK_HTTP,'false');assert.equal(e.COOKIE_SECURE,'true');
assert.ok(e.LIVEKIT_NODE_IP&&!['localhost','127.0.0.1','0.0.0.0'].includes(e.LIVEKIT_NODE_IP));
for(const key of ['JWT_SECRET','POSTGRES_PASSWORD','S3_SECRET_ACCESS_KEY','RUSTFS_SECRET_KEY','LIVEKIT_API_SECRET'])assert.ok(e[key]?.length>=32,'Required strong '+key);
assert.ok(/^[A-Za-z0-9+/]+={0,2}$/.test(e.JWT_SECRET)&&Buffer.from(e.JWT_SECRET,'base64').length>=64,'JWT_SECRET must encode at least 64 bytes for HS512');
assert.ok(e.S3_ACCESS_KEY!==e.RUSTFS_ACCESS_KEY,'Application identity must differ from root');
console.log('PASS production configuration guard');
