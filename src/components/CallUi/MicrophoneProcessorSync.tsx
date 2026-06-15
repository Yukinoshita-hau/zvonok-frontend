import { useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { ZvonokLiveKitAudioProcessor } from "../../livekit/audio/ZvonokLiveKitAudioProcessor";
import type { ZvonokAudioGraphConfig } from "../../livekit/audio/ZvonokAudioGraphConfig";

export function MicrophoneProcessorSync() {
	const room = useRoomContext();

	const processedTrackRef = useRef<LocalAudioTrack | null>(null);
	const processorRef = useRef<ZvonokLiveKitAudioProcessor | null>(null);

	const syncingRef = useRef(false);
	const pendingConfigRef = useRef<ZvonokAudioGraphConfig | null>(null);

	const appliedProcessorKeyRef = useRef<string | null>(null);

	const voiceProcessingConfig = useSelector(
		(s: RootState) => s.device.voiceProcessingConfig
	);

	useEffect(() => {
		let disposed = false;

		async function syncProcessor(nextConfig: ZvonokAudioGraphConfig) {
			pendingConfigRef.current = nextConfig;

			if (syncingRef.current) return;

			syncingRef.current = true;

			try {
				while (pendingConfigRef.current && !disposed) {

					const configToApply = pendingConfigRef.current;
					pendingConfigRef.current = null;

					const publication = room.localParticipant.getTrackPublication(
						Track.Source.Microphone
					);

					const track = publication?.track;

					if (!(track instanceof LocalAudioTrack)) {
						processedTrackRef.current = null;
						appliedProcessorKeyRef.current = null;
						return;
					}


					if (processedTrackRef.current === track && processorRef.current) {
						await processorRef.current.updateConfig(configToApply);
						return;
					}

					if (processedTrackRef.current && processedTrackRef.current !== track) {
						await processedTrackRef.current.stopProcessor().catch((error) => {
							console.log("[audio-processor] failed to stop old processor", error);
						});
					}

					const processor = new ZvonokLiveKitAudioProcessor(configToApply);

					await track.setProcessor(processor);

					if (disposed) {
						await track.stopProcessor();
						return;
					}

					processedTrackRef.current = track;
					processorRef.current = processor;

				}
			} catch (error) {
				console.log("[audio-processor] failed to apply processor", error);
			} finally {
				syncingRef.current = false;

				if (pendingConfigRef.current && !disposed) {
					const pendingConfig = pendingConfigRef.current;
					pendingConfigRef.current = null;
					void syncProcessor(pendingConfig);
				}
			}
		}

		const nextConfig: ZvonokAudioGraphConfig = {
			...voiceProcessingConfig,
			stereoOutput: false,
		}

		void syncProcessor(nextConfig);

		const handleTrackPublished = () => {
			void syncProcessor({
				...voiceProcessingConfig,
				stereoOutput: false
			});
		};

		const handleTrackUnmuted = () => {
			void syncProcessor({
				...voiceProcessingConfig,
				stereoOutput: false
			});
		};

		room.localParticipant.on("localTrackPublished", handleTrackPublished);
		room.localParticipant.on("trackUnmuted", handleTrackUnmuted);

		return () => {
			disposed = true;

			room.localParticipant.off("localTrackPublished", handleTrackPublished);
			room.localParticipant.off("trackUnmuted", handleTrackUnmuted);
		}
	}, [room, voiceProcessingConfig]);

	useEffect(() => {
		return () => {
			const currentTrack = processedTrackRef.current;

			processedTrackRef.current = null;
			processorRef.current = null;
			pendingConfigRef.current = null;

			if (currentTrack) {
				void currentTrack.stopProcessor().catch((error) => {
					console.log("[audio-processor] failed tot stop processor", error)
				});
			}
		}
	}, []);

	return null;
}
