import { Mic, MonitorUp, RotateCcw } from "lucide-react";
import styles from "./AudioMixPanel.module.css";

interface ParticipantVolumeRowProps {
	source: "microphone" | "screenShareAudio";
	value: number;
	onChange: (next: number) => void;
	onReset: () => void;
	disabled?: boolean;
}

export function ParticipantVolumeRow({
	source,
	value,
	onChange,
	onReset,
	disabled = false,
}: ParticipantVolumeRowProps) {
	return (
		<div className={styles["row"]}>
			<div className={styles["source"]}>
				{source === "microphone" ? <Mic size={14} /> : <MonitorUp size={14} />}
				<span>{source === "microphone" ? "Микрофон" : "Трансляция"}</span>
			</div>
			<input
				type="range"
				min={0}
				max={100}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.target.value))}
				aria-label={source === "microphone" ? "Громкость микрофона" : "Громкость трансляции"}
			/>
			<span className={styles["percent"]}>{value}%</span>
			<button
				type="button"
				disabled={disabled}
				onClick={onReset}
				title="Сбросить до 100%"
				aria-label="Сбросить до 100%"
				className={styles["reset"]}
			>
				<RotateCcw size={13} />
			</button>
		</div>
	);
}
