import { deviceActions } from "../../../store/slices/device.slice";
import type { AppDispatch } from "../../../store/store";
import type { CallQualitySetting } from "../../../utils/callQuality";
import CameraView from "../CameraPreview/CameraView";
import styles from "../VoiceVideoSetting.module.css";

interface CameraSettingsSectionProps {
	dispatch: AppDispatch;
	selectedCameraId: string;
	cameras: MediaDeviceInfo[];
	cameraQuality: CallQualitySetting;
	cameraTestEnable: boolean;
	onCameraTestToggle: () => void;
}

export function CameraSettingsSection({
	dispatch,
	selectedCameraId,
	cameras,
	cameraQuality,
	cameraTestEnable,
	onCameraTestToggle,
}: CameraSettingsSectionProps) {
	return (
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Видео</h3>
					<p className={styles["section-subtitle"]}>
						Камера, предпросмотр и качество видеопотока.
					</p>
				</div>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Камера</label>

				<select
					className={styles["input"]}
					value={selectedCameraId}
					onChange={(e) => dispatch(deviceActions.setCamera(e.target.value))}
				>
					<option value="default">Default</option>
					{cameras.map((camera, index) => (
						<option key={camera.deviceId} value={camera.deviceId}>
							{getDeviceLabel(camera, index, "Camera")}
						</option>
					))}
				</select>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Предпросмотр камеры</label>

				{cameraTestEnable && <CameraView />}

				<button
					className={
						cameraTestEnable ? styles["btn-secondary"] : styles["btn-primary"]
					}
					onClick={onCameraTestToggle}
				>
					{cameraTestEnable ? "Закончить проверку" : "Проверить камеру"}
				</button>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Качество камеры</label>

				<select
					className={styles["input"]}
					value={cameraQuality}
					onChange={(e) =>
						dispatch(
							deviceActions.setCameraQuality(e.target.value as CallQualitySetting)
						)
					}
				>
					<option value="auto">Auto</option>
					<option value="high">High (1080p, 30 FPS)</option>
					<option value="medium">Medium (720p, 24 FPS)</option>
					<option value="low">Low (360p, 15 FPS)</option>
				</select>
			</div>
		</section>
	);
}

function getDeviceLabel(
	device: MediaDeviceInfo,
	index: number,
	fallbackType: "Camera" | "Microphone"
) {
	const trimmed = device.label?.trim();
	if (trimmed) return trimmed;
	return `${fallbackType} ${index + 1}`;
}
