import { Monitor, PanelsTopLeft, SquareStack } from "lucide-react";
import type { ScreenShareSource } from "./ScreenSharePicker.types";
import styles from "./ScreenSharePicker.module.css";

interface ScreenShareSourceCardProps {
	source: ScreenShareSource;
	isSelected: boolean;
	onSelect: (source: ScreenShareSource) => void;
}

export function ScreenShareSourceCard({ source, isSelected, onSelect }: ScreenShareSourceCardProps) {
	const Icon = source.type === "window" ? PanelsTopLeft : source.type === "tab" ? SquareStack : Monitor;

	return (
		<button
			type="button"
			className={styles["source-card"]}
			data-selected={isSelected}
			onClick={() => onSelect(source)}
		>
			<div className={styles["source-preview"]}>
				{source.thumbnail ? (
					<img src={source.thumbnail} alt="" draggable={false} />
				) : (
					<div className={styles["source-placeholder"]}>
						<Icon size={34} />
					</div>
				)}
				{source.appIcon && <img className={styles["source-app-icon"]} src={source.appIcon} alt="" draggable={false} />}
			</div>
			<div className={styles["source-name"]}>{source.name}</div>
		</button>
	);
}
