import styles from "./NavigateBarButton.module.css";
import type { NavigateBarButtonProps } from "./NavigateBarButton.props";

export function NavigateBarButton({ children, onClick }: NavigateBarButtonProps) {
	return (
		<button className={styles["navigate-button"]} onClick={onClick}>
			{children}
		</button>
	)
}
