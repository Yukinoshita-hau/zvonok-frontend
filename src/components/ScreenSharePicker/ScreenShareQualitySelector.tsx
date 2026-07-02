import { useMemo, useState } from "react";
import type { ScreenShareManualQuality } from "../../utils/callQuality";
import { SCREEN_SHARE_PICKER_QUALITY_GROUPS } from "./screenSharePickerService";
import styles from "./ScreenSharePicker.module.css";

interface ScreenShareQualitySelectorProps {
	value: ScreenShareManualQuality;
	onChange: (value: ScreenShareManualQuality) => void;
}

export function ScreenShareQualitySelector({ value, onChange }: ScreenShareQualitySelectorProps) {
	const initialGroup = useMemo(() => {
		return SCREEN_SHARE_PICKER_QUALITY_GROUPS.find((group) => (
			group.presets.some((preset) => preset.value === value)
		))?.group ?? "base";
	}, [value]);
	const [activeGroup, setActiveGroup] = useState(initialGroup);
	const selectedGroup = SCREEN_SHARE_PICKER_QUALITY_GROUPS.find((group) => group.group === activeGroup) ?? SCREEN_SHARE_PICKER_QUALITY_GROUPS[0];

	return (
		<div className={styles["quality-groups"]}>
			<div className={styles["quality-group-tabs"]}>
				{SCREEN_SHARE_PICKER_QUALITY_GROUPS.map((group) => (
					<button
						type="button"
						key={group.group}
						data-active={group.group === activeGroup}
						onClick={() => setActiveGroup(group.group)}
					>
						{group.label}
					</button>
				))}
			</div>
			<section className={styles["quality-group"]}>
				<div className={styles["quality-group-header"]}>
					<strong>{selectedGroup.label}</strong>
					<span>{selectedGroup.description}</span>
				</div>
				<div className={styles["quality-grid"]}>
					{selectedGroup.presets.map((preset) => (
						<button
							type="button"
							key={preset.value}
							className={styles["quality-card"]}
							data-selected={preset.value === value}
							data-experimental={preset.isExperimental ? "true" : undefined}
							onClick={() => onChange(preset.value)}
							title={getPresetHint(preset.warning ?? preset.bandwidthHint ?? preset.description) ?? undefined}
						>
							<strong>{getPresetLabel(preset.label)}</strong>
							<span>{preset.width}x{preset.height} / {preset.frameRate}fps</span>
							<small>{getPresetHint(preset.bandwidthHint) ?? `${preset.bandwidthMbps ?? 1}+ Мбит/с`}</small>
						</button>
					))}
				</div>
			</section>
		</div>
	);
}

function getPresetLabel(label: string) {
	switch (label) {
		case "Low":
			return "Низкое";
		case "Medium":
			return "Среднее";
		case "Medium+":
			return "Среднее+";
		case "High":
			return "Высокое";
		case "High+":
			return "Высокое+";
		default:
			return label
				.replace("Gaming", "Игры")
				.replace("Crystal", "Чёткость")
				.replace("Godlike", "Экстрим");
	}
}

function getPresetHint(hint?: string) {
	if (!hint) return null;
	if (hint.includes("Experimental")) {
		return "Экспериментально: браузер, источник или видеокарта могут снизить качество.";
	}
	if (hint.includes("Needs stable upload around 2.5+ Mbps")) return "Нужна стабильная отдача около 2.5+ Мбит/с";
	if (hint.includes("Needs stable upload around 4+ Mbps")) return "Нужна стабильная отдача около 4+ Мбит/с";
	if (hint.includes("Needs stable upload around 6+ Mbps")) return "Нужна стабильная отдача около 6+ Мбит/с";
	if (hint.includes("Needs very stable upload around 9+ Mbps")) return "Нужна очень стабильная отдача около 9+ Мбит/с";
	if (hint.includes("Requires very strong upload")) return "Нужна очень высокая скорость отдачи";
	if (hint.includes("Requires extreme upload and hardware")) return "Нужны экстремальная скорость отдачи и мощное железо";
	return hint
		.replace("Mbps", "Мбит/с")
		.replace("Low-latency motion-focused stream", "Низкая задержка и плавное движение")
		.replace("Fast motion, very high upload required", "Быстрое движение, нужна высокая отдача")
		.replace("Fast motion, high bandwidth", "Быстрое движение, высокий битрейт")
		.replace("Extreme high FPS, best-effort only", "Экстремальный FPS, без гарантии")
		.replace("Extreme FPS showcase", "Экстремальный FPS для тестов")
		.replace("Extreme experimental, may fallback", "Экспериментально, возможен откат качества")
		.replace("Sharper text and detail", "Более чёткий текст и детали")
		.replace("Very high quality detail", "Очень высокая детализация")
		.replace("Very high quality, strong upload", "Очень высокое качество, нужна сильная отдача")
		.replace("Very high quality, requires very strong upload", "Очень высокое качество, нужна очень сильная отдача")
		.replace("Absurd/experimental, for testing only", "Экстремально и только для тестов");
}
