import {
	SCREEN_SHARE_PRESET_GROUPS,
	SCREEN_SHARE_QUALITY_PRESETS,
	type ScreenShareManualQuality,
} from "../../../utils/callQuality";
import type { QualityGroupSection, ScreenShareQualityGridProps } from "./ScreenShareQualityGrid.props";
import styles from "./ScreenShareQualityGrid.module.css";

const ORDER: QualityGroupSection[] = [
	{ group: "base", label: SCREEN_SHARE_PRESET_GROUPS.base.label, description: SCREEN_SHARE_PRESET_GROUPS.base.description, items: ["low", "medium", "high"] },
	{ group: "gaming", label: SCREEN_SHARE_PRESET_GROUPS.gaming.label, description: SCREEN_SHARE_PRESET_GROUPS.gaming.description, items: ["game60", "game120", "g1080p144", "g1080p180", "g1080p200", "g1080p220", "g1080p300"] },
	{ group: "crystal", label: SCREEN_SHARE_PRESET_GROUPS.crystal.label, description: SCREEN_SHARE_PRESET_GROUPS.crystal.description, items: ["c1440p30", "c4k30", "c4k60", "c4k120"] },
	{ group: "godlike", label: SCREEN_SHARE_PRESET_GROUPS.godlike.label, description: SCREEN_SHARE_PRESET_GROUPS.godlike.description, items: ["g8k30", "g8k60"] },
];

export function ScreenShareQualityGrid({
	value,
	onChange,
	showExperimental,
	onShowExperimentalChange,
	runtimeInfo,
}: ScreenShareQualityGridProps) {
	return (
		<div className={styles["root"]}>
			<label className={styles["base-select-row"]}>
				<span>Base mode</span>
				<select value={value === "auto" ? "auto" : resolveBaseValue(value)} onChange={(event) => onChange(event.target.value as ScreenShareManualQuality | "auto")}>
					<option value="auto">Auto</option>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
			</label>

			<label className={styles["toggle-row"]}>
				<input type="checkbox" checked={showExperimental} onChange={(event) => onShowExperimentalChange(event.target.checked)} />
				<span>Show experimental modes</span>
			</label>

			{ORDER.map((section) => {
				const items = section.items
					.map((key) => SCREEN_SHARE_QUALITY_PRESETS[key])
					.filter((preset) => showExperimental || !preset.isExperimental);
				if (items.length === 0) return null;

				return (
					<div key={section.group} className={styles["group"]}>
						<div className={styles["group-header"]}>
							<strong>{section.label}</strong>
							<span>{section.description}</span>
						</div>
						<div className={styles["cards"]}>
							{items.map((preset) => (
								<button
									type="button"
									key={preset.value}
									className={[styles["card"], value === preset.value ? styles["card-active"] : ""].join(" ")}
									onClick={() => onChange(preset.value)}
								>
									<div className={styles["card-title"]}>{preset.label}</div>
									<div className={styles["card-meta"]}>{preset.width}×{preset.height} • {preset.frameRate} FPS • {Math.round(preset.maxBitrate / 1_000_000)} Mbps</div>
									<div className={styles["card-description"]}>{preset.description}</div>
									{preset.isExperimental && <span className={styles["badge"]}>Experimental</span>}
									{preset.bandwidthHint && <div className={styles["warning"]}>{preset.bandwidthHint}</div>}
									{preset.warning && <div className={styles["warning"]}>{preset.warning}</div>}
								</button>
							))}
						</div>
					</div>
				);
			})}

			{runtimeInfo.updatedAt && (
				<div className={styles["runtime"]}>
					<div>Requested: {runtimeInfo.requestedResolution ?? "N/A"} @ {runtimeInfo.requestedFps ?? "N/A"} FPS</div>
					<div>Actual: {runtimeInfo.actualResolution ?? "N/A"} @ {runtimeInfo.actualFps ?? "N/A"} FPS</div>
					<div>Active mode: {runtimeInfo.activePreset ?? "N/A"}</div>
					{runtimeInfo.fallbackReason && <div className={styles["warning"]}>{runtimeInfo.fallbackReason}</div>}
				</div>
			)}
		</div>
	);
}

function resolveBaseValue(value: ScreenShareQualityGridProps["value"]): "low" | "medium" | "high" {
	if (value === "low" || value === "medium" || value === "high") return value;
	return "high";
}
