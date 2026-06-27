import { Check, Minus, Plus } from "lucide-react";
import type { CodeEditorSettings } from "./CodeEditor";
import styles from "../styles/CodeSessionPanel.module.css";

interface CodeEditorSettingsPanelProps {
	settings: CodeEditorSettings;
	onChange: (settings: CodeEditorSettings) => void;
}

export function CodeEditorSettingsPanel({ settings, onChange }: CodeEditorSettingsPanelProps) {
	const update = <Key extends keyof CodeEditorSettings,>(key: Key, value: CodeEditorSettings[Key]) => {
		onChange({ ...settings, [key]: value });
	};

	return (
		<div className={styles.editorSettingsPanel}>
			<div className={styles.settingStepper}>
				<span>Размер</span>
				<div className={styles.stepperControls}>
					<button
						type="button"
						onClick={() => update("fontSize", Math.max(12, settings.fontSize - 1))}
						aria-label="Уменьшить шрифт"
					>
						<Minus size={13} />
					</button>
					<strong>{settings.fontSize}px</strong>
					<button
						type="button"
						onClick={() => update("fontSize", Math.min(20, settings.fontSize + 1))}
						aria-label="Увеличить шрифт"
					>
						<Plus size={13} />
					</button>
				</div>
			</div>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.wordWrap}
					onChange={(event) => update("wordWrap", event.target.checked)}
				/>
				<span><Check size={13} /> Перенос строк</span>
			</label>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.minimap}
					onChange={(event) => update("minimap", event.target.checked)}
				/>
				<span><Check size={13} /> Миникарта</span>
			</label>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.lineNumbers}
					onChange={(event) => update("lineNumbers", event.target.checked)}
				/>
				<span><Check size={13} /> Номера</span>
			</label>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.renderWhitespace}
					onChange={(event) => update("renderWhitespace", event.target.checked)}
				/>
				<span><Check size={13} /> Пробелы</span>
			</label>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.bracketPairs}
					onChange={(event) => update("bracketPairs", event.target.checked)}
				/>
				<span><Check size={13} /> Скобки</span>
			</label>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.smoothCursor}
					onChange={(event) => update("smoothCursor", event.target.checked)}
				/>
				<span><Check size={13} /> Плавный курсор</span>
			</label>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.formatOnPaste}
					onChange={(event) => update("formatOnPaste", event.target.checked)}
				/>
				<span><Check size={13} /> Формат вставки</span>
			</label>

			<label className={styles.settingToggle}>
				<input
					type="checkbox"
					checked={settings.fontLigatures}
					onChange={(event) => update("fontLigatures", event.target.checked)}
				/>
				<span><Check size={13} /> Лигатуры</span>
			</label>

			<label className={styles.tabSizeSelect}>
				<span>Tab</span>
				<select
					value={settings.tabSize}
					onChange={(event) => update("tabSize", Number(event.target.value))}
				>
					<option value={2}>2</option>
					<option value={4}>4</option>
					<option value={8}>8</option>
				</select>
			</label>
		</div>
	);
}
