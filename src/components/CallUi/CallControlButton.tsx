import { forwardRef } from "react";
import styles from "./CallUi.module.css";
import type { CallControlButtonProps } from "./CallControlButton.props";

export const CallControlButton = forwardRef<HTMLButtonElement, CallControlButtonProps>(
	function CallControlButton({
		icon,
		label,
		isActive = false,
		isDanger = false,
		showLabel = false,
		className,
		type = "button",
		title,
		"aria-label": ariaLabel,
		...buttonProps
	}, ref) {
		const classes = [
			styles["control-button"],
			isDanger ? styles["control-button-danger"] : "",
			className ?? "",
		].filter(Boolean).join(" ");

		return (
			<button
				{...buttonProps}
				ref={ref}
				type={type}
				className={classes}
				data-active={isActive}
				title={title ?? label}
				aria-label={ariaLabel ?? label}
			>
				{icon}
				<span className={showLabel ? styles["control-label"] : styles["control-label-hidden"]}>
					{label}
				</span>
			</button>
		);
	}
);
