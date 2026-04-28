import type { CinemaModeOverlayControlsProps } from "./CinemaModeOverlayControls.props";
import styles from "./CinemaModeOverlayControls.module.css";

export function CinemaModeOverlayControls({ displayName, onExit }: CinemaModeOverlayControlsProps) {
	return (
		<div className={styles["overlay"]}>
			<div className={styles["meta"]}>
				<div className={styles["title"]}>{displayName} is sharing screen</div>
				<div className={styles["hint"]}>Esc to exit Cinema Mode</div>
			</div>
			<button type="button" className={styles["exit"]} onClick={onExit}>
				Exit Cinema
			</button>
		</div>
	);
}
