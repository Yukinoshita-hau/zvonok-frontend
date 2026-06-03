import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { AudioCaptureOptions } from "livekit-client";
import type { RootState } from "../../store/store";
import { getMicrophoneCaptureOptions } from "../../utils/microphoneQuality";

export function useMicrophoneCaptureOptions(): AudioCaptureOptions {
	const device = useSelector((s: RootState) => s.device);

	return useMemo(
		() =>
			getMicrophoneCaptureOptions({
				selectedMicrophoneId: device.selectedMicrophoneId,
				micQualitySetting: device.micQualitySetting,
				isAutoGainControlEnabled: device.isAutoGainControlEnabled,
				isEchoCancellationEnabled: device.isEchoCancellationEnabled,
				isNoiseSuppressionEnabled: device.isNoiseSuppressionEnabled,
				isRnnoiseEnabled: device.isRnnoiseEnabled,
			}),
		[
			device.selectedMicrophoneId,
			device.micQualitySetting,
			device.isNoiseSuppressionEnabled,
			device.isEchoCancellationEnabled,
			device.isAutoGainControlEnabled,
			device.isRnnoiseEnabled
		]
	);
}
