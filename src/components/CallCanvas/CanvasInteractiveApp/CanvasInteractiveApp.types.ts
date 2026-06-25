import type { ReactNode } from "react";
import type { CanvasParticipantOption } from "../CallCanvas.types";
import type { ParticipantCard } from "../../CallUi/hooks/useCallParticipants";

export interface CanvasInteractiveAppContext {
	hasWhiteboard: boolean;
	isWhiteboardFocused: boolean;
	canUseWhiteboard: boolean;
	canUseScreenOverlay: boolean;
	isScreenOverlayOpen: boolean;
	whiteboardTiles: ReactNode[];
	openWhiteboard: () => void;
	toggleScreenOverlay: () => void;
	renderWhiteboardFocus: () => ReactNode;
	renderScreenShareOverlay: () => ReactNode;
}

export interface CanvasInteractiveAppProps {
	callId: number | null;
	isWebSocketConnected: boolean;
	isFocusMode: boolean;
	focusedMediaCardId: string | null;
	currentUsername?: string | null;
	focusedScreenShareCard: ParticipantCard | null;
	participantOptions: CanvasParticipantOption[];
	whiteboardTileClassName?: string;
	onRequestFocusMode: () => void;
	onResetFocusMode: () => void;
	children: (context: CanvasInteractiveAppContext) => ReactNode;
}
