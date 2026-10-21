import { deviceActions, selectMediaDevice } from "../../../store/slices/device.slice";
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
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
	testDisabled?: boolean;
	onCameraTestToggle: () => void;
}

export function CameraSettingsSection({
	dispatch,
	selectedCameraId,
	cameras,
	cameraQuality,
	cameraTestEnable,
	testDisabled,
	onCameraTestToggle,
}: CameraSettingsSectionProps) {
	const pending = useSelector((s: RootState) => s.device.deviceSwitchPending);
	return (
		<div className={styles['media-grid']}>
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Источник видео</h3>
					<p className={styles["section-subtitle"]}>
						Камера, предпросмотр и качество видеопотока.
					</p>
				</div>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Камера</label>

				<select
					title={cameras.find(device=>device.deviceId===selectedCameraId)?.label || 'Системная камера'}
					aria-label="Камера"
					className={styles["input"]}
					value={selectedCameraId}
					disabled={pending}
					onChange={(e) => void dispatch(selectMediaDevice({kind: 'videoinput', id: e.target.value}))}
				>
					<option value="default">Системная камера</option>
					{selectedCameraId !== 'default' && !cameras.some(d => d.deviceId === selectedCameraId) && <option value={selectedCameraId}>Выбранная камера (недоступна или нет разрешения)</option>}
					{cameras.map((camera, index) => (
						<option key={camera.deviceId} value={camera.deviceId}>
							{getDeviceLabel(camera, index, "Camera")}
						</option>
					))}
				</select>
			</div>

		</section>
		<section className={`${styles['settings-card']} ${styles['preview-panel']}`}>
			<h3 className={styles['section-title']}>Предпросмотр камеры</h3>
			<div className={styles["form-group"]}>

				{cameraTestEnable && <CameraView />}
				{!cameraTestEnable && <div className={styles['preview-idle']}>Камера выключена. Начните проверку, чтобы увидеть изображение.</div>}

				<button
					disabled={testDisabled}
					className={
						cameraTestEnable ? styles["btn-secondary"] : styles["btn-primary"]
					}
					onClick={onCameraTestToggle}
				>
					{cameraTestEnable ? "Закончить проверку" : "Проверить камеру"}
				</button>
			</div>
		</section>
		<section className={styles['settings-card']}>
			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Качество камеры</label>
				<p>Применяется при следующем включении камеры. Auto использует рекомендацию проверки соединения; непрерывная адаптация не подключена.</p>

				<select
					aria-label="Качество камеры"
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
		</div>
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
