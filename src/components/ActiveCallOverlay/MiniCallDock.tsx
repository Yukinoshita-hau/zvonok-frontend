import { MicrophoneToggleButton } from "../CallUi/MicrophoneToggleButton";
import styles from "./ActiveCallOverlay.module.css";
import { MiniSpeakingStatus } from "./MiniSpeakingStatus";

interface MiniCallDockProps {
	hasChat: boolean;
	onOpenChat: () => void;
	onExpand: () => void;
	onHide: () => void;
	onEnd: () => void;
}

export function MiniCallDock({
	hasChat,
	onOpenChat,
	onExpand,
	onHide,
	onEnd,
}: MiniCallDockProps) {
	return (
		<div className={styles["mini-dock"]}>
			<MiniSpeakingStatus />

			<div className={styles["mini-actions"]}>
				<MicrophoneToggleButton
					className={`${styles["mini-button"]} ${styles["mini-mic-button"]}`}
					enabledLabel="Выкл."
					disabledLabel="Вкл."
					showIcon
					titlePrefix="Микрофон"
				/>
				{hasChat && (
					<button
						type="button"
						className={styles["mini-button"]}
						onClick={onOpenChat}
					>
						Чат
					</button>
				)}
				<button
					type="button"
					className={styles["mini-button"]}
					onClick={onExpand}
				>
					Открыть
				</button>
				<button
					type="button"
					className={styles["mini-button"]}
					onClick={onHide}
				>
					Скрыть
				</button>
				<button
					type="button"
					className={styles["mini-leave"]}
					onClick={onEnd}
				>
					Завершить
				</button>
			</div>
		</div>
	);
}
