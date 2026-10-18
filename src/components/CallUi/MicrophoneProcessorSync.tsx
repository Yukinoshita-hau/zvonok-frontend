import { useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { ZvonokLiveKitAudioProcessor } from "../../livekit/audio/ZvonokLiveKitAudioProcessor";
import type { ZvonokAudioGraphConfig } from "../../livekit/audio/ZvonokAudioGraphConfig";
import { mediaDiagnostic } from "./MediaDiagnostics";

export function MicrophoneProcessorSync() {
	const room = useRoomContext();

	const processedTrackRef = useRef<LocalAudioTrack | null>(null);
	const processorRef = useRef<ZvonokLiveKitAudioProcessor | null>(null);

	const requestSyncRef = useRef<((config: ZvonokAudioGraphConfig) => void) | null>(null);

	const voiceProcessingConfig = useSelector((s: RootState) => s.device.voiceProcessingConfig);

	const configRef = useRef(voiceProcessingConfig);
	configRef.current = voiceProcessingConfig;
	useEffect(() => {
		mediaDiagnostic("react.processor.mount");
		let disposed = false;
		let syncing = false;
		let pendingConfig: ZvonokAudioGraphConfig | null = null;

		async function syncProcessor(nextConfig: ZvonokAudioGraphConfig) {
			pendingConfig = nextConfig;

			if (syncing) return;

			syncing = true;

			try {
				while (pendingConfig && !disposed) {
					const configToApply = pendingConfig;
					pendingConfig = null;

					const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);

					const track = publication?.track;

					if (!(track instanceof LocalAudioTrack)) {
						const previous = processedTrackRef.current;
						processedTrackRef.current = null;
						processorRef.current = null;
						await previous?.stopProcessor();
						return;
					}

					if (processedTrackRef.current === track && processorRef.current) {
						await processorRef.current.updateConfig(configToApply);
						continue;
					}

					if (processedTrackRef.current && processedTrackRef.current !== track) {
						await processedTrackRef.current.stopProcessor().catch((error) => {
							console.log("[audio-processor] failed to stop old processor", error);
						});
					}

					if (disposed) return;
					const processor = new ZvonokLiveKitAudioProcessor(configToApply);

					try {
						mediaDiagnostic("processor.setup.request");
						await track.setProcessor(processor);
						mediaDiagnostic("processor.setup.resolved", { processedTrack: processor.processedTrack ? { enabled: processor.processedTrack.enabled, readyState: processor.processedTrack.readyState, muted: processor.processedTrack.muted } : null });
					} catch (error) {
						await processor.destroy();
						throw error;
					}

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
				syncing = false;

				if (pendingConfig && !disposed) void syncProcessor(pendingConfig);
			}
		}

		const nextConfig: ZvonokAudioGraphConfig = {
			...configRef.current,
			stereoOutput: false,
		};

		requestSyncRef.current = (config) => {
			void syncProcessor({ ...config, stereoOutput: false });
		};
		void syncProcessor(nextConfig);

		const handleTrackPublished = () => {
			void syncProcessor({
				...configRef.current,
				stereoOutput: false,
			});
		};

		const handleTrackUnmuted = () => {
			void syncProcessor({
				...configRef.current,
				stereoOutput: false,
			});
		};

		room.localParticipant.on("localTrackPublished", handleTrackPublished);
		room.localParticipant.on("trackUnmuted", handleTrackUnmuted);

		return () => {
			mediaDiagnostic("react.processor.unmount");
			disposed = true;
			pendingConfig = null;
			requestSyncRef.current = null;
			const track = processedTrackRef.current;
			processedTrackRef.current = null;
			processorRef.current = null;
			if (track)
				void track
					.stopProcessor()
					.catch((error) => console.warn("Processor cleanup failed", error));

			room.localParticipant.off("localTrackPublished", handleTrackPublished);
			room.localParticipant.off("trackUnmuted", handleTrackUnmuted);
		};
	}, [room]);

	useEffect(() => {
		requestSyncRef.current?.(voiceProcessingConfig);
	}, [voiceProcessingConfig]);

	return null;
}
