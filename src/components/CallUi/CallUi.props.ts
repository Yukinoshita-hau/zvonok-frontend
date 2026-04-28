export interface CallUiProps {
	hasChat: boolean;
	isFocusMode: boolean;
	isCinemaMode: boolean;
	onHide: () => void;
	onOpenChat: () => void;
	onMinimize: () => void;
	onToggleFocus: () => void;
	onToggleCinema: () => void;
}
