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
					enabledLabel="Mute"
					disabledLabel="Unmute"
					showIcon
					titlePrefix="Mini microphone control"
				/>
				{hasChat && (
					<button
						type="button"
						className={styles["mini-button"]}
						onClick={onOpenChat}
					>
						Chat
					</button>
				)}
				<button
					type="button"
					className={styles["mini-button"]}
					onClick={onExpand}
				>
					Expand
				</button>
				<button
					type="button"
					className={styles["mini-button"]}
					onClick={onHide}
				>
					Hide
				</button>
				<button
					type="button"
					className={styles["mini-leave"]}
					onClick={onEnd}
				>
					End
				</button>
			</div>
		</div>
	);
}
