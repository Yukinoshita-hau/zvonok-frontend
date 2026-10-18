const {execFileSync,spawnSync}=require('node:child_process'),fs=require('node:fs');
const since=process.argv[2];if(!since)throw Error('Supply UTC ISO start time');
const label=execFileSync('docker',['inspect','--format','{{index .Config.Labels "zvonok.acceptance"}}','zvonok-stage10-1-livekit'],{encoding:'utf8'}).trim();if(label!=='stage10-1')throw Error('Unexpected SFU');
const output=spawnSync('docker',['logs','--since',since,'zvonok-stage10-1-livekit'],{encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});if(output.status!==0)throw Error('SFU log collection failed');const raw=output.stdout+'\n'+output.stderr;
const aliases=new Map(),events=[];
for(const line of raw.split('\n')){
 if(!/rtp stats|published track|publishing track|peer connection state change|ice connection state change|participant closing/.test(line))continue;
 const offset=line.indexOf('{');if(offset<0)continue;let value;try{value=JSON.parse(line.slice(offset));}catch{continue;}
 if(!aliases.has(value.participant))aliases.set(value.participant,'p'+(aliases.size+1));
 const room=/-call-(\d+)$/.exec(value.room||'');if(!room)continue;
 const stats=value.stats||{};
 events.push({utc:line.split('\t')[0],event:line.slice(0,offset).split('\t').at(-1)?.trim(),callId:Number(room[1]),participant:aliases.get(value.participant),track:value.trackID,direction:value.direction,state:value.state,mime:value.mime,stats:{startTime:stats.startTime,endTime:stats.endTime,packetsSeenPrimary:stats.packetsSeenPrimary,bytes:stats.bytes,packetsLost:stats.packetsLost,rtt:stats.rtt,jitter:stats.jitter}});
}
fs.writeFileSync('stage10-2-evidence/sfu-'+Date.now()+'.json',JSON.stringify(events,null,2));console.log('Sanitized SFU events',events.length);
