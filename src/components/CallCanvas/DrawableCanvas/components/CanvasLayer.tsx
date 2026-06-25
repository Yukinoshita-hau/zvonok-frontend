import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import cn from "classnames";
import type { CanvasInteractionTool } from "../../../../api/interfaces/CanvasDtos";
import styles from "../DrawableCanvas.module.css";

interface CanvasLayerProps {
	canvasRef: RefObject<HTMLCanvasElement>;
	tool: CanvasInteractionTool;
	canDraw: boolean;
	isDrawing: boolean;
	onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
	onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
	onPointerUp: () => void;
	onPointerLeave: () => void;
	onPointerCancel: () => void;
}

export function CanvasLayer({
	canvasRef,
	tool,
	canDraw,
	isDrawing,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerLeave,
	onPointerCancel,
}: CanvasLayerProps) {
	return (
		<canvas
			ref={canvasRef}
			className={cn(styles.canvas, {
				[styles.eraser]: tool === "ERASER",
				[styles.disabled]: !canDraw,
				[styles.localCursorEnabled]: canDraw,
				[styles.drawing]: isDrawing,
			})}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerLeave={onPointerLeave}
			onPointerCancel={onPointerCancel}
		/>
	);
}
