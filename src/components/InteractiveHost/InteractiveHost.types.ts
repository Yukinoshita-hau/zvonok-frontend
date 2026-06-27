import type { ReactNode } from "react";
import type { CanvasParticipantOption } from "../CallCanvas/CallCanvas.types";
import type { ParticipantCard } from "../CallUi/hooks/useCallParticipants";

export interface InteractiveHostContext {
	hasWhiteboard: boolean;
	isWhiteboardFocused: boolean;
	canUseWhiteboard: boolean;
	canUseScreenOverlay: boolean;
	isScreenOverlayOpen: boolean;
	isCodeSessionOpen: boolean;
	whiteboardTiles: ReactNode[];
	interactiveTiles: ReactNode[];
	openWhiteboard: () => void;
	openCodeSession: () => void;
	closeCodeSession: () => void;
	toggleScreenOverlay: () => void;
	renderWhiteboardFocus: () => ReactNode;
	renderCodeSession: () => ReactNode;
	renderScreenShareOverlay: () => ReactNode;
}

export interface InteractiveHostProps {
	callId: number | null;
	isWebSocketConnected: boolean;
	isFocusMode: boolean;
	focusedMediaCardId: string | null;
	currentUsername?: string | null;
	currentUserId?: number | string | null;
	isCurrentUserHost?: boolean;
	focusedScreenShareCard: ParticipantCard | null;
	participantOptions: CanvasParticipantOption[];
	whiteboardTileClassName?: string;
	onRequestFocusMode: () => void;
	onResetFocusMode: () => void;
	children: (context: InteractiveHostContext) => ReactNode;
}
