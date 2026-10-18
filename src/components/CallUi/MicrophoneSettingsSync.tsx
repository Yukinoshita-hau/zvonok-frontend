import { useEffect, useMemo, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, Track, type LocalTrack } from "livekit-client";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { getMicrophonePublishOptions } from "../../utils/microphoneQuality";
import { useMicrophoneCaptureOptions } from "./useMicrophoneCaptureOptions";
import { mediaDiagnostic } from "./MediaDiagnostics";
import { useCallMicrophoneOwner } from "./CallMicrophoneProvider";

export function MicrophoneSettingsSync() {
	const room = useRoomContext();
	const microphoneOwner = useCallMicrophoneOwner();
	const captureOptions = useMicrophoneCaptureOptions();
	const quality = useSelector((s: RootState) => s.device.micQualitySetting);
	const publishOptions = useMemo(() => getMicrophonePublishOptions(quality), [quality]);
	type Options = { capture: typeof captureOptions; publish: typeof publishOptions; key: string };
	const requestRef = useRef<((options: Options) => void) | null>(null);
	const key = JSON.stringify({ captureOptions, publishOptions });

	useEffect(() => {
		mediaDiagnostic("react.microphoneSettings.mount");
		let disposed = false;
		let running = false;
		let pending: Options | null = null;
		let applied = "";
		const inFlightTracks = new Set<LocalAudioTrack>();
		const stoppedTracks = new WeakSet<LocalTrack>();
		const stopTrack = (track: LocalTrack) => {
			if (stoppedTracks.has(track)) return;
			stoppedTracks.add(track);
			track.stop();
		};
		async function drain() {
			if (running) return;
			running = true;
			try {
				while (pending && !disposed) {
					const next = pending;
					pending = null;
					if (next.key === applied) continue;
					if (!room.localParticipant.isMicrophoneEnabled) {
						applied = next.key;
						continue;
					}
					const old = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
					if (old instanceof LocalAudioTrack) {
						await old
							.stopProcessor()
							.catch((error) => console.warn("Microphone processor cleanup failed", error));
						if (disposed) return;
						await room.localParticipant.unpublishTrack(old, true);
					}
					if (disposed) return;
					const tracks = await room.localParticipant.createTracks({
						audio: next.capture,
						video: false,
					});
					if (disposed) {
						tracks.forEach(stopTrack);
						return;
					}
					const track = tracks.find(
						(item): item is LocalAudioTrack => item instanceof LocalAudioTrack,
					);
					if (!track) {
						tracks.forEach(stopTrack);
						throw new Error("Microphone track was not created");
					}
					inFlightTracks.add(track);
					try {
						await room.localParticipant.publishTrack(track, next.publish);
						inFlightTracks.delete(track);
					} catch (error) {
						tracks.forEach(stopTrack);
						inFlightTracks.delete(track);
						throw error;
					}
					if (disposed) {
						try {
							await room.localParticipant.unpublishTrack(track, true);
						} finally {
							stopTrack(track);
						}
						return;
					}
					applied = next.key;
				}
			} catch (error) {
				console.error("Failed to republish microphone", error);
			} finally {
				running = false;
				if (pending && !disposed) void drain();
			}
		}
		requestRef.current = (options) => {
			pending = options;
			void drain();
		};
		return () => {
			mediaDiagnostic("react.microphoneSettings.unmount");
			disposed = true;
			pending = null;
			requestRef.current = null;
			for (const track of inFlightTracks) stopTrack(track);
			inFlightTracks.clear();
		};
	}, [room]);

	useEffect(() => {
		microphoneOwner.updateOptions(captureOptions, publishOptions);
		requestRef.current?.({ capture: captureOptions, publish: publishOptions, key });
	}, [room, captureOptions, microphoneOwner, publishOptions, key]);
	return null;
}
