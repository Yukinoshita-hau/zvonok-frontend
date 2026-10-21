import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { deviceActions } from "../../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../../store/store";
import {
	createShortcutPreference,
	type KeyboardShortcutPreference,
} from "../../../utils/keyboardShortcut";
import styles from "../VoiceVideoSetting.module.css";
import { useSelector } from 'react-redux';
import { isKeyboardShortcutEvent } from '../../../utils/keyboardShortcut';

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
	const error = useSelector((s: RootState) => s.device.hotkeyError);
	const keys = [muteMicrophoneHotkey, toggleCameraHotkey, toggleScreenShareHotkey];
	return (
		<section className={styles["settings-card"]}>
			{error && <p role="alert">{error}</p>}
			<p>В браузере — только при фокусе приложения во время звонка. Глобальная регистрация доступна через существующий Electron bridge; отказ ОС показывается как ошибка. Push-to-talk отсутствует.</p>
			<p>Фиксированные команды: Enter — отправить сообщение; Shift+Enter — новая строка; Escape — закрыть диалог или выйти из Cinema. Навигация — Tab / Shift+Tab и Enter.</p>
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
					conflicts={keys.filter(key => key !== muteMicrophoneHotkey)}
					onChange={(value) => dispatch(deviceActions.setMuteMicrophoneHotkey(value))}
					onReset={() => dispatch(deviceActions.resetMuteMicrophoneHotkey())}
				/>

				<HotkeyRow
					label="Камера"
					description="Включить или выключить камеру."
					value={toggleCameraHotkey}
					conflicts={keys.filter(key => key !== toggleCameraHotkey)}
					onChange={(value) => dispatch(deviceActions.setToggleCameraHotkey(value))}
					onReset={() => dispatch(deviceActions.resetToggleCameraHotkey())}
				/>

				<HotkeyRow
					label="Демонстрация экрана"
					description="Остановить демонстрацию или открыть выбор экрана."
					value={toggleScreenShareHotkey}
					conflicts={keys.filter(key => key !== toggleScreenShareHotkey)}
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
	conflicts: KeyboardShortcutPreference[];
	onChange: (value: KeyboardShortcutPreference) => void;
	onReset: () => void;
}

function HotkeyRow({
	label,
	description,
	value,
	conflicts,
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
		if (event.key === 'Tab') { setIsCapturing(false); return; }
		event.preventDefault();
		event.stopPropagation();

		if (event.key === "Escape") {
			setIsCapturing(false);
			setError(null);
			return;
		}

		const nextHotkey = createShortcutPreference(event.nativeEvent);
		if (!nextHotkey) {
			setError("Эта комбинация зарезервирована. Выберите другую клавишу или сочетание.");
			return;
		}
		if (conflicts.some(key => isKeyboardShortcutEvent(nextHotkey, key))) {
			setError('Комбинация уже назначена другой команде.');
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
					aria-label={`Горячая клавиша: ${label}`}
					data-hotkey-capturing={isCapturing}
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

			{error && <span role="alert" className={styles["error-inline"]}>{error}</span>}
		</div>
	);
}
