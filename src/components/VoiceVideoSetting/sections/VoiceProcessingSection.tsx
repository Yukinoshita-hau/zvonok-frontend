import { deviceActions } from "../../../store/slices/device.slice";
import type { AppDispatch } from "../../../store/store";
import type {
	ZvonokAudioGraphConfig,
	ZvonokVoicePresetId,
} from "../../../livekit/audio/ZvonokAudioGraphConfig";
import styles from "../VoiceVideoSetting.module.css";

interface VoiceProcessingSectionProps {
	dispatch: AppDispatch;
	voiceProcessingPreset: ZvonokVoicePresetId;
	voiceProcessingConfig: ZvonokAudioGraphConfig;
	inputVolumePercent: number;
	outputVolumePercent: number;
	onInputVolumePercentChange: (value: number) => void;
	onOutputVolumePercentChange: (value: number) => void;
}

export function VoiceProcessingSection({
	dispatch,
	voiceProcessingPreset,
	voiceProcessingConfig,
	inputVolumePercent,
	outputVolumePercent,
	onInputVolumePercentChange,
	onOutputVolumePercentChange,
}: VoiceProcessingSectionProps) {
	return (
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Голос</h3>
					<p className={styles["section-subtitle"]}>
						Базовая обработка голоса: пресет, громкость и RNNoise.
					</p>
				</div>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Пресет голоса</label>

				<select
					className={styles["input"]}
					value={voiceProcessingPreset}
					onChange={(e) =>
						dispatch(
							deviceActions.setVoiceProcessingPreset(
								e.target.value as "default" | "clearVoice" | "softVoice"
							)
						)
					}
				>
					<option value="default">Default</option>
					<option value="clearVoice">Clear Voice</option>
					<option value="softVoice">Soft Voice</option>
				</select>

				<span className={styles["help-text"]}>
					Пресет меняет Web Audio обработку: громкость, RNNoise, фильтры,
					компрессор и лимитер.
				</span>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>
					Громкость микрофона: {inputVolumePercent}%
				</label>

				<input
					type="range"
					min={0}
					max={300}
					value={inputVolumePercent}
					onChange={(e) => onInputVolumePercentChange(Number(e.target.value))}
				/>

				<span className={styles["help-text"]}>
					Усиление до обработки. 100% = без изменения.
				</span>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>
					Итоговая громкость: {outputVolumePercent}%
				</label>

				<input
					type="range"
					min={0}
					max={200}
					value={outputVolumePercent}
					onChange={(e) => onOutputVolumePercentChange(Number(e.target.value))}
				/>

				<span className={styles["help-text"]}>
					Громкость после всех фильтров.
				</span>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>RNNoise</label>

				<label className={styles["toggle-row"]}>
					<input
						type="checkbox"
						checked={voiceProcessingConfig.rnnoise.enabled}
						onChange={(e) =>
							dispatch(deviceActions.setVoiceRnnoiseEnabled(e.target.checked))
						}
					/>
					<span>
						{voiceProcessingConfig.rnnoise.enabled ? "Включено" : "Выключено"}
					</span>
				</label>

				<span className={styles["help-text"]}>
					Нейросетевое шумоподавление перед эквалайзером и компрессором.
				</span>
			</div>
		</section>
	);
}
