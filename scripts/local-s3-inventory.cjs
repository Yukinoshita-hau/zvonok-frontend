// Read-only source inventory. Credentials stay in memory; no URL queries are logged.
const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const env=JSON.parse(execFileSync('docker',['inspect','zvonok-backend','--format','{{json .Config.Env}}'],{encoding:'utf8'}));
const cfg=Object.fromEntries(env.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const sql=`SELECT json_build_object('attachments',(SELECT coalesce(json_agg(json_build_object('id',id,'key',storage_key,'bytes',size_bytes)),'[]') FROM message_attachment),'avatars',(SELECT coalesce(json_agg(json_build_object('id',id,'url',avatar_url)),'[]') FROM "user" WHERE avatar_url IS NOT NULL));`;
const refs=JSON.parse(execFileSync('docker',['exec','-i','zvonok-postgres','psql','-U','rashid','-d','zvonok','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'}));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),hmac=(k,s)=>crypto.createHmac('sha256',k).update(s).digest();
const enc=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
async function head(key,method='HEAD',query={},bucket='zvonok-data'){
 const url=new URL(cfg.S3_ENDPOINT);url.pathname=url.pathname.replace(/\/$/,'')+(bucket?'/'+bucket:'')+(key?'/'+key.split('/').map(enc).join('/'):'')||'/';for(const[k,v]of Object.entries(query))url.searchParams.set(k,v);
 const time=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=time.slice(0,8),region=cfg.S3_REGION||'ru-central-1',scope=day+'/'+region+'/s3/aws4_request';
 const canonical=[method,url.pathname,Object.entries(query).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>enc(k)+'='+enc(v)).join('&'),`host:${url.host}\nx-amz-content-sha256:${hash('')}\nx-amz-date:${time}\n`,'host;x-amz-content-sha256;x-amz-date',hash('')].join('\n');
 const signing=hmac(hmac(hmac(hmac('AWS4'+cfg.S3_SECRET_ACCESS_KEY,day),region),'s3'),'aws4_request');
 const signature=crypto.createHmac('sha256',signing).update('AWS4-HMAC-SHA256\n'+time+'\n'+scope+'\n'+hash(canonical)).digest('hex');
 const response=await fetch(url,{method,signal:AbortSignal.timeout(15000),headers:{'x-amz-date':time,'x-amz-content-sha256':hash(''),Authorization:`AWS4-HMAC-SHA256 Credential=${cfg.S3_ACCESS_KEY}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`}});
 return method==='HEAD'?{status:response.status,bytes:Number(response.headers.get('content-length')),contentType:response.headers.get('content-type')}:{status:response.status,xml:await response.text()};
}
const decode=s=>s.replace(/&#x([a-f0-9]+);|&#([0-9]+);|&(amp|lt|gt|quot|apos);/gi,(_,hex,decimal,name)=>hex?String.fromCodePoint(parseInt(hex,16)):decimal?String.fromCodePoint(Number(decimal)):{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name]);
async function list(bucket){const objects=[];let token;do{const response=await head('','GET',{'list-type':'2',...(token?{'continuation-token':token}:{})},bucket);if(response.status!==200)return{status:response.status};for(const item of response.xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)){const key=item[1].match(/<Key>([\s\S]*?)<\/Key>/),size=item[1].match(/<Size>(\d+)<\/Size>/);if(!key||!size)throw Error('Invalid inventory response');objects.push({key:decode(key[1]),bytes:Number(size[1])});}token=response.xml.includes('<IsTruncated>true</IsTruncated>')?decode(response.xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1]||''):null;if(token==='')throw Error('Missing pagination token');}while(token);return{status:200,count:objects.length,bytes:objects.reduce((n,x)=>n+x.bytes,0),objects};}
(async()=>{
 const objects=new Map(refs.attachments.map(a=>[a.key,{key:a.key,kind:'attachment',expectedBytes:a.bytes}]));
 for(const avatar of refs.avatars){try {const key=decodeURIComponent(new URL(avatar.url).pathname.split('/').pop());if(key.startsWith('avatar_'))objects.set(key,{key,kind:'avatar'});}catch{}}
 const queue=[...objects.values()],results=[];
 await Promise.all(Array.from({length:3},async()=>{while(queue.length){const item=queue.shift();try{Object.assign(item,await head(item.key));}catch(error){item.error=error.name;}results.push(item);}}));
 const currentBucket=await list('zvonok-data'),all=await head('','GET',{},null),bucketNames=all.status===200?[...all.xml.matchAll(/<Bucket>([\s\S]*?)<\/Bucket>/g)].map(x=>{const name=x[1].match(/<Name>(.*?)<\/Name>/);if(!name)throw Error('Invalid bucket inventory');return decode(name[1]);}):[],otherBuckets=[];
 for(const bucket of bucketNames.filter(x=>x!=='zvonok-data')){const inventory=await list(bucket);otherBuckets.push({bucket,...inventory,keysAbsentFromCurrent:inventory.objects?.filter(x=>!currentBucket.objects?.some(y=>y.key===x.key))});}
 const report={timestamp:new Date().toISOString(),mode:'READ_ONLY',attachmentRows:refs.attachments.length,attachmentBytes:refs.attachments.reduce((n,a)=>n+a.bytes,0),avatarReferences:refs.avatars.length,objects:results,available:results.filter(x=>x.status===200).length,missing:results.filter(x=>x.status===404).length,otherFailures:results.filter(x=>x.status!==200&&x.status!==404).length,currentBucket,unreferencedObjects:currentBucket.objects?.filter(x=>!objects.has(x.key)),listBucketsStatus:all.status,otherBuckets,sourceChecksums:'NOT RUN - HEAD/LIST only'};
 fs.mkdirSync('artifacts/stages/media-stage5d-evidence',{recursive:true});fs.writeFileSync('artifacts/stages/media-stage5d-evidence/source-inventory.json',JSON.stringify(report,null,2));
 console.log({attachmentRows:report.attachmentRows,attachmentBytes:report.attachmentBytes,avatarReferences:report.avatarReferences,available:report.available,missing:report.missing,otherFailures:report.otherFailures,bucketObjects:currentBucket.count,bucketBytes:currentBucket.bytes,unreferencedObjects:report.unreferencedObjects?.length,listBucketsStatus:all.status,otherBuckets:otherBuckets.map(x=>({bucket:x.bucket,status:x.status,count:x.count,bytes:x.bytes,absentFromCurrent:x.keysAbsentFromCurrent?.length}))});
 if(report.otherFailures)process.exitCode=1;
})().catch(error=>{console.error(error.name);process.exitCode=1;});
