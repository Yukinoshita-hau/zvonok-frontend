import { Check, Minus, Plus } from "lucide-react";
import type { CodeEditorSettings } from "./CodeEditor";
import styles from "../styles/CodeSessionPanel.module.css";

interface CodeEditorSettingsPanelProps {
	settings: CodeEditorSettings;
	onChange: (settings: CodeEditorSettings) => void;
}

const ACCENT_COLORS = ["#38bdf8", "#22c55e", "#a78bfa", "#f97316", "#ef4444"];
const TERMINAL_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#a78bfa", "#f43f5e"];

export function CodeEditorSettingsPanel({ settings, onChange }: CodeEditorSettingsPanelProps) {
	const update = <Key extends keyof CodeEditorSettings,>(key: Key, value: CodeEditorSettings[Key]) => {
		onChange({ ...settings, [key]: value });
	};

	return (
		<div className={styles.editorSettingsPanel}>
			<div className={styles.settingsGroup}>
				<div className={styles.settingsGroupTitle}>Вид</div>
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
							onClick={() => update("fontSize", Math.min(24, settings.fontSize + 1))}
							aria-label="Увеличить шрифт"
						>
							<Plus size={13} />
						</button>
					</div>
				</div>

				<SegmentedSetting
					label="Шрифт"
					value={settings.fontFamily}
					options={[
						{ value: "default", label: "Default" },
						{ value: "jetbrains", label: "JetBrains" },
						{ value: "fira", label: "Fira" },
						{ value: "cascadia", label: "Cascadia" },
					]}
					onChange={(value) => update("fontFamily", value)}
				/>

				<ColorSetting
					label="Акцент"
					value={settings.accentColor}
					colors={ACCENT_COLORS}
					onChange={(value) => update("accentColor", value)}
				/>

				<ColorSetting
					label="Терминал"
					value={settings.terminalAccent}
					colors={TERMINAL_COLORS}
					onChange={(value) => update("terminalAccent", value)}
				/>
			</div>

			<div className={styles.settingsGroup}>
				<div className={styles.settingsGroupTitle}>Курсор</div>
				<SegmentedSetting
					label="Форма"
					value={settings.cursorStyle}
					options={[
						{ value: "line", label: "Линия" },
						{ value: "block", label: "Блок" },
						{ value: "underline", label: "Низ" },
					]}
					onChange={(value) => update("cursorStyle", value)}
				/>
				<label className={styles.rangeSetting}>
					<span>Толщина</span>
					<input
						type="range"
						min={1}
						max={5}
						value={settings.cursorWidth}
						onChange={(event) => update("cursorWidth", Number(event.target.value))}
					/>
					<strong>{settings.cursorWidth}</strong>
				</label>
				<SettingToggle
					checked={settings.smoothCursor}
					label="Плавный курсор"
					onChange={(checked) => update("smoothCursor", checked)}
				/>
			</div>

			<div className={styles.settingsGroup}>
				<div className={styles.settingsGroupTitle}>Навигация</div>
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
				<SettingToggle
					checked={settings.wordWrap}
					label="Перенос строк"
					onChange={(checked) => update("wordWrap", checked)}
				/>
				<SettingToggle
					checked={settings.smoothScrolling}
					label="Плавный скролл"
					onChange={(checked) => update("smoothScrolling", checked)}
				/>
				<SettingToggle
					checked={settings.folding}
					label="Сворачивание"
					onChange={(checked) => update("folding", checked)}
				/>
			</div>

			<div className={styles.settingsGroup}>
				<div className={styles.settingsGroupTitle}>Подсветка</div>
				<SettingToggle
					checked={settings.lineNumbers}
					label="Номера строк"
					onChange={(checked) => update("lineNumbers", checked)}
				/>
				<SettingToggle
					checked={settings.renderLineHighlight}
					label="Текущая строка"
					onChange={(checked) => update("renderLineHighlight", checked)}
				/>
				<SettingToggle
					checked={settings.selectionHighlight}
					label="Похожие выделения"
					onChange={(checked) => update("selectionHighlight", checked)}
				/>
				<SettingToggle
					checked={settings.renderWhitespace}
					label="Пробелы"
					onChange={(checked) => update("renderWhitespace", checked)}
				/>
				<SettingToggle
					checked={settings.indentGuides}
					label="Линии отступов"
					onChange={(checked) => update("indentGuides", checked)}
				/>
				<SettingToggle
					checked={settings.bracketPairs}
					label="Парные скобки"
					onChange={(checked) => update("bracketPairs", checked)}
				/>
			</div>

			<div className={styles.settingsGroup}>
				<div className={styles.settingsGroupTitle}>Помощники</div>
				<SettingToggle
					checked={settings.quickSuggestions}
					label="Быстрые подсказки"
					onChange={(checked) => update("quickSuggestions", checked)}
				/>
				<SettingToggle
					checked={settings.formatOnPaste}
					label="Формат вставки"
					onChange={(checked) => update("formatOnPaste", checked)}
				/>
				<SettingToggle
					checked={settings.fontLigatures}
					label="Лигатуры"
					onChange={(checked) => update("fontLigatures", checked)}
				/>
				<SettingToggle
					checked={settings.minimap}
					label="Миникарта"
					onChange={(checked) => update("minimap", checked)}
				/>
			</div>
		</div>
	);
}

interface SettingToggleProps {
	checked: boolean;
	label: string;
	onChange: (checked: boolean) => void;
}

function SettingToggle({ checked, label, onChange }: SettingToggleProps) {
	return (
		<label className={styles.settingToggle}>
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span><Check size={13} /> {label}</span>
		</label>
	);
}

interface SegmentedSettingProps<Value extends string> {
	label: string;
	value: Value;
	options: Array<{ value: Value; label: string }>;
	onChange: (value: Value) => void;
}

function SegmentedSetting<Value extends string>({ label, value, options, onChange }: SegmentedSettingProps<Value>) {
	return (
		<div className={styles.segmentedSetting}>
			<span>{label}</span>
			<div className={styles.segmentedOptions}>
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						data-active={option.value === value ? "true" : undefined}
						onClick={() => onChange(option.value)}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
}

interface ColorSettingProps {
	label: string;
	value: string;
	colors: string[];
	onChange: (value: string) => void;
}

function ColorSetting({ label, value, colors, onChange }: ColorSettingProps) {
	return (
		<div className={styles.colorSetting}>
			<span>{label}</span>
			<div className={styles.colorSwatches}>
				{colors.map((color) => (
					<button
						key={color}
						type="button"
						style={{ backgroundColor: color }}
						data-active={color === value ? "true" : undefined}
						onClick={() => onChange(color)}
						aria-label={`Цвет ${color}`}
					/>
				))}
			</div>
		</div>
	);
}
