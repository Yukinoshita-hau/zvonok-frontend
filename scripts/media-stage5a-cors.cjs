// Only the explicitly approved bucket CORS operation; no ACL/policy/credential mutations.
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto'),fs=require('node:fs'),assert=require('node:assert/strict');
const env=JSON.parse(execFileSync('docker',['inspect','zvonok-backend','--format','{{json .Config.Env}}'],{encoding:'utf8'}));
const cfg=Object.fromEntries(env.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),hmac=(k,x)=>crypto.createHmac('sha256',k).update(x).digest();
async function request(method,body=''){
 const url=new URL('/zvonok-data?cors',cfg.S3_ENDPOINT),time=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=time.slice(0,8);
 const scope=day+'/ru-central-1/s3/aws4_request',headers={host:url.host,'x-amz-content-sha256':hash(body),'x-amz-date':time};
 if(method==='PUT'){headers['content-type']='application/xml';headers['content-md5']=crypto.createHash('md5').update(body).digest('base64');}
 const names=Object.keys(headers).sort(),signed=names.join(';');
 const canonical=[method,url.pathname,'cors=',names.map(k=>k+':'+headers[k]+'\n').join(''),signed,hash(body)].join('\n');
 const key=hmac(hmac(hmac(hmac('AWS4'+cfg.S3_SECRET_ACCESS_KEY,day),'ru-central-1'),'s3'),'aws4_request');
 headers.Authorization='AWS4-HMAC-SHA256 Credential='+cfg.S3_ACCESS_KEY+'/'+scope+', SignedHeaders='+signed+', Signature='+crypto.createHmac('sha256',key).update('AWS4-HMAC-SHA256\n'+time+'\n'+scope+'\n'+hash(canonical)).digest('hex');delete headers.host;
 const r=await fetch(url,{method,headers,...(method==='PUT'?{body}:{})});return {status:r.status,configuration:await r.text()};
}
(async()=>{
 const before=await request('GET');
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/s3-cors-current.json',JSON.stringify(before,null,2));
 if(!process.argv.includes('--apply')){console.log(before);return;}
 if(!fs.existsSync('artifacts/stages/media-stage5a-evidence/s3-cors-before.json')) fs.writeFileSync('artifacts/stages/media-stage5a-evidence/s3-cors-before.json',JSON.stringify(before,null,2));
 const xml=fs.readFileSync('artifacts/stages/media-stage5a-evidence/proposed-s3-cors.xml','utf8').replace(/^\uFEFF/,'');
 assert.deepEqual([...xml.matchAll(/<AllowedOrigin>(.*?)<\/AllowedOrigin>/g)].map(x=>x[1]),['http://localhost:3000','http://localhost:3001']);
 assert.deepEqual([...xml.matchAll(/<AllowedMethod>(.*?)<\/AllowedMethod>/g)].map(x=>x[1]),['GET','HEAD']);
 assert.ok(!xml.includes('*')&&!/ACL|Policy|Credential|AllowedOrigin>null/.test(xml));
 assert.equal(before.status,404,'CORS appeared since approval; merge/review before overwriting');
 assert.ok(before.configuration.includes('NoSuchCORSConfiguration'));
 const applied=await request('PUT',xml);assert.equal(applied.status,200,'provider refused approved CORS');
 const after=await request('GET');assert.equal(after.status,200);
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/s3-cors-after.json',JSON.stringify(after,null,2));
 console.log({status:'PASS',before:before.status,put:applied.status,after:after.status,origins:['http://localhost:3000','http://localhost:3001'],methods:['GET','HEAD'],policyChanged:false,aclChanged:false});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
