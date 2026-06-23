import { useTrackToggle } from "@livekit/components-react";
import { Mic, MicOff } from "lucide-react";
import { Track } from "livekit-client";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import {
	getMicrophonePublishOptions,
} from "../../utils/microphoneQuality";
import { useMicrophoneCaptureOptions } from "./useMicrophoneCaptureOptions";

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

	const micQualitySetting = useSelector(
		(s: RootState) => s.device.micQualitySetting
	);

	const publishOptions = getMicrophonePublishOptions(micQualitySetting);

	const { buttonProps, enabled } = useTrackToggle({
		source: Track.Source.Microphone,
		className,
		captureOptions,
		type: "button",
		publishOptions,
	});

	const title = enabled
		? `${titlePrefix}: включён`
		: `${titlePrefix}: выключен`;

	return (
		<button {...buttonProps} title={title} aria-label={title} data-active={enabled}>
			{showIcon && (enabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />)}
			{(enabled ? enabledLabel : disabledLabel) && (
				<span className={labelClassName}>{enabled ? enabledLabel : disabledLabel}</span>
			)}
		</button>
	);
}
