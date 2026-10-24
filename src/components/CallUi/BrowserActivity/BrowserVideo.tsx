import { useEffect, useId, useRef, useState } from 'react';
import { Room, RoomEvent, Track, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { BrowserAudio } from './BrowserAudio';
import type { InputAction, BrowserMedia } from './browserActivity';
import { pageCoordinates, mediaState } from './browserActivity';
import './BrowserVideo.css';


type Command = (action: InputAction) => void;
export function BrowserVideo({ id, targetFps, connectMedia, input, canControl }: { id: string; targetFps: number; connectMedia: () => Promise<BrowserMedia>; input: Command; canControl: boolean }) {
	const video = useRef<HTMLVideoElement>(null);
	const exit = useRef<HTMLButtonElement>(null), keyboardHint = useId();
	const [state, setState] = useState('Подключение…'), [fresh, setFresh] = useState(false), [attempt, setAttempt] = useState(0);
	const lastMove = useRef(0);
	const [audioTrack, setAudioTrack] = useState<RemoteAudioTrack>();
	useEffect(() => {
		let stopped = false, room: Room | undefined, track: RemoteVideoTrack | undefined, retry: ReturnType<typeof setTimeout> | undefined;
		let retries = 0, lastFrame = 0, callback = 0, connecting = false, health = 'Подключено', publisher = '', roomConnectAttempts = 0, rtcReconnectEvents = 0;
		const element = video.current!;
		const detach = () => { setAudioTrack(undefined); track?.detach(); track = undefined; element.srcObject = null; setFresh(false); lastFrame = 0; (window as unknown as { browserActivityMetrics: unknown }).browserActivityMetrics = undefined; };
		const observed = () => { lastFrame = performance.now(); if (!stopped) callback = element.requestVideoFrameCallback(observed); };
		callback = element.requestVideoFrameCallback(observed);
		function schedule() {
			if (stopped || retry) return;
			detach();
			if (retries++ >= 4) { setState('Видео недоступно. Повторите подключение.'); return; }
			setState('Восстанавливаем видео…'); retry = setTimeout(() => { retry = undefined; void connect(); }, 2000);
		}
		async function connect() {
			if (stopped || connecting) return;
			connecting = true;
			roomConnectAttempts++;
			const previous = room; room = undefined; previous?.removeAllListeners(); await previous?.disconnect();
			if (stopped) { connecting = false; return; }
			const next = new Room(); room = next;
			next.on(RoomEvent.TrackSubscribed, (t, _publication, participant) => {
				if (!stopped && next === room && participant.identity === publisher && t instanceof RemoteAudioTrack && _publication.source === Track.Source.ScreenShareAudio) { setAudioTrack(t); return; }
				if (stopped || next !== room || participant.identity !== publisher || !(t instanceof RemoteVideoTrack) || t.kind !== Track.Kind.Video) return;
				track = t; t.attach(element); void element.play().catch(() => { }); setState('Подключено · ожидание кадров');
				for (const publication of participant.audioTrackPublications.values()) if (publication.source === Track.Source.ScreenShareAudio && publication.track instanceof RemoteAudioTrack) setAudioTrack(publication.track);
			});
			next.on(RoomEvent.TrackUnsubscribed, (t) => { if (!stopped && next === room) { if (t instanceof RemoteAudioTrack) { setAudioTrack(undefined); return; } detach(); setState('Ждём восстановления трансляции…'); } });
			next.on(RoomEvent.Reconnecting, () => { if (!stopped && next === room) { rtcReconnectEvents++; detach(); setState('Восстанавливаем видео…'); } });
			next.on(RoomEvent.Reconnected, () => {
				if (stopped) return;
				for (const p of next.remoteParticipants.values()) if (p.identity === publisher) for (const publication of p.audioTrackPublications.values()) if (publication.source === Track.Source.ScreenShareAudio && publication.track instanceof RemoteAudioTrack) setAudioTrack(publication.track);
				for (const p of next.remoteParticipants.values()) for (const publication of p.videoTrackPublications.values()) {
					if (p.identity !== publisher) continue;
					if (publication.track instanceof RemoteVideoTrack) { track = publication.track; track.attach(element); void element.play().catch(() => { }); }
				}
			});
			next.on(RoomEvent.Disconnected, () => { if (!stopped && next === room) schedule(); });
			try {
				const auth = await connectMedia();

				if (stopped) return;
				publisher = auth.publisher;
				await next.connect(auth.url, auth.token);
				if (stopped) await next.disconnect();
			} catch { if (!stopped) schedule(); } finally { connecting = false; }
		}
		(window as unknown as { browserActivityMetrics: unknown }).browserActivityMetrics = undefined;
		void connect();
		function nextPublications() { return [...(room?.remoteParticipants.values() ?? [])].flatMap(p => [...p.videoTrackPublications.values()]); }
		let sampling = false;
		const timer = setInterval(() => {
			const isFresh = !!lastFrame && performance.now() - lastFrame < 2000;
			setFresh(isFresh); if (isFresh) setState(health); else if (lastFrame) setState('Восстанавливаем видео · кадры не поступают');
			if (!track || sampling) return;
			sampling = true; const current = track;
			void current.getRTCStatsReport().then(report => {
				if (stopped || current !== track) return;
				report?.forEach(s => {
					if (s.type === 'inbound-rtp' && s.kind === 'video') {
						health = mediaState(s.frameWidth, s.frameHeight, s.framesPerSecond, targetFps); if (isFresh) setState(health);
						(window as unknown as { browserActivityMetrics: unknown }).browserActivityMetrics = { at: performance.now(), trackSid: current.sid, roomConnectAttempts, rtcReconnectEvents, framesReceived: s.framesReceived, framesDecoded: s.framesDecoded, framesDropped: s.framesDropped, width: s.frameWidth, height: s.frameHeight, fps: s.framesPerSecond, bytesReceived: s.bytesReceived, publications: [...nextPublications()].length, fresh: isFresh };
					}
				});
			}).catch(() => { }).finally(() => { sampling = false; });
		}, 500);
		return () => { stopped = true; clearTimeout(retry); clearInterval(timer); element.cancelVideoFrameCallback(callback); track?.detach(); element.srcObject = null; room?.removeAllListeners(); void room?.disconnect(); };
	}, [id, connectMedia, attempt]);
	const coords = (e: { clientX: number; clientY: number }) => pageCoordinates(video.current!.getBoundingClientRect(), e.clientX, e.clientY, video.current?.videoWidth || 1280, video.current?.videoHeight || 720);
	return <div className="browser-video-view">
		<BrowserAudio track={audioTrack} fresh={fresh} />
		{canControl && <small className="browser-keyboard-hint" id={keyboardHint}>Esc — вернуться к панели; Tab — следующее поле сайта.</small>}
		<div className="live-surface" tabIndex={canControl ? 0 : -1} role="application" aria-describedby={canControl ? keyboardHint : undefined} aria-label="Серверная страница: мышь, клавиатура и прокрутка"
			onClick={e => { const p = coords(e); if (!canControl || !p || !fresh) return; e.currentTarget.focus(); input({ type: 'mouseClick', ...p, button: 'left' }); }}
			onAuxClick={e => { if (!canControl) return; if (e.button !== 1) return; e.preventDefault(); const p = coords(e); if (canControl && p && fresh) { e.currentTarget.focus(); input({ type: 'mouseClick', ...p, button: 'middle' }); } }}
			onContextMenu={e => { if (!canControl) return; e.preventDefault(); const p = coords(e); if (canControl && p && fresh) { e.currentTarget.focus(); input({ type: 'mouseClick', ...p, button: 'right' }); } }}
			onMouseMove={e => { const p = coords(e); if (canControl && p && fresh && Date.now() - lastMove.current > 100) { lastMove.current = Date.now(); input({ type: 'mouseMove', ...p }); } }}
			onWheel={e => { const p = coords(e); if (!canControl || !p || !fresh) return; e.preventDefault(); const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (video.current?.videoHeight || 720) : 1; input({ type: 'wheel', ...p, deltaX: Math.max(-2000, Math.min(2000, e.deltaX * unit)), deltaY: Math.max(-2000, Math.min(2000, e.deltaY * unit)) }); }}
			onPaste={e => { if (!canControl) return; e.preventDefault(); const text = e.clipboardData.getData('text').slice(0, 1000); if (canControl && text && fresh) input({ type: 'text', text }); }}
			onKeyDown={e => {
				if (!canControl || !fresh) return;
				e.stopPropagation();
				if (e.key === 'Escape') { e.preventDefault(); exit.current?.focus(); return; }
				let key = e.key;
				if (e.ctrlKey && key.toLowerCase() === 'a') key = 'Control+A';
				else if (key === 'Tab' && e.shiftKey) key = 'Shift+Tab';
				if (['Enter', 'Tab', 'Shift+Tab', 'Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Control+A'].includes(key)) {
					e.preventDefault(); input({ type: 'keyPress', key: key as Extract<InputAction, { type: 'keyPress' }>['key'] });
				} else if (key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); input({ type: 'text', text: key }); }
			}}>
			<video ref={video} autoPlay muted playsInline className={`live-video ${fresh ? '' : 'stale'}`} aria-label="Общая страница браузера" />
			<div className="browser-media-status" data-degraded={state.startsWith('Качество снижено') || undefined}><span role="status" data-testid="media-state">Видео: {state}</span><button ref={exit} aria-label="Переподключить видео" title="Переподключить видео" onClick={() => setAttempt(a => a + 1)}>↻</button></div>
			{!fresh && <div className="media-cover">{state}</div>}
		</div>
	</div>;
}


