import {useEffect,useRef,useState} from 'react';
import type {RemoteAudioTrack} from 'livekit-client';

export function BrowserAudio({track,fresh}:{track?:RemoteAudioTrack;fresh:boolean}) {
  const element=useRef<HTMLAudioElement>(null),enabled=useRef(false);
  const [volume,setVolume]=useState(0.5),[muted,setMuted]=useState(true),[status,setStatus]=useState('Ожидание аудио');
  useEffect(()=>{
    const audio=element.current!;let stopped=false,sampling=false;
    if(!track || !fresh){audio.pause();audio.srcObject=null;setMuted(true);setStatus(track?'Ожидание видео':'Аудио недоступно');return;}
    track.attach(audio);track.setVolume(volume);
    const play=()=>void audio.play().then(()=>{if(!stopped){setMuted(false);setStatus('Воспроизведение');}}).catch(()=>{if(!stopped){setMuted(true);setStatus('Нажмите «Включить звук сайта»');}});
    if(enabled.current)play();else {audio.pause();setStatus('Звук сайта выключен');}
    const timer=setInterval(()=>{
      if(sampling)return;sampling=true;
      void track.getRTCStatsReport().then(report=>{
        if(stopped)return;
        report?.forEach(s=>{if(s.type==='inbound-rtp' && s.kind==='audio') {
          (window as unknown as {browserAudioMetrics:unknown}).browserAudioMetrics={at:performance.now(),packetsReceived:s.packetsReceived,bytesReceived:s.bytesReceived,totalSamplesReceived:s.totalSamplesReceived,totalAudioEnergy:s.totalAudioEnergy,totalSamplesDuration:s.totalSamplesDuration,concealedSamples:s.concealedSamples,jitter:s.jitter,jitterBufferDelay:s.jitterBufferDelay,jitterBufferEmittedCount:s.jitterBufferEmittedCount,paused:audio.paused,muted:audio.muted,volume:audio.volume,trackSid:track.sid};
        }});
      }).catch(()=>{}).finally(()=>{sampling=false;});
    },500);
    return ()=>{stopped=true;clearInterval(timer);audio.pause();track.detach(audio);audio.srcObject=null;(window as unknown as {browserAudioMetrics:unknown}).browserAudioMetrics=undefined;};
    // Volume is applied independently; changing it must not reattach playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[track,fresh]);
  useEffect(()=>{track?.setVolume(volume);},[track,volume]);
  function toggle() {
    const audio=element.current!;
    if(!audio.paused){enabled.current=false;audio.pause();setMuted(true);setStatus('Звук сайта выключен');return;}
    enabled.current=true;
    void audio.play().then(()=>{setMuted(false);setStatus('Воспроизведение');}).catch(()=>{setMuted(true);setStatus('Воспроизведение заблокировано. Нажмите «Включить звук сайта»');});
  }
  return <div className="browser-audio-controls">
    <audio ref={element} playsInline aria-label="Звук серверного браузера" onError={()=>setStatus('Ошибка воспроизведения аудио')} />
    <button disabled={!track || !fresh} onClick={toggle}>{muted?'Включить звук сайта':'Выключить звук сайта'}</button>
    <details><summary aria-label="Громкость сайта">Громкость {Math.round(volume*100)}%</summary><input aria-label="Громкость сайта" type="range" min="0" max="100" value={volume*100} onChange={e=>setVolume(Number(e.target.value)/100)}/></details>
    <small role="status">{status}</small>
  </div>;
}

