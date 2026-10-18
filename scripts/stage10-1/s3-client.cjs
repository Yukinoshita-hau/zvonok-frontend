const crypto=require('node:crypto'),fs=require('node:fs');
const cfg=JSON.parse(fs.readFileSync('C:/project/zvonok-backend/stage10-1-evidence/runtime.env','utf8').replace(/^\uFEFF/,''));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),hmac=(k,x)=>crypto.createHmac('sha256',k).update(x).digest(),enc=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
async function s3(method,key='',query={},body=Buffer.alloc(0),headers={}){
 const url=new URL('http://127.0.0.1:19001/zvonok-avatars'+(key?'/'+key:''));for(const[k,v]of Object.entries(query))url.searchParams.set(k,v);
 const time=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=time.slice(0,8),scope=day+'/ru-central-1/s3/aws4_request';
 const hs={host:url.host,'x-amz-content-sha256':hash(body),'x-amz-date':time,...headers};const names=Object.keys(hs).sort();const signed=names.join(';');const canonical=[method,url.pathname.split('/').map(enc).join('/'),[...url.searchParams.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>enc(k)+'='+enc(v)).join('&'),names.map(k=>k+':'+hs[k].trim()+'\n').join(''),signed,hash(body)].join('\n');
 const k=hmac(hmac(hmac(hmac('AWS4'+cfg.s3Password,day),'ru-central-1'),'s3'),'aws4_request');hs.Authorization='AWS4-HMAC-SHA256 Credential='+cfg.s3User+'/'+scope+', SignedHeaders='+signed+', Signature='+crypto.createHmac('sha256',k).update('AWS4-HMAC-SHA256\n'+time+'\n'+scope+'\n'+hash(canonical)).digest('hex');delete hs.host;
 return fetch(url,{method,headers:hs,...(method==='GET'||method==='HEAD'?{}:{body})});
}
async function keys(){const r=await s3('GET','',{'list-type':'2'});if(!r.ok)throw Error('S3 list '+r.status);const xml=await r.text();return [...xml.matchAll(/<Key>(.*?)<\/Key>/g)].map(m=>m[1].replace(/&amp;/g,'&'));}
async function fault(value){const r=await fetch('http://127.0.0.1:19002',{method:'POST',body:JSON.stringify(value)});if(!r.ok)throw Error('fault proxy control unavailable');}
module.exports={s3,keys,fault};
