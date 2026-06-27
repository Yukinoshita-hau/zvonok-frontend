import { CanvasInteractiveApp } from "../CallCanvas/CanvasInteractiveApp/CanvasInteractiveApp";
import type { InteractiveHostProps } from "./InteractiveHost.types";

export function InteractiveHost({
	callId,
	isWebSocketConnected,
	isFocusMode,
	focusedMediaCardId,
	currentUsername,
	currentUserId,
	isCurrentUserHost,
	focusedScreenShareCard,
	participantOptions,
	whiteboardTileClassName,
	onRequestFocusMode,
	onResetFocusMode,
	children,
}: InteractiveHostProps) {
	return (
		<CanvasInteractiveApp
			callId={callId}
			isWebSocketConnected={isWebSocketConnected}
			isFocusMode={isFocusMode}
			focusedMediaCardId={focusedMediaCardId}
			currentUsername={currentUsername}
			currentUserId={currentUserId}
			isCurrentUserHost={isCurrentUserHost}
			focusedScreenShareCard={focusedScreenShareCard}
			participantOptions={participantOptions}
			whiteboardTileClassName={whiteboardTileClassName}
			onRequestFocusMode={onRequestFocusMode}
			onResetFocusMode={onResetFocusMode}
		>
			{children}
		</CanvasInteractiveApp>
	);
}
