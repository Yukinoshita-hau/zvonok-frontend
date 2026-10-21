import uiReducer from "../src/store/slices/ui.slice";
import { useThemeApplication } from "../src/helpers/useThemeApplication";
// Isolated fixture: actual CallUi/LiveKit surfaces, synthetic canvas media, no server connection.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import { configureStore, Tuple } from '@reduxjs/toolkit';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router-dom';
import { RoomContext } from '@livekit/components-react';
import { ConnectionState, RemoteParticipant, RemoteTrackPublication, RemoteVideoTrack, Room, RoomEvent, Track } from 'livekit-client';
import { TrackInfo, TrackSource, TrackType } from '@livekit/protocol';
import { SettingsContentSlot } from '../src/features/settingsV2/SettingsContentSlot';
import { ShellUserPanel } from '../src/components/ShellUserPanel/ShellUserPanel';
import { CallUi } from '../src/components/CallUi/CallUi';
import { MiniCallDock } from '../src/components/ActiveCallOverlay/MiniCallDock';
import { CallMicrophoneProvider } from '../src/components/CallUi/CallMicrophoneProvider';
import { store } from '../src/store/store';
import callReducer, { callActions } from '../src/store/slices/call.slice';
import overlay from '../src/components/ActiveCallOverlay/ActiveCallOverlay.module.css';
import '../src/index.css';
import '../src/styles/shell.css';

const params = new URLSearchParams(location.search);
const count = Number(params.get('count') || 4);
const mixed = params.has('mixed');
const initial = store.getState();
const fixtureStore = configureStore({
  reducer: (state = { ...initial, call: { ...initial.call, chatRoomId: 1, roomType: 'GROUP', status: 'in_call', callStartedAtMs: Date.now(), participantToken: params.has("b1") ? "fixture" : null, presentationInitialized: !params.has('stageB') } }, action) =>
    ({ ...state, ui: uiReducer(state.ui, action), call: action.type === "fixture/mediaState" ? {...state.call, mediaState: action.payload} : callReducer(state.call, action) }),
  // Fetch thunks are deliberately inert. Chat is only a presentation fixture.
  middleware: () => new Tuple(() => (next) => (action) => typeof action === 'function' ? Promise.resolve({}) : next(action)),
});
const room = new Room({ adaptiveStream: true, dynacast: true });
room.state = ConnectionState.Connected;
let connections = 0, publications = 0;
room.connect = async () => { connections++; throw Error('fixture must not connect'); };
room.localParticipant.publishTrack = async () => { publications++; throw Error('fixture must not publish'); };
const participants: RemoteParticipant[] = [];
const streams: MediaStream[] = [];
const shareCounts = new Map<number, number>();
let recovering: Map<string, RemoteParticipant> | undefined;
for (let i = 1; i < count; i++) {
  const participant = new RemoteParticipant(room.engine.client, `PA_${i}`, `person-${i}`, `Участник ${i}`);
  const ratio = mixed ? [16 / 9, 9 / 16, 1, 4 / 3, 3 / 4][(i - 1) % 5] : 16 / 9;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(360 * ratio); canvas.height = 360;
  const ctx = canvas.getContext('2d')!;
  const paint = () => {
    ctx.fillStyle = ['#34454c', '#51433e', '#3d495d', '#464055'][i % 4];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#8a949c'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.fillStyle = '#e1e5e8'; ctx.font = '20px sans-serif';
    ctx.fillText(`Fixture ${i}`, 18, 48); ctx.fillText(`${canvas.width}×360`, 18, 78);
  };
  paint(); setInterval(paint, params.has("fps30") ? 1000 / 30 : 200);
  const stream = canvas.captureStream(params.has("fps30") ? 30 : 5); streams.push(stream);
  const sid = `TR_${i}`;
  const publication = new RemoteTrackPublication(Track.Kind.Video, new TrackInfo({ sid, name: `Camera ${i}`, type: TrackType.VIDEO, source: TrackSource.CAMERA, muted: params.has("voice"), width: canvas.width, height: canvas.height }), true);
  publication.setTrack(new RemoteVideoTrack(stream.getVideoTracks()[0], sid, undefined as never));
  if (params.has("voice")) publication.track!.setMuted(true);
  participant.addTrackPublication(publication);
  const micSid = `MIC_${i}`;
  participant.addTrackPublication(new RemoteTrackPublication(Track.Kind.Audio,
    new TrackInfo({ sid: micSid, name: 'Fixture microphone state (no audio)', type: TrackType.AUDIO, source: TrackSource.MICROPHONE }), true));
  room.remoteParticipants.set(participant.identity, participant);
  participants.push(participant);
}
(window as any).stageFixture = {
  room, streams,
  counts: () => ({ connections, publications }),
  view: () => fixtureStore.getState().call,
  mediaState: (mediaState: string) => fixtureStore.dispatch({type: "fixture/mediaState", payload: mediaState}),
  stopShare: (index = 0) => { const p = participants[index]; const pub = [...p.videoTrackPublications.values()].find(t=>t.source === Track.Source.ScreenShare); if (pub) { p.trackPublications.delete(pub.trackSid); p.videoTrackPublications.delete(pub.trackSid); room.emit(RoomEvent.TrackUnpublished,pub,p); } },
  speak: () => { participants[0].isSpeaking = !participants[0].isSpeaking; room.emit(RoomEvent.ActiveSpeakersChanged, participants); },
  speech: (indices: number[]) => {
    participants.forEach((p, i) => { p.isSpeaking = indices.includes(i); p.audioLevel = p.isSpeaking ? 0.7 : 0; });
    room.emit(RoomEvent.ActiveSpeakersChanged, participants.filter(p => p.isSpeaking));
  },
  microphone: (index: number, enabled: boolean) => {
    const p = participants[index], pub = p.getTrackPublication(Track.Source.Microphone)!;
    pub.updateInfo(new TrackInfo({ ...pub.trackInfo, muted: !enabled }));
    room.emit(enabled ? RoomEvent.TrackUnmuted : RoomEvent.TrackMuted, pub, p);
  },
  screenAudio: (index: number, enabled: boolean) => {
    const p = participants[index], sid = `SCREEN_AUDIO_${index}`;
    if (enabled) {
      const pub = new RemoteTrackPublication(Track.Kind.Audio, new TrackInfo({ sid, name: 'Synthetic screen audio state (no audio)', type: TrackType.AUDIO, source: TrackSource.SCREEN_SHARE_AUDIO }), true);
      p.addTrackPublication(pub); room.emit(RoomEvent.TrackPublished, pub, p);
    } else {
      const pub = p.trackPublications.get(sid);
      if (pub) { p.trackPublications.delete(sid); p.audioTrackPublications.delete(sid); room.emit(RoomEvent.TrackUnpublished, pub, p); }
    }
  },
  depart: (index: number) => { const p = participants[index]; room.remoteParticipants.delete(p.identity); room.emit(RoomEvent.ParticipantDisconnected, p); },
  arrive: (index: number) => { const p = participants[index]; room.remoteParticipants.set(p.identity, p); room.emit(RoomEvent.ParticipantConnected, p); },
  resetCall: () => fixtureStore.dispatch(callActions.prepareJoinedCall({ callId: 2, chatRoomId: 1, roomType: 'GROUP', livekitRoomName: 'fixture-next', callerUsername: 'fixture', hostUsername: 'fixture' })),
  camera: (enabled: boolean) => {
    const pub = participants[0].videoTrackPublications.values().next().value!;
    pub.updateInfo(new TrackInfo({ ...pub.trackInfo, muted: !enabled }));
    room.emit(enabled ? RoomEvent.TrackUnmuted : RoomEvent.TrackMuted, pub, participants[0]);
  },
  replaceTrack: () => {
    const participant = participants[0];
    const pub = participant.videoTrackPublications.values().next().value!;
    pub.setTrack(new RemoteVideoTrack(streams[0].getVideoTracks()[0].clone(), pub.trackSid, undefined as never));
    room.emit(RoomEvent.TrackSubscribed, pub.track!, pub, participant);
  },
  removeCamera: (index = 0) => {
    const participant = participants[index];
    const pub = [...participant.videoTrackPublications.values()].find(t => t.source === Track.Source.Camera)!;
    participant.trackPublications.delete(pub.trackSid); participant.videoTrackPublications.delete(pub.trackSid);
    room.emit(RoomEvent.TrackUnpublished, pub, participant);
  },
  muteShare: (muted: boolean) => {
    const participant = participants[0];
    const pub = [...participant.videoTrackPublications.values()].find(t => t.source === Track.Source.ScreenShare)!;
    pub.updateInfo(new TrackInfo({ ...pub.trackInfo, muted }));
    room.emit(muted ? RoomEvent.TrackMuted : RoomEvent.TrackUnmuted, pub, participant);
  },
  replaceScreen: () => {
    const participant = participants[0];
    const pub = [...participant.videoTrackPublications.values()].find(t => t.source === Track.Source.ScreenShare)!;
    pub.setTrack(new RemoteVideoTrack(pub.track!.mediaStreamTrack.clone(), pub.trackSid, undefined as never));
    room.emit(RoomEvent.TrackSubscribed, pub.track!, pub, participant);
  },
  share: (index = 0, ratio = 16 / 9) => {
    const participant = participants[index];
    const sequence = (shareCounts.get(index) ?? 0) + 1; shareCounts.set(index, sequence);
    const baseSid = index === 0 ? 'TR_SCREEN' : `TR_SCREEN_${index}`;
    const sid = sequence === 1 ? baseSid : `${baseSid}_NEW_${sequence}`;
    const canvas = document.createElement('canvas'); canvas.width = Math.round(1080 * ratio); canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    const paint = () => {
      ctx.fillStyle = '#18232b'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#a6c9db'; ctx.font = '28px monospace';
      ctx.fillText(`SYNTHETIC SCREEN ${index + 1}   ${canvas.width} × ${canvas.height}`, 32, 54);
      const lines = ['// Zvonok · component fixture', 'const participants = room.remoteParticipants;', 'function renderContent(source) {', '  return <VideoTrack trackRef={source.trackRef} />;', '}', '// Fit preserves the entire source. Zoom reads native pixels.'];
      lines.forEach((line,i) => ctx.fillText(`${i+1}  ${line}`,32,130+i*48));
      ctx.strokeStyle = '#69a7a4'; ctx.lineWidth = 8; ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);
      ctx.fillStyle='#8dbb98'; ctx.fillRect(canvas.width-48,canvas.height-48,24,24);
    };
    paint(); setInterval(paint,200);
    const stream = canvas.captureStream(5); streams.push(stream);
    const pub = new RemoteTrackPublication(Track.Kind.Video, new TrackInfo({ sid, name: 'Screen fixture', type: TrackType.VIDEO, source: TrackSource.SCREEN_SHARE, width: canvas.width, height: canvas.height }), true);
    pub.setTrack(new RemoteVideoTrack(stream.getVideoTracks()[0], sid, undefined as never));
    participant.addTrackPublication(pub);
    room.emit(RoomEvent.TrackPublished, pub, participant);
    room.emit(RoomEvent.TrackSubscribed, pub.track!, pub, participant);
  },
  leave: () => { const p = participants.pop(); if (p) { room.remoteParticipants.delete(p.identity); room.emit(RoomEvent.ParticipantDisconnected, p); } },
  reconnect: (recover: boolean) => {
    room.state = recover ? ConnectionState.Connected : ConnectionState.Reconnecting;
    room.emit(RoomEvent.ConnectionStateChanged, room.state);
    if (!recover) {
      recovering = new Map(room.remoteParticipants);
      room.remoteParticipants.clear();
      for (const p of recovering.values()) room.emit(RoomEvent.ParticipantDisconnected, p);
    } else if (recovering) {
      for (const [id, p] of recovering) { room.remoteParticipants.set(id, p); room.emit(RoomEvent.ParticipantConnected, p); }
      recovering = undefined;
    }
  },
};
function Preview() {
  useThemeApplication();
  (window as any).stageFixture.dispatch = fixtureStore.dispatch;
  (window as any).stageFixture.ui = () => fixtureStore.getState().ui;
  const call = useSelector((s: any) => s.call);
  const navigate = useNavigate();
  (window as any).stageFixture.navigate = () => navigate('/dm?roomId=2');
  const mini = call.presentationMode !== "expanded";
  const setMini = (value: boolean) => fixtureStore.dispatch(callActions.setPresentationMode(value ? "minimized" : "expanded"));
  return <>
    <SettingsContentSlot overlay>{null}</SettingsContentSlot>
    {params.has('b1') && <><ShellUserPanel /><textarea data-fixture-composer aria-label="Сообщение fixture" placeholder="Написать сообщение" style={{position:'fixed',bottom:16,left:'calc(var(--rail-width) + var(--sidebar-width) + 16px)',width:'calc(100% - var(--rail-width) - var(--sidebar-width) - 32px)',height:54,background:'var(--bg-input)',border:0,borderRadius:8,padding:12,color:'var(--text-primary)'}} /></>}
    <div style={{ position: 'fixed', top: 8, left: 8, width: 190, color: 'var(--text-secondary)', fontSize: 12 }}>
      Call UI · component fixture<br/>Synthetic canvas, no LiveKit server<br/>
      <button onClick={() => setMini(!mini)}>Mini fixture</button>
      {params.has('stageD') && <div data-speech-fixture aria-label="Synthetic speech timeline fixture">
        <p>Stage D · SYNTHETIC speech</p>
        <button onClick={() => (window as any).stageFixture.speech([])}>Silence</button>
        {participants.map((p, i) => <button key={p.identity} onClick={() => (window as any).stageFixture.speech([i])}>Speak {i + 1}</button>)}
        <button onClick={() => (window as any).stageFixture.speech([0, 1])}>Overlap</button>
      </div>}
    </div>
    <div data-call-stage hidden={mini} inert={mini} className={[overlay['call-shell'], call.isCallFocusMode ? overlay['call-shell-focus'] : '', call.isTheaterMode ? overlay['call-shell-cinema'] : ''].join(' ')}>
      <div className={overlay['room-container']}>
        <CallUi visible={!mini} hasChat isFocusMode={call.isCallFocusMode} isCinemaMode={call.isTheaterMode}
          onHide={() => setMini(true)} onMinimize={() => setMini(true)}
          onToggleCinema={() => fixtureStore.dispatch(callActions.setTheaterMode(!call.isTheaterMode))} />
      </div>
    </div>
    {<MiniCallDock visible={mini} hasChat onOpenChat={() => setMini(false)} onExpand={() => setMini(false)} onEnd={() => {}} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<Provider store={fixtureStore}><RouterProvider router={createMemoryRouter([{path:"*",element:<RoomContext.Provider value={room}><CallMicrophoneProvider callId="fixture" generation={0}><Preview /></CallMicrophoneProvider></RoomContext.Provider>}],{initialEntries:[params.has("b1") ? "/dm?roomId=1" : "/"]})}/></Provider>);
