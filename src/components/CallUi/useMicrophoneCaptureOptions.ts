import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { AudioCaptureOptions } from "livekit-client";
import type { RootState } from "../../store/store";

export function useMicrophoneCaptureOptions(): AudioCaptureOptions {
	const device = useSelector((s: RootState) => s.device);

	return useMemo(
		() => ({
			deviceId:
				device.selectedMicrophoneId !== "default"
					? device.selectedMicrophoneId
					: undefined,
			autoGainControl: true,
			echoCancellation: true,
			noiseSuppression: device.isNoiseSuppressionEnabled,
			voiceIsolation: device.isNoiseSuppressionEnabled,
			channelCount: 1,
			sampleRate: 48000,
			sampleSize: 16,
		}),
		[device.selectedMicrophoneId, device.isNoiseSuppressionEnabled]
	);
}
