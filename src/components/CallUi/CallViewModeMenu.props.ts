export interface CallViewModeMenuProps {
	isFocusMode: boolean;
	isCinemaMode: boolean;
	canOpenCinema: boolean;
	onToggleFocus: () => void;
	onToggleCinema: () => void;
	onMinimize: () => void;
}
