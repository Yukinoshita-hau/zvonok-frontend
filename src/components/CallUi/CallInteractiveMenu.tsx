import { Brush, ChevronDown, Code2, PenLine } from "lucide-react";
import type { MouseEvent } from "react";
import { CallControlButton } from "./CallControlButton";
import styles from "./CallUi.module.css";
import type { CallInteractiveMenuProps } from "./CallInteractiveMenu.props";

export function CallInteractiveMenu({
	canUseWhiteboard,
	isWhiteboardOpen,
	isCodeSessionOpen,
	canUseScreenOverlay,
	isScreenOverlayOpen,
	onOpenWhiteboard,
	onOpenCodeSession,
	onToggleScreenOverlay,
}: CallInteractiveMenuProps) {
	const hasActiveInteractive = isWhiteboardOpen || isCodeSessionOpen || isScreenOverlayOpen;

	return (
		<details className={styles["control-menu"]}>
			<summary
				className={styles["control-menu-summary"]}
				data-active={hasActiveInteractive ? "true" : undefined}
				title="Интерактивы звонка"
				aria-label="Интерактивы звонка"
			>
				<span>Интерактивы</span>
				<ChevronDown size={15} />
			</summary>
			<div className={styles["control-menu-content"]} onClick={closeMenuAfterAction}>
				<CallControlButton
					className={styles["control-menu-item"]}
					icon={<Brush size={16} />}
					label="Доска"
					showLabel
					isActive={isWhiteboardOpen}
					onClick={onOpenWhiteboard}
					disabled={!canUseWhiteboard}
					title={canUseWhiteboard ? "Открыть доску" : "Доска доступна после подключения к звонку"}
				/>
				<CallControlButton
					className={styles["control-menu-item"]}
					icon={<Code2 size={16} />}
					label="Редактор кода"
					showLabel
					isActive={isCodeSessionOpen}
					onClick={onOpenCodeSession}
					disabled={!canUseWhiteboard}
					title={canUseWhiteboard ? "Открыть Code Session" : "Редактор доступен после подключения к звонку"}
				/>
				<CallControlButton
					className={styles["control-menu-item"]}
					icon={<PenLine size={16} />}
					label="Разметка экрана"
					showLabel
					isActive={isScreenOverlayOpen}
					onClick={onToggleScreenOverlay}
					disabled={!canUseScreenOverlay}
					title={canUseScreenOverlay
						? (isScreenOverlayOpen ? "Скрыть инструменты разметки" : "Открыть разметку трансляции")
						: "Сначала откройте трансляцию экрана в фокусе"}
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
