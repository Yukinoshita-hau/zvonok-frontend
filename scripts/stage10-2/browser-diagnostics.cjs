// Installed before navigation; observes real APIs and never fabricates media or RTP.
module.exports=function install(){
 const events=[];let sequence=0;
 const sink=window.__mediaDiag={events,session:undefined,log(event,detail={}){const row={sequence:++sequence,monotonicMs:performance.now(),event,...(this.session||{}),...detail};this.events.push(row);}};
 sink.clockAnchor={wallMs:Date.now(),monotonicMs:performance.now()};
 const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);const path=new URL(args[0]).pathname;for(const event of ['open','close','error'])this.addEventListener(event,()=>sink.log('transport.'+event,{path}));}};
 const worklets=[];const Worklet=window.AudioWorkletNode;
 if(Worklet)window.AudioWorkletNode=class extends Worklet{constructor(...args){super(...args);const entry={name:args[1],destroyRequested:false,context:args[0]};worklets.push(entry);sink.log('worklet.created',{name:entry.name});const post=this.port.postMessage.bind(this.port);this.port.postMessage=(data,...rest)=>{if(data==='destroy'){entry.destroyRequested=true;sink.log('worklet.destroyRequested',{name:entry.name});}return post(data,...rest);};}};
 const media=t=>({id:t.id,kind:t.kind,enabled:t.enabled,muted:t.muted,readyState:t.readyState});
 const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async(...args)=>{sink.log('capture.request');try{const stream=await gum(...args);sink.log('capture.resolved',{tracks:stream.getTracks().map(media)});for(const track of stream.getTracks()){for(const event of ['ended','mute','unmute'])track.addEventListener(event,()=>sink.log('capture.'+event,{track:media(track)}));const stop=track.stop.bind(track);track.stop=()=>{sink.log('capture.stop.request',{track:media(track)});stop();sink.log('capture.stop.completed',{track:media(track)});};}if(window.__captureDelayMs){sink.log('capture.controlledDelay',{ms:window.__captureDelayMs});await new Promise(r=>setTimeout(r,window.__captureDelayMs));}return stream;}catch(error){sink.log('capture.rejected',{error:error.name});throw error;}};
 const Original=window.RTCPeerConnection;
 window.RTCPeerConnection=class extends Original{constructor(...args){super(...args);sink.log('pc.created');for(const event of ['connectionstatechange','iceconnectionstatechange','track'])this.addEventListener(event,()=>sink.log('pc.'+event,{connection:this.connectionState,ice:this.iceConnectionState}));}};
 const play=HTMLMediaElement.prototype.play;
 HTMLMediaElement.prototype.play=function(...args){sink.log('playback.request',{kind:this.tagName});const promise=play.apply(this,args);promise?.then(()=>sink.log('playback.resolved',{kind:this.tagName}),error=>sink.log('playback.rejected',{error:error.name}));return promise;};
 const AudioContext=window.AudioContext;
 window.AudioContext=class extends AudioContext{constructor(...args){super(...args);sink.log('audioContext.created',{state:this.state});this.addEventListener('statechange',()=>sink.log('audioContext.state',{state:this.state}));}};
 sink.collect=async label=>{
  const peers=[];
  for(const pc of window.__pcs||[]){const stats=[...(await pc.getStats()).values()],byId=new Map(stats.map(v=>[v.id,v]));
   const rtp=stats.filter(v=>['outbound-rtp','inbound-rtp','remote-inbound-rtp'].includes(v.type)).map(v=>({type:v.type,id:v.id,kind:v.kind,ssrc:v.ssrc,trackIdentifier:v.trackIdentifier,bytesSent:v.bytesSent,bytesReceived:v.bytesReceived,packetsSent:v.packetsSent,packetsReceived:v.packetsReceived,packetsLost:v.packetsLost,jitter:v.jitter,totalAudioEnergy:v.totalAudioEnergy,audioLevel:v.audioLevel,codec:byId.get(v.codecId)?.mimeType}));
   peers.push({connection:pc.connectionState,ice:pc.iceConnectionState,senders:pc.getSenders().map(s=>s.track?media(s.track):null),receivers:pc.getReceivers().map(r=>media(r.track)),rtp,pairs:stats.filter(v=>v.type==='candidate-pair'&&v.nominated&&v.state==='succeeded').map(v=>({rtt:v.currentRoundTripTime,localType:byId.get(v.localCandidateId)?.candidateType,remoteType:byId.get(v.remoteCandidateId)?.candidateType,protocol:byId.get(v.localCandidateId)?.protocol}))});
  }
  const snapshot={label,room:sink.snapshot?.(),peers,tracks:(window.__mediaTracks||[]).map(media),contexts:(window.__audioContexts||[]).map(a=>({state:a.state,sampleRate:a.sampleRate})),worklets:worklets.map(w=>({name:w.name,destroyRequested:w.destroyRequested,contextState:w.context.state})),playback:[...document.querySelectorAll('audio')].map(a=>({paused:a.paused,muted:a.muted,volume:a.volume,readyState:a.readyState,currentTime:a.currentTime,tracks:a.srcObject instanceof MediaStream?a.srcObject.getTracks().map(media):[]}))};
  sink.log('checkpoint',snapshot);return snapshot;
 };
 sink.log('browser.init');
};
