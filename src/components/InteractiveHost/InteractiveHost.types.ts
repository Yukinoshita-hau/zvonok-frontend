import type { ReactNode } from "react";
import type { CanvasParticipantOption } from "../CallCanvas/CallCanvas.types";
import type { ParticipantCard } from "../CallUi/hooks/useCallParticipants";

export interface InteractiveHostContext {
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

export interface InteractiveHostProps {
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
	children: (context: InteractiveHostContext) => ReactNode;
}
