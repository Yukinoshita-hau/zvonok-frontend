import styles from "../DrawableCanvas.module.css";

interface CanvasClearConfirmProps {
	isBusy: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}

export function CanvasClearConfirm({
	isBusy,
	onCancel,
	onConfirm,
}: CanvasClearConfirmProps) {
	return (
		<div className={styles.confirmBackdrop} role="presentation">
			<div className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="clear-board-title">
				<div className={styles.confirmGlow} />
				<div id="clear-board-title" className={styles.confirmTitle}>Очистить доску?</div>
				<div className={styles.confirmText}>
					Все линии исчезнут у участников этой доски. Действие нельзя отменить.
				</div>
				<div className={styles.confirmActions}>
					<button
						type="button"
						className={styles.confirmSecondary}
						onClick={onCancel}
						disabled={isBusy}
					>
						Отмена
					</button>
					<button
						type="button"
						className={styles.confirmDanger}
						onClick={onConfirm}
						disabled={isBusy}
					>
						Очистить
					</button>
				</div>
			</div>
		</div>
	);
}
