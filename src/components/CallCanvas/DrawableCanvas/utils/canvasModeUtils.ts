import type { CanvasTemplateType } from "../../../../api/interfaces/CanvasDtos";
import type { CanvasBackgroundMode } from "../DrawableCanvas.types";

export function getCanvasTemplateType(
	boardTemplateType: CanvasTemplateType | null | undefined,
	backgroundMode: CanvasBackgroundMode
): CanvasTemplateType {
	if (boardTemplateType) return boardTemplateType;
	if (backgroundMode === "grid") return "GRID";
	if (backgroundMode === "clean") return "CLEAN";
	if (backgroundMode === "dark") return "CLEAN";
	return "DOTS";
}
