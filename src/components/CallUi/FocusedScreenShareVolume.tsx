import { MonitorUp, RotateCcw, Volume2 } from "lucide-react";
import styles from "./CallUi.module.css";
import type { FocusedScreenShareVolumeProps } from "./FocusedScreenShareVolume.props";

export function FocusedScreenShareVolume({
	volume,
	onChange,
	onReset,
}: FocusedScreenShareVolumeProps) {
	return (
		<div className={styles["focused-volume"]}>
			<button
				type="button"
				className={styles["focused-volume-trigger"]}
				title="Громкость трансляции"
				aria-label="Громкость трансляции"
			>
				<Volume2 size={17} />
			</button>
			<div className={styles["focused-volume-panel"]}>
				<div className={styles["focused-volume-header"]}>
					<MonitorUp size={14} />
					<span>Звук трансляции</span>
				</div>
				<div className={styles["focused-volume-row"]}>
					<input
						type="range"
						min={0}
						max={100}
						value={volume}
						onChange={(event) => onChange(Number(event.target.value))}
						aria-label="Громкость трансляции"
					/>
					<span>{volume}%</span>
					<button
						type="button"
						onClick={onReset}
						title="Сбросить громкость трансляции"
						aria-label="Сбросить громкость трансляции"
					>
						<RotateCcw size={13} />
					</button>
				</div>
			</div>
		</div>
	);
}
