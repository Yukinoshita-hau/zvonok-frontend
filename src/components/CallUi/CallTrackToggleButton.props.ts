import type { LucideIcon } from "lucide-react";
import type {
	getCameraCaptureOptions,
	getCameraPublishOptions,
	getScreenShareCaptureOptions,
	getScreenSharePublishOptions,
} from "../../utils/callQuality";

export type CallTrackToggleKind = "camera" | "screenShare";

export interface CallTrackToggleButtonProps {
	kind: CallTrackToggleKind;
	enabledIcon: LucideIcon;
	disabledIcon: LucideIcon;
	label: string;
	enabledTitle: string;
	disabledTitle: string;
	captureOptions:
		| ReturnType<typeof getCameraCaptureOptions>
		| ReturnType<typeof getScreenShareCaptureOptions>;
	publishOptions:
		| ReturnType<typeof getCameraPublishOptions>
		| ReturnType<typeof getScreenSharePublishOptions>;
}
