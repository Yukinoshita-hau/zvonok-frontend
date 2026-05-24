import { useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { useEffect, useRef } from "react";
import { RnnoiseLiveKitProcessor } from "../../livekit/audio/RnnoiseLivekitProcessor";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";

export function MicrophoneProcessorSync() {
	const room = useRoomContext();

	const processedTrackRef = useRef<LocalAudioTrack | null>(null);
	const isRnnoiseEnabled = useSelector(
		(s: RootState) => s.device.isRnnoiseEnabled
	);

	useEffect(() => {
		let disposed = false;

		async function syncProcessor() {
			const publication = room.localParticipant.getTrackPublication(
				Track.Source.Microphone
			);

			const track = publication?.track;

			console.log("[rnnoise-debug] rnnoise enabled:", isRnnoiseEnabled);
			console.log("[rnnoise-debug] processor sync publication:", publication);
			console.log("[rnnoise-debug] processor sync track:", track);

			if (!(track instanceof LocalAudioTrack)) {
				console.log("[rnnoise-debug] no local microphone track yet");
				processedTrackRef.current = null;
				return;
			}

			if (!isRnnoiseEnabled) {
				if (processedTrackRef.current === track) {
					console.log("[rnnoise-debug] stopping rnnoise processor");
					await track.stopProcessor();
					processedTrackRef.current = null;
				}

				return;
			}

			if (processedTrackRef.current === track) {
				console.log("[rnnoise-debug] processor already appliend to current track");
				return;
			}

			try {
				console.log("[rnnoise-debug] applying processor from sync component");

				await track.setProcessor(new RnnoiseLiveKitProcessor());

				if (disposed) return;

				processedTrackRef.current = track;

				console.log("[rnnoise-debug] processor applied from sync component");
			} catch (error) {
				console.log("[rnnoise-debug] failed to apply processor", error);
			}
		}

		syncProcessor();

		const handleTrackPublished = () => {
			console.log("[rnnoise-debug] local track published event");
			syncProcessor();
		};

		const handleTrackUnmuted = () => {
			console.log("[rnnoise-debug] local track unmuted event");
			syncProcessor();
		};

		room.localParticipant.on("localTrackPublished", handleTrackPublished);
		room.localParticipant.off("trackUnmuted", handleTrackUnmuted);

		return () => {
			disposed = true;

			room.localParticipant.off("localTrackPublished", handleTrackPublished);
			room.localParticipant.off("trackUnmuted", handleTrackUnmuted);
		}
	}, [room, isRnnoiseEnabled]);

	return null;
}
