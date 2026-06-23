import styles from "./NavigateBarButton.module.css";
import type { NavigateBarButtonProps } from "./NavigateBarButton.props";

export function NavigateBarButton({ children, onClick, ...buttonProps }: NavigateBarButtonProps) {
	return (
		<button className={styles["navigate-button"]} onClick={onClick} {...buttonProps}>
			{children}
		</button>
	)
}
