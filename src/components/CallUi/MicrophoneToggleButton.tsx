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
}

export function MicrophoneToggleButton({
	className,
	enabledLabel = "Mic",
	disabledLabel = "Muted",
	showIcon = false,
	titlePrefix = "Microphone",
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
		? `${titlePrefix}: on`
		: `${titlePrefix}: muted`;

	return (
		<button {...buttonProps} title={title} aria-label={title}>
			{showIcon && (enabled ? <Mic size={16} /> : <MicOff size={16} />)}
			<span>{enabled ? enabledLabel : disabledLabel}</span>
		</button>
	);
}
