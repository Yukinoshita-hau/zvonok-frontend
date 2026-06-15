import { useEffect, useMemo, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { getMicrophonePublishOptions } from "../../utils/microphoneQuality";
import { useMicrophoneCaptureOptions } from "./useMicrophoneCaptureOptions";

export function MicrophoneSettingsSync() {
	const room = useRoomContext();

	const captureOptions = useMicrophoneCaptureOptions();

	const micQualitySetting = useSelector(
		(s: RootState) => s.device.micQualitySetting
	);

	const publishOptions = useMemo(
		() => getMicrophonePublishOptions(micQualitySetting),
		[micQualitySetting]
	);

	const lastAppliedRef = useRef<string>("");
	const republishingRef = useRef(false);
	const pendingSerializedRef = useRef<string | null>(null);

	const serializedOptions = useMemo(
		() =>
			JSON.stringify({
				captureOptions,
				publishOptions,
			}),
		[captureOptions, publishOptions]
	);

	useEffect(() => {
		if (!room.localParticipant.isMicrophoneEnabled) {
			lastAppliedRef.current = serializedOptions;
			return;
		}

		if (lastAppliedRef.current === serializedOptions) return;

		pendingSerializedRef.current = serializedOptions;

		if (republishingRef.current) return;

		republishingRef.current = true;

		void (async () => {
			try {
				while (pendingSerializedRef.current) {
					const nextSerialized = pendingSerializedRef.current;
					pendingSerializedRef.current = null;

					lastAppliedRef.current = nextSerialized;

					console.log("[mic-quality] republish start", {
						micQualitySetting,
						captureOptions,
						publishOptions,
					});

					const publication = room.localParticipant.getTrackPublication(
						Track.Source.Microphone
					);

					const oldTrack = publication?.track;

					if (oldTrack instanceof LocalAudioTrack) {
						await oldTrack.stopProcessor().catch((error) => {
							console.log("[mic-quality] failed to stop old processor", error);
						});

						await room.localParticipant.unpublishTrack(oldTrack, true);
					}

					const tracks = await room.localParticipant.createTracks({
						audio: captureOptions,
						video: false,
					});

					const newAudioTrack = tracks.find(
						(track): track is LocalAudioTrack => track instanceof LocalAudioTrack
					);

					if (!newAudioTrack) {
						tracks.forEach((track) => track.stop());
						throw new Error("New microphone track was not created");
					}

					await room.localParticipant.publishTrack(
						newAudioTrack,
						publishOptions
					);

					console.log("[mic-quality] republish done", {
						micQualitySetting,
						trackSid: newAudioTrack.sid,
						publishOptions,
					});
				}
			} catch (error) {
				console.error("[mic-quality] failed to republish microphone", error);
			} finally {
				republishingRef.current = false;
			}
		})();
	}, [
		captureOptions,
		publishOptions,
		room,
		serializedOptions,
		micQualitySetting,
	]);

	return null;
}
