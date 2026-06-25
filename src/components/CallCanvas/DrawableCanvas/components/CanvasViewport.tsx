import type { CSSProperties, ReactNode } from "react";
import cn from "classnames";
import { CanvasTemplateLayer } from "../../CanvasTemplateLayer/CanvasTemplateLayer";
import type { CanvasTemplateType } from "../../../../api/interfaces/CanvasDtos";
import type { CanvasBackgroundMode } from "../DrawableCanvas.types";
import styles from "../DrawableCanvas.module.css";

interface CanvasViewportProps {
	variant: "whiteboard" | "overlay";
	backgroundMode: CanvasBackgroundMode;
	templateType: CanvasTemplateType;
	backgroundImageUrl?: string | null;
	backgroundImageOpacity: number;
	isOverlayHidden: boolean;
	overlayOpacity: number;
	drawingOpacity: number;
	children: ReactNode;
}

export function CanvasViewport({
	variant,
	backgroundMode,
	templateType,
	backgroundImageUrl,
	backgroundImageOpacity,
	isOverlayHidden,
	overlayOpacity,
	drawingOpacity,
	children,
}: CanvasViewportProps) {
	return (
		<div
			className={cn(styles.root, styles[variant], styles[backgroundMode], {
				[styles.overlayHidden]: variant === "overlay" && isOverlayHidden,
			})}
			style={{
				"--canvas-overlay-opacity": overlayOpacity,
				"--canvas-drawing-opacity": drawingOpacity,
			} as CSSProperties}
		>
			<CanvasTemplateLayer
				templateType={templateType}
				backgroundImageUrl={backgroundImageUrl}
				backgroundImageOpacity={backgroundImageOpacity}
			/>
			{children}
		</div>
	);
}
