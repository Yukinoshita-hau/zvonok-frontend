import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { deviceActions } from "../../../store/slices/device.slice";
import type { KeyboardShortcutPreference } from "../../../store/slices/device.slice";
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
	muteMicrophoneHotkey: KeyboardShortcutPreference;
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
	effectiveRnnoiseEnabled,
	volumeLevel,
	isListening,
	isAutoInputSensitivity,
	voiceActivityThreshold,
	muteMicrophoneHotkey,
	audioPreviewRef,
	onListeningToggle,
}: MicrophoneSettingsSectionProps) {
	const [isCapturingMuteHotkey, setIsCapturingMuteHotkey] = useState(false);
	const [hotkeyCaptureError, setHotkeyCaptureError] = useState<string | null>(null);
	const hotkeyInputRef = useRef<HTMLInputElement | null>(null);

	const startHotkeyCapture = () => {
		setIsCapturingMuteHotkey(true);
		setHotkeyCaptureError(null);
		window.setTimeout(() => hotkeyInputRef.current?.focus(), 0);
	};

	const onMuteHotkeyKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (!isCapturingMuteHotkey) return;
		event.preventDefault();
		event.stopPropagation();

		if (event.key === "Escape") {
			setIsCapturingMuteHotkey(false);
			setHotkeyCaptureError(null);
			return;
		}

		const nextHotkey = createShortcutPreference(event.nativeEvent);
		if (!nextHotkey) {
			setHotkeyCaptureError("Нажмите обычную клавишу или сочетание клавиш.");
			return;
		}

		dispatch(deviceActions.setMuteMicrophoneHotkey(nextHotkey));
		setIsCapturingMuteHotkey(false);
		setHotkeyCaptureError(null);
	};

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
				<label className={styles["label"]}>Горячии клавиши включения и выключения микрофона</label>

				<div className={styles["hotkey-row"]}>
					<input
						ref={hotkeyInputRef}
						className={styles["input"]}
						readOnly
						value={isCapturingMuteHotkey ? "Нажмите клавишу..." : muteMicrophoneHotkey.label}
						onClick={startHotkeyCapture}
						onKeyDown={onMuteHotkeyKeyDown}
					/>
					<button
						type="button"
						className={styles["btn-secondary-neutral"]}
						onClick={startHotkeyCapture}
					>
						Запись
					</button>
					<button
						type="button"
						className={styles["btn-secondary-neutral"]}
						onClick={() => {
							dispatch(deviceActions.resetMuteMicrophoneHotkey());
							setIsCapturingMuteHotkey(false);
							setHotkeyCaptureError(null);
						}}
					>
						Сброс
					</button>
				</div>

				<span className={styles["help-text"]}>
					Можно назначить одну клавишу, например M или Space, либо сочетание. Escape отменяет запись.
				</span>
				{hotkeyCaptureError && (
					<span className={styles["error-inline"]}>{hotkeyCaptureError}</span>
				)}
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

function createShortcutPreference(event: KeyboardEvent): KeyboardShortcutPreference | null {
	if (isModifierKey(event.key)) return null;

	const keyLabel = getShortcutKeyLabel(event);
	if (!keyLabel) return null;

	const parts = [
		event.ctrlKey ? "Ctrl" : null,
		event.altKey ? "Alt" : null,
		event.shiftKey ? "Shift" : null,
		event.metaKey ? "Meta" : null,
		keyLabel,
	].filter((part): part is string => Boolean(part));

	return {
		code: event.code,
		key: event.key,
		ctrlKey: event.ctrlKey,
		altKey: event.altKey,
		shiftKey: event.shiftKey,
		metaKey: event.metaKey,
		label: parts.join("+"),
	};
}

function isModifierKey(key: string) {
	return key === "Control" || key === "Alt" || key === "Shift" || key === "Meta";
}

function getShortcutKeyLabel(event: KeyboardEvent) {
	if (event.code.startsWith("Key")) return event.code.slice(3);
	if (event.code.startsWith("Digit")) return event.code.slice(5);
	if (event.code.startsWith("Numpad")) return event.code.replace("Numpad", "Num ");
	if (event.code === "Space") return "Space";
	if (event.code === "Minus") return "-";
	if (event.code === "Equal") return "=";
	if (event.code.startsWith("Arrow")) return event.code.replace("Arrow", "");
	if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code;
	if (event.key.length === 1) return event.key.toUpperCase();
	return event.key;
}
