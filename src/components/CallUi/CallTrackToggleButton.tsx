import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
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
	const { buttonProps, enabled } = useTrackToggle({
		source,
		className: styles["control-button"],
		captureOptions,
		publishOptions,
		type: "button",
	});
	const title = enabled ? enabledTitle : disabledTitle;
	const Icon = enabled ? EnabledIcon : DisabledIcon;

	return (
		<button {...buttonProps} title={title} aria-label={title} data-active={enabled}>
			<Icon size={18} />
			<span className={styles["control-label-hidden"]}>{label}</span>
		</button>
	);
}
