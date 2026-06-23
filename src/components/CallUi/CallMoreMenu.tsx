import { EyeOff, MoreHorizontal } from "lucide-react";
import type { MouseEvent } from "react";
import { CallControlButton } from "./CallControlButton";
import styles from "./CallUi.module.css";
import type { CallMoreMenuProps } from "./CallMoreMenu.props";

export function CallMoreMenu({ onHide }: CallMoreMenuProps) {
	return (
		<details className={styles["control-menu"]}>
			<summary
				className={[
					styles["control-button"],
					styles["control-icon-button"],
					styles["control-menu-icon-summary"],
				].join(" ")}
				title="Ещё действия"
				aria-label="Ещё действия"
			>
				<MoreHorizontal size={18} />
			</summary>
			<div className={styles["control-menu-content"]} onClick={closeMenuAfterAction}>
				<CallControlButton
					className={styles["control-menu-item"]}
					icon={<EyeOff size={16} />}
					label="Скрыть звонок"
					showLabel
					onClick={onHide}
				/>
			</div>
		</details>
	);
}

function closeMenuAfterAction(event: MouseEvent<HTMLDivElement>) {
	if (!(event.target instanceof HTMLElement)) return;
	if (!event.target.closest("button")) return;
	event.currentTarget.closest("details")?.removeAttribute("open");
}
