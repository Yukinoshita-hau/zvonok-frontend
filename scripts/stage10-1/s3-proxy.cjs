// Acceptance-only real S3 forwarding proxy. Faults return explicit HTTP 503; it stores no objects.
const http=require('node:http'),fs=require('node:fs');
let fault=null;const operations=[];
http.createServer((req,res)=>{
 const path=req.url.split('?')[0];
 if(fault&&req.method===fault.method&&(!fault.path||path.includes(fault.path))){operations.push({method:req.method,path,status:503,injected:true});res.writeHead(503,{'Content-Type':'application/xml'});res.end('<Error><Code>ServiceUnavailable</Code><Message>Stage10.1 injected network service failure</Message></Error>');return;}
 const upstream=http.request({hostname:'127.0.0.1',port:19001,path:req.url,method:req.method,headers:req.headers},r=>{operations.push({method:req.method,path,status:r.statusCode});res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
}).listen(19000,'127.0.0.1');
http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{if(req.method==='POST')fault=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({fault,operations}));}catch{res.writeHead(400);res.end();}});}).listen(19002,'127.0.0.1');
process.on('SIGINT',()=>{fs.writeFileSync('stage10-1-evidence/s3-proxy-operations.json',JSON.stringify(operations,null,2));process.exit();});
console.log('Stage10.1 loopback S3 fault proxy ready');
