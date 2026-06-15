import { deviceActions } from "../../../store/slices/device.slice";
import type { AppDispatch } from "../../../store/store";
import {
	MICROPHONE_QUALITY_PRESETS,
	type MicQualitySetting,
} from "../../../utils/microphoneQuality";
import { MicrophoneQualitySelector } from "../MicrophoneQualitySelector/MicrophoneQualitySelector";
import styles from "../VoiceVideoSetting.module.css";

interface MicrophoneSettingsSectionProps {
	dispatch: AppDispatch;
	selectedMicrophoneId: string;
	microphones: MediaDeviceInfo[];
	micQualitySetting: MicQualitySetting;
	isNoiseSuppressionEnabled: boolean;
	isEchoCancellationEnabled: boolean;
	effectiveRnnoiseEnabled: boolean;
	volumeLevel: number;
	isListening: boolean;
	isAutoInputSensitivity: boolean;
	voiceActivityThreshold: number;
	audioPreviewRef: React.RefObject<HTMLAudioElement | null>;
	onListeningToggle: () => void;
}

export function MicrophoneSettingsSection({
	dispatch,
	selectedMicrophoneId,
	microphones,
	micQualitySetting,
	isNoiseSuppressionEnabled,
	isEchoCancellationEnabled,
	effectiveRnnoiseEnabled,
	volumeLevel,
	isListening,
	isAutoInputSensitivity,
	voiceActivityThreshold,
	audioPreviewRef,
	onListeningToggle,
}: MicrophoneSettingsSectionProps) {
	return (
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Микрофон</h3>
					<p className={styles["section-subtitle"]}>
						Устройство, качество звонка, шумоподавление и проверка микрофона.
					</p>
				</div>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Устройство</label>

				<select
					className={styles["input"]}
					value={selectedMicrophoneId}
					onChange={(e) => dispatch(deviceActions.setMicrophone(e.target.value))}
				>
					<option value="default">Default</option>
					{microphones.map((microphone, index) => (
						<option key={microphone.deviceId} value={microphone.deviceId}>
							{getDeviceLabel(microphone, index, "Microphone")}
						</option>
					))}
				</select>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Качество микрофона в звонке</label>

				<MicrophoneQualitySelector
					value={micQualitySetting}
					onChange={(value) =>
						dispatch(deviceActions.setMicrophoneQuality(value))
					}
				/>

				<span className={styles["help-text"]}>
					Bitrate применяется только в звонке при публикации микрофона.
					В проверке микрофона слышны только захват, шумоподавление и Web Audio обработка.
				</span>

				{MICROPHONE_QUALITY_PRESETS[micQualitySetting].warning && (
					<span className={styles["help-text"]}>
						{MICROPHONE_QUALITY_PRESETS[micQualitySetting].warning}
					</span>
				)}
			</div>

			<div className={styles["inline-grid"]}>
				<div className={styles["form-group"]}>
					<label className={styles["label"]}>Браузерное шумоподавление</label>

					<label className={styles["toggle-row"]}>
						<input
							type="checkbox"
							checked={isNoiseSuppressionEnabled}
							onChange={(e) =>
								dispatch(deviceActions.setNoiseSuppression(e.target.checked))
							}
						/>
						<span>
							{isNoiseSuppressionEnabled || !effectiveRnnoiseEnabled
								? "Включено"
								: "Выключено"}
						</span>
					</label>

					<span className={styles["help-text"]}>
						Если RNNoise включён, browser NS отключается при захвате.
					</span>
				</div>

				<div className={styles["form-group"]}>
					<label className={styles["label"]}>Эхоподавление</label>

					<label className={styles["toggle-row"]}>
						<input
							type="checkbox"
							checked={isEchoCancellationEnabled}
							onChange={(e) =>
								dispatch(deviceActions.setEchoCancellation(e.target.checked))
							}
						/>
						<span>{isEchoCancellationEnabled ? "Включено" : "Выключено"}</span>
					</label>
				</div>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Проверка микрофона</label>

				<div className={styles["volume-bar-bg"]}>
					<div
						className={styles["volume-bar-fill"]}
						style={{ width: `${volumeLevel}%` }}
					/>
				</div>

				<button
					className={isListening ? styles["btn-secondary"] : styles["btn-primary"]}
					onClick={onListeningToggle}
				>
					{isListening ? "Закончить прослушивание" : "Послушать себя"}
				</button>

				<div className={styles["help-text"]}>
					Voice activity:{" "}
					{volumeLevel >= (isAutoInputSensitivity ? 30 : voiceActivityThreshold)
						? "Detected"
						: "Below threshold"}
				</div>

				<audio ref={audioPreviewRef} style={{ display: "none" }} />
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
