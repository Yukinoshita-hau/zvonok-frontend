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
	onOpenWhiteboard: () => void;
	onOpenCodeSession: () => void;
	onToggleScreenOverlay: () => void;
	onToggleFocus: () => void;
	onToggleCinema: () => void;
	onMinimize: () => void;
	onHide: () => void;
	onLeave: () => void;
	canUseWhiteboard?: boolean;
	isWhiteboardOpen?: boolean;
	isCodeSessionOpen?: boolean;
	canUseScreenOverlay?: boolean;
	isScreenOverlayOpen?: boolean;
}
