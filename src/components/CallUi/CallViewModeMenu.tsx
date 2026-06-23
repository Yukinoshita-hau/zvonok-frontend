import { ChevronDown, Focus, Minimize2, MonitorPlay } from "lucide-react";
import type { MouseEvent } from "react";
import { CallControlButton } from "./CallControlButton";
import styles from "./CallUi.module.css";
import type { CallViewModeMenuProps } from "./CallViewModeMenu.props";

export function CallViewModeMenu({
	isFocusMode,
	isCinemaMode,
	canOpenCinema,
	onToggleFocus,
	onToggleCinema,
	onMinimize,
}: CallViewModeMenuProps) {
	return (
		<details className={styles["control-menu"]}>
			<summary className={styles["control-menu-summary"]}>
				<span>Вид</span>
				<ChevronDown size={15} />
			</summary>
			<div className={styles["control-menu-content"]} onClick={closeMenuAfterAction}>
				<CallControlButton
					className={styles["control-menu-item"]}
					icon={<Focus size={16} />}
					label={isFocusMode ? "Выйти из фокуса" : "Фокус"}
					showLabel
					isActive={isFocusMode}
					onClick={onToggleFocus}
				/>
				<CallControlButton
					className={styles["control-menu-item"]}
					icon={<MonitorPlay size={16} />}
					label={isCinemaMode ? "Выйти из кино" : "Кино"}
					showLabel
					isActive={isCinemaMode}
					disabled={!canOpenCinema}
					title={canOpenCinema ? "Открыть выбранное видео в кино-режиме" : "Сначала выберите камеру или демонстрацию экрана"}
					onClick={onToggleCinema}
				/>
				<CallControlButton
					className={styles["control-menu-item"]}
					icon={<Minimize2 size={16} />}
					label="Мини-режим"
					showLabel
					onClick={onMinimize}
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
