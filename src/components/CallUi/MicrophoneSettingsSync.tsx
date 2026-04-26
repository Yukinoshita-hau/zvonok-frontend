import { useEffect, useMemo, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useMicrophoneCaptureOptions } from "./useMicrophoneCaptureOptions";

export function MicrophoneSettingsSync() {
	const room = useRoomContext();
	const captureOptions = useMicrophoneCaptureOptions();
	const lastAppliedRef = useRef<string>("");

	const serializedOptions = useMemo(
		() => JSON.stringify(captureOptions),
		[captureOptions]
	);

	useEffect(() => {
		if (!room.localParticipant.isMicrophoneEnabled) {
			lastAppliedRef.current = serializedOptions;
			return;
		}

		if (lastAppliedRef.current === serializedOptions) return;
		lastAppliedRef.current = serializedOptions;

		void room.localParticipant
			.setMicrophoneEnabled(true, captureOptions)
			.catch((error) => {
				console.error("Failed to re-apply microphone capture settings", error);
			});
	}, [captureOptions, room, serializedOptions]);

	return null;
}
