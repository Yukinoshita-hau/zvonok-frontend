import { MICROPHONE_QUALITY_PRESETS, type MicQualitySetting } from "../../../utils/microphoneQuality";
import type { MicrophoneQualitySelectorProps } from "./MicrophoneQualitySelector.props";
import styles from "./MicrophoneQualitySelector.module.css";

const ORDER: MicQualitySetting[] = [
	"clear",
	"stable",
	"gaming",
	"studio",
	"boosted",
	"potato",
	"insane"
];

export function MicrophoneQualitySelector({
	value,
	onChange,
}: MicrophoneQualitySelectorProps) {
	return (
		<div className={styles["root"]}>
			<div className={styles["cards"]}>
				{ORDER.map((key) => {
					const preset = MICROPHONE_QUALITY_PRESETS[key];

					return (
						<button
							type="button"
							key={preset.value}
							className={[
								styles["card"],
								value === preset.value ? styles["card-active"] : "",
							].join(" ")}
							onClick={() => onChange(preset.value)}
						>
							<div className={styles["title"]}>{preset.label}</div>

							<div className={styles["description"]}>
								{preset.description}
							</div>

							<div className={styles["meta"]}>
								{preset.sampleRate} Hz • Mono • {preset.publishLabel}
							</div>

							{preset.warning && (
								<div className={styles["warning"]}>
									{preset.warning}
								</div>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
