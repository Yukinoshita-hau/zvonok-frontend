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
							title={preset.warning ?? preset.bandwidthHint ?? preset.description}
						>
							<strong>{preset.label}</strong>
							<span>{preset.width}x{preset.height} / {preset.frameRate}fps</span>
							<small>{preset.bandwidthHint ?? `${preset.bandwidthMbps ?? 1}+ Mbps`}</small>
						</button>
					))}
				</div>
			</section>
		</div>
	);
}
