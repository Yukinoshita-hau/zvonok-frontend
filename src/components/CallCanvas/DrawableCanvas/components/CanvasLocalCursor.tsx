import type { CSSProperties } from "react";
import cn from "classnames";
import type { CanvasInteractionTool } from "../../../../api/interfaces/CanvasDtos";
import styles from "../DrawableCanvas.module.css";

interface CanvasLocalCursorProps {
	visible: boolean;
	canDraw: boolean;
	x: number;
	y: number;
	color: string;
	width: number;
	tool: CanvasInteractionTool;
}

export function CanvasLocalCursor({
	visible,
	canDraw,
	x,
	y,
	color,
	width,
	tool,
}: CanvasLocalCursorProps) {
	if (!visible || !canDraw) return null;

	return (
		<div
			className={cn(styles.localCursor, {
				[styles.localCursorPen]: tool === "PEN" || tool === "STICKY" || tool === "REACTION",
				[styles.localCursorEraser]: tool === "ERASER",
				[styles.localCursorLaser]: tool === "LASER",
			})}
			style={{
				left: `${x * 100}%`,
				top: `${y * 100}%`,
				"--local-cursor-color": color,
				"--local-cursor-size": `${Math.max(12, width * (tool === "ERASER" ? 2.4 : 1.8))}px`,
			} as CSSProperties}
			aria-hidden="true"
		/>
	);
}
