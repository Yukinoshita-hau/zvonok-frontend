export interface CallInteractiveMenuProps {
	canUseWhiteboard: boolean;
	isWhiteboardOpen: boolean;
	isCodeSessionOpen: boolean;
	canUseScreenOverlay: boolean;
	isScreenOverlayOpen: boolean;
	onOpenWhiteboard: () => void;
	onOpenCodeSession: () => void;
	onToggleScreenOverlay: () => void;
}
