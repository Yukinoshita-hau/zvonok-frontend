import { useState } from "react";
import { deviceActions } from "../../../store/slices/device.slice";
import type { AppDispatch } from "../../../store/store";
import type { ZvonokAudioGraphConfig } from "../../../livekit/audio/ZvonokAudioGraphConfig";
import styles from "../VoiceVideoSetting.module.css";

interface EqualizerSettingsSectionProps {
	dispatch: AppDispatch;
	voiceProcessingConfig: ZvonokAudioGraphConfig;
}

export function EqualizerSettingsSection({
	dispatch,
	voiceProcessingConfig,
}: EqualizerSettingsSectionProps) {
	const [open, setOpen] = useState(false);

	return (
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Эквалайзер и цепочка</h3>
					<p className={styles["section-subtitle"]}>
						Продвинутая настройка фильтров, компрессора и лимитера.
					</p>
				</div>

				<button
					type="button"
					className={styles["btn-secondary-neutral"]}
					onClick={() => setOpen((prev) => !prev)}
				>
					{open ? "Скрыть" : "Открыть"}
				</button>
			</div>

			{!open && (
				<div className={styles["summary-text"]}>
					High-pass {voiceProcessingConfig.highPass.enabled ? "on" : "off"} ·
					Presence {voiceProcessingConfig.presence.gain.toFixed(1)} dB ·
					Compressor ratio {voiceProcessingConfig.compressor.ratio} ·
					Limiter {voiceProcessingConfig.limiter.threshold} dB
				</div>
			)}

			{open && (
				<div className={styles["advanced-section"]}>
					<div className={styles["form-group"]}>
						<label className={styles["label"]}>High-pass filter</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.highPass.enabled}
								onChange={(e) =>
									dispatch(
										deviceActions.setVoiceHighPass({
											enabled: e.target.checked,
										})
									)
								}
							/>
							<span>
								{voiceProcessingConfig.highPass.enabled
									? "Включено"
									: "Выключено"}
							</span>
						</label>

						<label className={styles["help-text"]}>
							Частота: {voiceProcessingConfig.highPass.frequency} Hz
						</label>

						<input
							type="range"
							min={60}
							max={160}
							value={voiceProcessingConfig.highPass.frequency}
							disabled={!voiceProcessingConfig.highPass.enabled}
							onChange={(e) =>
								dispatch(
									deviceActions.setVoiceHighPass({
										frequency: Number(e.target.value),
									})
								)
							}
						/>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Presence boost</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.presence.enabled}
								onChange={(e) =>
									dispatch(
										deviceActions.setVoicePresence({
											enabled: e.target.checked,
										})
									)
								}
							/>
							<span>
								{voiceProcessingConfig.presence.enabled
									? "Включено"
									: "Выключено"}
							</span>
						</label>

						<label className={styles["help-text"]}>
							Усиление: {voiceProcessingConfig.presence.gain.toFixed(1)} dB
						</label>

						<input
							type="range"
							min={0}
							max={6}
							step={0.5}
							value={voiceProcessingConfig.presence.gain}
							disabled={!voiceProcessingConfig.presence.enabled}
							onChange={(e) =>
								dispatch(
									deviceActions.setVoicePresence({
										gain: Number(e.target.value),
									})
								)
							}
						/>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Compressor</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.compressor.enabled}
								onChange={(e) =>
									dispatch(
										deviceActions.setVoiceCompressor({
											enabled: e.target.checked,
										})
									)
								}
							/>
							<span>
								{voiceProcessingConfig.compressor.enabled
									? "Включено"
									: "Выключено"}
							</span>
						</label>

						<label className={styles["help-text"]}>
							Сила: ratio {voiceProcessingConfig.compressor.ratio}
						</label>

						<input
							type="range"
							min={2}
							max={12}
							step={1}
							value={voiceProcessingConfig.compressor.ratio}
							disabled={!voiceProcessingConfig.compressor.enabled}
							onChange={(e) =>
								dispatch(
									deviceActions.setVoiceCompressor({
										ratio: Number(e.target.value),
									})
								)
							}
						/>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Limiter</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.limiter.enabled}
								onChange={(e) =>
									dispatch(
										deviceActions.setVoiceLimiter({
											enabled: e.target.checked,
										})
									)
								}
							/>
							<span>
								{voiceProcessingConfig.limiter.enabled
									? "Включено"
									: "Выключено"}
							</span>
						</label>

						<label className={styles["help-text"]}>
							Порог: {voiceProcessingConfig.limiter.threshold} dB
						</label>

						<input
							type="range"
							min={-20}
							max={-2}
							step={1}
							value={voiceProcessingConfig.limiter.threshold}
							disabled={!voiceProcessingConfig.limiter.enabled}
							onChange={(e) =>
								dispatch(
									deviceActions.setVoiceLimiter({
										threshold: Number(e.target.value),
									})
								)
							}
						/>
					</div>
				</div>
			)}
		</section>
	);
}
