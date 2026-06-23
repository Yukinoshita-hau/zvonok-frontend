import type { CinemaModeOverlayControlsProps } from "./CinemaModeOverlayControls.props";
import styles from "./CinemaModeOverlayControls.module.css";

export function CinemaModeOverlayControls({ displayName, onExit }: CinemaModeOverlayControlsProps) {
	return (
		<div className={styles["overlay"]}>
			<div className={styles["meta"]}>
				<div className={styles["title"]}>{displayName} показывает экран</div>
				<div className={styles["hint"]}>Esc — выйти из кино-режима</div>
			</div>
			<button type="button" className={styles["exit"]} onClick={onExit}>
				Выйти
			</button>
		</div>
	);
}
