export interface CallUiProps {
	hasChat: boolean;
	isFocusMode: boolean;
	onHide: () => void;
	onOpenChat: () => void;
	onMinimize: () => void;
	onToggleFocus: () => void;
}
