const assert=require('node:assert/strict');
exports.check=async peers=>{
 const reports=[];
 for(const peer of peers){
  const report=await peer.page.evaluate(()=>{
   const call=window.__callStore.getState().call,token=call.participantToken;
   const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
   const values=[...Object.values(localStorage),...Object.values(sessionStorage)];
   return {roomBound:payload.video.room===call.livekitRoomName,ttlRemaining:payload.exp-Math.floor(Date.now()/1000),roomAdmin:!!payload.video.roomAdmin,roomCreate:!!payload.video.roomCreate,canPublish:payload.video.canPublish,canSubscribe:payload.video.canSubscribe,canPublishData:payload.video.canPublishData,persistentToken:values.some(v=>/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(v)),sdkQueryTransport:window.__sockets.some(s=>new URL(s.url).searchParams.has('access_token'))};
  });
  assert.equal(report.roomBound,true);assert.ok(report.ttlRemaining>0&&report.ttlRemaining<=600);assert.equal(report.roomAdmin,false);assert.equal(report.roomCreate,false);assert.equal(report.canPublish,true);assert.equal(report.canSubscribe,true);assert.equal(report.canPublishData,false);assert.equal(report.persistentToken,false);assert.equal(report.sdkQueryTransport,true);reports.push(report);
 }
 return reports;
};
