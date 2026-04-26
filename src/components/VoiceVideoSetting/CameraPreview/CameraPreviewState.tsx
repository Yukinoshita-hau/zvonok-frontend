import styles from "../VoiceVideoSetting.module.css";
import type { CameraPreviewStatus } from "./useCameraPreview";

interface CameraPreviewStateProps {
	status: CameraPreviewStatus;
}

export function CameraPreviewState({ status }: CameraPreviewStateProps) {
	return (
		<div className={styles["camera-preview-state"]}>
			{status === "loading" && "Loading camera preview..."}
			{status === "denied" && "Camera permission denied."}
			{status === "not_found" && "Selected camera is unavailable."}
			{status === "error" && "Could not start camera preview."}
			{status === "no_device" && "No camera devices found."}
			{status === "idle" && "Preparing camera preview..."}
		</div>
	);
}
