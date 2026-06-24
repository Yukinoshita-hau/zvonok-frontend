export interface CinemaModeOverlayControlsProps {
	displayName: string;
	onExit: () => void;
	onToggleScreenOverlay?: () => void;
	isScreenOverlayOpen?: boolean;
	canUseScreenOverlay?: boolean;
}
