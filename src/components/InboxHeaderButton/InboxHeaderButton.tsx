import type { InboxHeaderButtonProps } from "./InboxHeaderButton.props";
import styles from "./InboxHeaderButton.module.css";
import cn from "classnames";

export function InboxHeaderButton({ children, isActive, onClick, ...props }: InboxHeaderButtonProps) {

	return (
		<button className={cn(styles["inbox-header-button"], {
			[styles["inbox-header-button_active"]]: isActive
		})} onClick={onClick} {...props}>
			{children}
		</button>
	)
}
