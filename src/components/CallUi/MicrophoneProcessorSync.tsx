import { useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { ZvonokLiveKitAudioProcessor } from "../../livekit/audio/ZvonokLiveKitAudioProcessor";

export function MicrophoneProcessorSync() {
	const room = useRoomContext();

	const processedTrackRef = useRef<LocalAudioTrack | null>(null);

	const syncingRef = useRef(false);

	const appliedProcessorKeyRef = useRef<string | null>(null);

	const isRnnoiseEnabled = useSelector(
		(s: RootState) => s.device.isRnnoiseEnabled
	);

	useEffect(() => {
		let disposed = false;

		async function syncProcessor() {
			if (syncingRef.current) return;


			const publication = room.localParticipant.getTrackPublication(
				Track.Source.Microphone
			);

			const track = publication?.track;

			if (!(track instanceof LocalAudioTrack)) {
				processedTrackRef.current = null;
				appliedProcessorKeyRef.current = null;
				return;
			}

			const processKey = `${track.sid ?? "local"}:${isRnnoiseEnabled}`;

			if (
				processedTrackRef.current === track &&
				appliedProcessorKeyRef.current === processKey
			) {
				return;
			}

			syncingRef.current = true;

			try {

				await track.setProcessor(new ZvonokLiveKitAudioProcessor({
					rnnoiseEnabled: isRnnoiseEnabled,
					inputVolume: 1,
					outputVolume: 1,
					stereoOutput: false
				}));

				if (disposed) {
					await track.stopProcessor();
					return;
				}

				processedTrackRef.current = track;
				appliedProcessorKeyRef.current = processKey;

			} catch (error) {
				console.log("[audio-processor] failed to apply processor", error);

				if (processedTrackRef.current = track) {
					processedTrackRef.current = null;
					appliedProcessorKeyRef.current = null;
				}
			} finally {
				syncingRef.current = false;
			}
		}

		void syncProcessor();

		const handleTrackPublished = () => {
			void syncProcessor();
		};

		const handleTrackUnmuted = () => {
			void syncProcessor();
		};

		room.localParticipant.on("localTrackPublished", handleTrackPublished);
		room.localParticipant.on("trackUnmuted", handleTrackUnmuted);

		return () => {
			disposed = true;

			const currentTrack = processedTrackRef.current;
			
			processedTrackRef.current = null;
			appliedProcessorKeyRef.current = null;

			if (currentTrack) {
				void currentTrack.stopProcessor().catch((error) => {
					console.log("[audio-processor] failed to stop processor", error);
				})
			}

			room.localParticipant.off("localTrackPublished", handleTrackPublished);
			room.localParticipant.off("trackUnmuted", handleTrackUnmuted);
		}
	}, [room, isRnnoiseEnabled]);

	return null;
}
