import styles from "../DrawableCanvas.module.css";

interface CanvasPresenterBadgeProps {
	isPresenter: boolean;
	isFollowingPresenter: boolean;
	presenterUsername: string | null;
	onToggleFollowing: () => void;
}

export function CanvasPresenterBadge({
	isPresenter,
	isFollowingPresenter,
	presenterUsername,
	onToggleFollowing,
}: CanvasPresenterBadgeProps) {
	if (!presenterUsername && !isPresenter) return null;

	return (
		<div className={styles.presenterBadge}>
			{isPresenter
				? "Вы ведёте доску"
				: isFollowingPresenter ? `Следуете: ${presenterUsername}` : `Ведущий: ${presenterUsername}`}
			{!isPresenter && (
				<button type="button" onClick={onToggleFollowing}>
					{isFollowingPresenter ? "Не следовать" : "Следовать"}
				</button>
			)}
		</div>
	);
}
