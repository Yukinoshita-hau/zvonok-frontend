import type {
	getCameraCaptureOptions,
	getCameraPublishOptions,
	getScreenShareCaptureOptions,
	getScreenSharePublishOptions,
} from "../../utils/callQuality";

export interface CallControlsProps {
	hasChat: boolean;
	isFocusMode: boolean;
	isCinemaMode: boolean;
	canOpenCinema: boolean;
	cameraCaptureOptions: ReturnType<typeof getCameraCaptureOptions>;
	cameraPublishOptions: ReturnType<typeof getCameraPublishOptions>;
	screenShareCaptureOptions: ReturnType<typeof getScreenShareCaptureOptions>;
	screenSharePublishOptions: ReturnType<typeof getScreenSharePublishOptions>;
	onOpenChat: () => void;
	onToggleFocus: () => void;
	onToggleCinema: () => void;
	onMinimize: () => void;
	onHide: () => void;
	onLeave: () => void;
}
