import { useConnectionState, useTrackToggle } from "@livekit/components-react";
import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { ConnectionState, Track } from "livekit-client";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import {
	getMicrophonePublishOptions,
} from "../../utils/microphoneQuality";
import { useMicrophoneCaptureOptions } from "./useMicrophoneCaptureOptions";
import { useCallMicrophoneOwner } from "./CallMicrophoneProvider";

interface MicrophoneToggleButtonProps {
	className: string;
	enabledLabel?: string;
	disabledLabel?: string;
	showIcon?: boolean;
	titlePrefix?: string;
	labelClassName?: string;
	iconSize?: number;
}

export function MicrophoneToggleButton({
	className,
	enabledLabel = "Микрофон",
	disabledLabel = "Без звука",
	showIcon = false,
	titlePrefix = "Микрофон",
	labelClassName,
	iconSize = 16,
}: MicrophoneToggleButtonProps) {
	const captureOptions = useMicrophoneCaptureOptions();
	const connectionState = useConnectionState();
	const microphoneOwner = useCallMicrophoneOwner();
	const [pending, setPending] = useState(false);

	const micQualitySetting = useSelector(
		(s: RootState) => s.device.micQualitySetting
	);

	const publishOptions = getMicrophonePublishOptions(micQualitySetting);

	const { enabled } = useTrackToggle({
		source: Track.Source.Microphone,
		className,
		captureOptions,
		type: "button",
		publishOptions,
	});

	const title = enabled
		? `${titlePrefix}: включён`
		: `${titlePrefix}: выключен`;
	const handleClick = () => {
		const nextEnabled = !enabled;
		if (nextEnabled && connectionState !== ConnectionState.Connected) return;
		setPending(true);
		void microphoneOwner
			.setEnabled(nextEnabled, captureOptions, publishOptions)
			.catch((error) => console.error("Failed to toggle microphone", error))
			.finally(() => setPending(false));
	};

	return (
		<button type="button" className={className} disabled={pending || (!enabled && connectionState !== ConnectionState.Connected)} onClick={handleClick} aria-pressed={enabled} data-lk-source={Track.Source.Microphone} data-lk-enabled={enabled} title={title} aria-label={title} data-active={enabled}>
			{showIcon && (enabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />)}
			{(enabled ? enabledLabel : disabledLabel) && (
				<span className={labelClassName}>{enabled ? enabledLabel : disabledLabel}</span>
			)}
		</button>
	);
}
