import { useMaybeRoomContext, useTrackToggle } from "@livekit/components-react";
import { Track, type ScreenShareCaptureOptions } from "livekit-client";
import { useState, type MouseEvent } from "react";
import { ScreenSharePickerModal } from "../ScreenSharePicker/ScreenSharePickerModal";
import type { ScreenSharePickerResult } from "../ScreenSharePicker/ScreenSharePicker.types";
import {
	clearDesktopScreenShareSource,
	setDesktopScreenShareSource,
} from "../ScreenSharePicker/screenSharePickerService";
import {
	getScreenShareCaptureOptions,
	getScreenSharePublishOptions,
	getQualityPreset,
} from "../../utils/callQuality";
import styles from "./CallUi.module.css";
import type { CallTrackToggleButtonProps } from "./CallTrackToggleButton.props";

export function CallTrackToggleButton({
	kind,
	enabledIcon: EnabledIcon,
	disabledIcon: DisabledIcon,
	label,
	enabledTitle,
	disabledTitle,
	captureOptions,
	publishOptions,
}: CallTrackToggleButtonProps) {
	const source = kind === "camera" ? Track.Source.Camera : Track.Source.ScreenShare;
	const room = useMaybeRoomContext();
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [isStartingScreenShare, setIsStartingScreenShare] = useState(false);
	const { buttonProps, enabled } = useTrackToggle({
		source,
		className: styles["control-button"],
		captureOptions,
		publishOptions,
		type: "button",
	});
	const title = enabled ? enabledTitle : disabledTitle;
	const Icon = enabled ? EnabledIcon : DisabledIcon;

	const handleScreenShareClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (kind !== "screenShare" || enabled) {
			buttonProps.onClick?.(event);
			return;
		}

		event.preventDefault();
		setIsPickerOpen(true);
	};

	const handlePickerConfirm = async (result: ScreenSharePickerResult) => {
		setIsPickerOpen(false);

		if (!room) return;

		const preset = getQualityPreset("screenShare", result.quality.value);
		const nextCaptureOptions: ScreenShareCaptureOptions = {
			...getScreenShareCaptureOptions(preset),
			audio: result.includeSystemAudio,
			systemAudio: result.includeSystemAudio ? "include" : "exclude",
		};
		const nextPublishOptions = getScreenSharePublishOptions(preset);

		setIsStartingScreenShare(true);
		try {
			await setDesktopScreenShareSource(result.source.id, result.includeSystemAudio);
			await room.localParticipant.setScreenShareEnabled(true, nextCaptureOptions, nextPublishOptions);
		} catch {
			if (!result.includeSystemAudio) return;

			await clearDesktopScreenShareSource();
			await setDesktopScreenShareSource(result.source.id, false);
			try {
				await room.localParticipant.setScreenShareEnabled(true, {
					...nextCaptureOptions,
					audio: false,
					systemAudio: "exclude",
				}, nextPublishOptions);
			} catch {
				return;
			}
		} finally {
			setIsStartingScreenShare(false);
			await clearDesktopScreenShareSource();
		}
	};

	return (
		<>
			<button
				{...buttonProps}
				title={title}
				aria-label={title}
				data-active={enabled}
				disabled={buttonProps.disabled || isStartingScreenShare}
				onClick={handleScreenShareClick}
			>
				<Icon size={18} />
				<span className={styles["control-label-hidden"]}>{label}</span>
			</button>
			{kind === "screenShare" && (
				<ScreenSharePickerModal
					isOpen={isPickerOpen}
					onClose={() => setIsPickerOpen(false)}
					onConfirm={(result) => {
						void handlePickerConfirm(result);
					}}
				/>
			)}
		</>
	);
}
