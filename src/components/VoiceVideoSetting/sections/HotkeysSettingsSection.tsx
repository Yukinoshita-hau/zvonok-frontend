import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { deviceActions } from "../../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../../store/store";
import {
	createShortcutPreference,
	type KeyboardShortcutPreference,
} from "../../../utils/keyboardShortcut";
import styles from "../VoiceVideoSetting.module.css";

interface HotkeysSettingsSectionProps {
	dispatch: AppDispatch;
	muteMicrophoneHotkey: RootState["device"]["muteMicrophoneHotkey"];
	toggleCameraHotkey: RootState["device"]["toggleCameraHotkey"];
	toggleScreenShareHotkey: RootState["device"]["toggleScreenShareHotkey"];
}

export function HotkeysSettingsSection({
	dispatch,
	muteMicrophoneHotkey,
	toggleCameraHotkey,
	toggleScreenShareHotkey,
}: HotkeysSettingsSectionProps) {
	return (
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Горячие клавиши</h3>
					<p className={styles["section-subtitle"]}>
						Быстрое управление звонком. В desktop эти клавиши работают глобально во время звонка.
					</p>
				</div>
			</div>

			<div className={styles["hotkeys-list"]}>
				<HotkeyRow
					label="Микрофон"
					description="Включить или выключить микрофон."
					value={muteMicrophoneHotkey}
					onChange={(value) => dispatch(deviceActions.setMuteMicrophoneHotkey(value))}
					onReset={() => dispatch(deviceActions.resetMuteMicrophoneHotkey())}
				/>

				<HotkeyRow
					label="Камера"
					description="Включить или выключить камеру."
					value={toggleCameraHotkey}
					onChange={(value) => dispatch(deviceActions.setToggleCameraHotkey(value))}
					onReset={() => dispatch(deviceActions.resetToggleCameraHotkey())}
				/>

				<HotkeyRow
					label="Демонстрация экрана"
					description="Остановить демонстрацию или открыть выбор экрана."
					value={toggleScreenShareHotkey}
					onChange={(value) => dispatch(deviceActions.setToggleScreenShareHotkey(value))}
					onReset={() => dispatch(deviceActions.resetToggleScreenShareHotkey())}
				/>
			</div>

			<span className={styles["help-text"]}>
				Можно назначить одну клавишу, например M или Space, либо сочетание. Escape отменяет запись.
			</span>
		</section>
	);
}

interface HotkeyRowProps {
	label: string;
	description: string;
	value: KeyboardShortcutPreference;
	onChange: (value: KeyboardShortcutPreference) => void;
	onReset: () => void;
}

function HotkeyRow({
	label,
	description,
	value,
	onChange,
	onReset,
}: HotkeyRowProps) {
	const [isCapturing, setIsCapturing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const startCapture = () => {
		setIsCapturing(true);
		setError(null);
		window.setTimeout(() => inputRef.current?.focus(), 0);
	};

	const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (!isCapturing) return;
		event.preventDefault();
		event.stopPropagation();

		if (event.key === "Escape") {
			setIsCapturing(false);
			setError(null);
			return;
		}

		const nextHotkey = createShortcutPreference(event.nativeEvent);
		if (!nextHotkey) {
			setError("Нажмите обычную клавишу или сочетание клавиш.");
			return;
		}

		onChange(nextHotkey);
		setIsCapturing(false);
		setError(null);
	};

	return (
		<div className={styles["hotkey-setting-row"]}>
			<div className={styles["hotkey-copy"]}>
				<strong>{label}</strong>
				<span>{description}</span>
			</div>

			<div className={styles["hotkey-row"]}>
				<input
					ref={inputRef}
					className={styles["input"]}
					readOnly
					value={isCapturing ? "Нажмите клавишу..." : value.label}
					onClick={startCapture}
					onKeyDown={onKeyDown}
				/>
				<button
					type="button"
					className={styles["btn-secondary-neutral"]}
					onClick={startCapture}
				>
					Запись
				</button>
				<button
					type="button"
					className={styles["btn-secondary-neutral"]}
					onClick={() => {
						onReset();
						setIsCapturing(false);
						setError(null);
					}}
				>
					Сброс
				</button>
			</div>

			{error && <span className={styles["error-inline"]}>{error}</span>}
		</div>
	);
}
