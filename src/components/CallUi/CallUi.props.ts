export interface CallUiProps {
  hasChat: boolean;
  visible: boolean;
  isFocusMode: boolean;
  isCinemaMode: boolean;
  onHide: () => void;
  onMinimize: () => void;
  onToggleCinema: () => void;
}
