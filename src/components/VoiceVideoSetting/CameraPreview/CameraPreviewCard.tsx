import styles from "../VoiceVideoSetting.module.css";
import { CameraPreviewState } from "./CameraPreviewState";
import type { CameraPreviewStatus } from "./useCameraPreview";
import type { RefObject } from "react";

interface CameraPreviewCardProps {
	status: CameraPreviewStatus;
	error: string | null;
	selectedCameraLabel: string;
	videoRef: RefObject<HTMLVideoElement | null>;
}

export function CameraPreviewCard({
	status,
	error,
	selectedCameraLabel,
	videoRef,
}: CameraPreviewCardProps) {
	return (
		<div className={styles["camera-preview-card"]}>
			<div className={styles["camera-preview-media"]}>
				{status === "ready" ? (
					<video
						ref={videoRef}
						className={styles["camera-preview-video"]}
						autoPlay
						playsInline
						muted
					/>
				) : (
					<CameraPreviewState status={status} />
				)}
			</div>
			<div className={styles["camera-preview-caption"]}>{selectedCameraLabel}</div>
			<div className={styles["help-text"]}>
				Preview is local only and is not sent to the call.
			</div>
			{error && <div className={styles["error-text"]}>{error}</div>}
		</div>
	);
}
