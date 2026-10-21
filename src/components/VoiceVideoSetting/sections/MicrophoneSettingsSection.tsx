import type { RefObject } from "react";
import { deviceActions, selectMediaDevice } from "../../../store/slices/device.slice";
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
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
	meterRef: RefObject<HTMLDivElement | null>;
	activityRef: RefObject<HTMLDivElement | null>;
	isListening: boolean;
	testDisabled?: boolean;
	audioPreviewRef: RefObject<HTMLAudioElement | null>;
	onListeningToggle: () => void;
}

export function MicrophoneSettingsSection({
	dispatch,
	selectedMicrophoneId,
	microphones,
	micQualitySetting,
	isNoiseSuppressionEnabled,
	isEchoCancellationEnabled,
	meterRef,
	activityRef,
	isListening,
	testDisabled,
	audioPreviewRef,
	onListeningToggle,
}: MicrophoneSettingsSectionProps) {
	const {deviceSwitchPending, isAutoGainControlEnabled} = useSelector((s: RootState) => s.device);
	return (
		<div className={styles['media-grid']}>
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Устройство ввода</h3>
					<p className={styles["section-subtitle"]}>
						Выберите микрофон для передачи голоса.
					</p>
				</div>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Устройство</label>

				<select
					title={microphones.find(device=>device.deviceId===selectedMicrophoneId)?.label || 'Системный микрофон'}
					aria-label="Микрофон"
					className={styles["input"]}
					value={selectedMicrophoneId}
					disabled={deviceSwitchPending}
					onChange={(e) => void dispatch(selectMediaDevice({kind: 'audioinput', id: e.target.value}))}
				>
					<option value="default">Системный микрофон</option>
					{selectedMicrophoneId !== 'default' && !microphones.some(d => d.deviceId === selectedMicrophoneId) && <option value={selectedMicrophoneId}>Выбранный микрофон (недоступен или нет разрешения)</option>}
					{microphones.map((microphone, index) => (
						<option key={microphone.deviceId} value={microphone.deviceId}>
							{getDeviceLabel(microphone, index, "Microphone")}
						</option>
					))}
				</select>
				<p role="status">{deviceSwitchPending ? 'Переключаем устройство…' : testDisabled ? 'Выбор применяется к текущему звонку после подтверждения устройства.' : 'Предпочтение для следующего захвата. Проверка запускается отдельно.'}</p>
			</div>
		</section>
		<section className={styles['settings-card']}>
			<h3 className={styles['section-title']}>Основные параметры</h3>
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
				<label className={styles['toggle-row']}><input aria-label="Автоматическая регулировка усиления (AGC)" type="checkbox" checked={isAutoGainControlEnabled} onChange={e => dispatch(deviceActions.setAutoGainControl(e.target.checked))}/>Автоматическая регулировка усиления (AGC)</label>
					<label className={styles["toggle-row"]}>
						<input
							type="checkbox"
							aria-label="Браузерное шумоподавление"
							checked={isNoiseSuppressionEnabled}
							onChange={(e) =>
								dispatch(deviceActions.setNoiseSuppression(e.target.checked))
							}
						/>
						<span>Браузерное шумоподавление</span>
					</label>

					<span className={styles["help-text"]}>
						Если RNNoise включён, browser NS отключается при захвате.
					</span>
					<label className={styles["toggle-row"]}>
						<input
							type="checkbox"
							aria-label="Эхоподавление"
							checked={isEchoCancellationEnabled}
							onChange={(e) =>
								dispatch(deviceActions.setEchoCancellation(e.target.checked))
							}
						/>
						<span>Эхоподавление</span>
					</label>
			</div>

		</section>
		<section className={`${styles['settings-card']} ${styles['preview-panel']}`}>
			<h3 className={styles['section-title']}>Проверка микрофона</h3>
			<p className={styles['help-text']}>Говорите в микрофон. Используйте наушники, чтобы избежать обратной связи.</p>
			<div className={styles["form-group"]}>

				<div ref={meterRef} className={styles["volume-bar-bg"]} role="meter" aria-label="Уровень микрофона" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
					<div
						className={styles["volume-bar-fill"]}
						style={{ width: '0%' }}
					/>
				</div>

				<button
					disabled={testDisabled}
					className={isListening ? styles["btn-secondary"] : styles["btn-primary"]}
					onClick={onListeningToggle}
				>
					{isListening ? "Закончить прослушивание" : "Послушать себя"}
				</button>

				<div ref={activityRef} className={styles["help-text"]}>
					Активность голоса: ниже порога
				</div>

				<audio ref={audioPreviewRef} style={{ display: "none" }} />
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
