// Only the fixed loopback development SFU created by ops/stage10-start.ps1.
const crypto=require('node:crypto'),fs=require('node:fs');
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({iss:'devkey',sub:'stage10-audit',nbf:Math.floor(Date.now()/1000)-1,exp:Math.floor(Date.now()/1000)+60,video:{roomList:true}});
const token=data+'.'+crypto.createHmac('sha256','secret').update(data).digest('base64url');
(async()=>{const r=await fetch('http://127.0.0.1:17880/twirp/livekit.RoomService/ListRooms',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('SFU audit status '+r.status);const body=await r.json();const audit={observedAt:new Date().toISOString(),rooms:(body.rooms||[]).map(r=>({name:r.name,numParticipants:r.numParticipants||0}))};fs.writeFileSync('stage10-evidence/sfu-final.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit));})().catch(e=>{console.error(e.message);process.exitCode=1;});
