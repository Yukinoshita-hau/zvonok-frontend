const crypto = require('node:crypto');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const endpoint = process.env.STORAGE_ENDPOINT || 'http://rustfs:9000';
const bucket = 'zvonok-data';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
async function request(method, path, body = '', admin = true, query = {}) {
  const url = new URL(path, endpoint);
  const canonicalQuery = Object.entries(query).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => encode(k)+'='+encode(v)).join('&');
  url.search = canonicalQuery;
  const access = process.env[admin ? 'RUSTFS_ACCESS_KEY' : 'S3_ACCESS_KEY'];
  const secret = process.env[admin ? 'RUSTFS_SECRET_KEY' : 'S3_SECRET_ACCESS_KEY'];
  assert.ok(access && secret, 'Missing storage credentials');
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = timestamp.slice(0,8), scope = day+'/us-east-1/s3/aws4_request';
  const headers = {'host':url.host, 'x-amz-content-sha256':hash(body), 'x-amz-date':timestamp};
  const names = Object.keys(headers).sort();
  const canonical = [method, url.pathname, canonicalQuery, names.map(k=>k+':'+headers[k]+'\n').join(''), names.join(';'), hash(body)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4'+secret,day),'us-east-1'),'s3'),'aws4_request');
  headers.Authorization = 'AWS4-HMAC-SHA256 Credential='+access+'/'+scope+', SignedHeaders='+names.join(';')+', Signature='+crypto.createHmac('sha256',key).update('AWS4-HMAC-SHA256\n'+timestamp+'\n'+scope+'\n'+hash(canonical)).digest('hex');
  return fetch(url, {method, headers, body:['GET','HEAD'].includes(method)?undefined:body});
}
async function expect(response, statuses) {
  if(!statuses.includes(response.status)) throw Error('Storage operation rejected: HTTP '+response.status+' '+(await response.text()).slice(0,700));
  return response;
}
async function bootstrap() {
  let head = await request('HEAD', '/'+bucket);
  if(head.status===404) await expect(await request('PUT', '/'+bucket), [200]);
  else await expect(head,[200]);
  // Existing credentials are checked, never rotated during restart.
  let user = await request('GET','/rustfs/admin/v3/user-info','',true,{accessKey:process.env.S3_ACCESS_KEY});
  if(user.status===404) {
    await expect(await request('PUT','/rustfs/admin/v3/add-user',JSON.stringify({secretKey:process.env.S3_SECRET_ACCESS_KEY,status:'enabled'}),true,{accessKey:process.env.S3_ACCESS_KEY}),[200]);
  } else await expect(user,[200]);
  const policy = fs.readFileSync('/policy.json','utf8');
  await expect(await request('PUT','/rustfs/admin/v3/add-canned-policy',policy,true,{name:'zvonok-application'}),[200]);
  await expect(await request('PUT','/rustfs/admin/v3/set-user-or-group-policy','',true,{policyName:'zvonok-application',userOrGroup:process.env.S3_ACCESS_KEY,isGroup:'false'}),[200]);
  const origin = process.env.APP_URL;
  assert.equal(new URL(origin).origin,origin);
  const xml = '<CORSConfiguration><CORSRule><AllowedOrigin>'+origin+'</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>Range</AllowedHeader><AllowedHeader>Content-Type</AllowedHeader><ExposeHeader>Content-Range</ExposeHeader><ExposeHeader>Content-Length</ExposeHeader><ExposeHeader>Accept-Ranges</ExposeHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>600</MaxAgeSeconds></CORSRule></CORSConfiguration>';
  await expect(await request('PUT','/'+bucket,xml,true,{cors:''}),[200,204]);
  // A public bucket policy is an error, never silently overwritten.
  const publicPolicy = await request('GET','/'+bucket,'',true,{policy:''});
  await expect(publicPolicy,[404]);
  await expect(await request('GET','/'+bucket,'',false,{ 'list-type':'2', 'max-keys':'1' }),[200]);
  await expect(await request('GET','/rustfs/admin/v3/list-users','',false),[403]);
  await expect(await request('PUT','/forbidden-'+crypto.randomUUID(),'',false),[403]);
  assert.equal((await fetch(endpoint+'/'+bucket)).status,403);
  console.log('PASS private bucket, scoped application identity, admin/cross-bucket denial');
}
if(require.main===module) bootstrap().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={request,hash,expect};
