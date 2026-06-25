import type { CanvasBoardSessionDto } from "../../../api/interfaces/CanvasDtos";
import type { CanvasParticipantOption } from "../CallCanvas.types";

export type CanvasBackgroundMode = "grid" | "dots" | "clean" | "dark";

export interface DrawableCanvasProps {
	callId: number;
	board: CanvasBoardSessionDto;
	canDraw: boolean;
	currentUsername?: string | null;
	managerUsername?: string | null;
	participantOptions?: CanvasParticipantOption[];
	variant?: "whiteboard" | "overlay";
	onExit: () => void;
}
