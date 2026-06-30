import React from "react";
import { MessageSquare, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { MicrophoneToggleButton } from "./MicrophoneToggleButton";
import { CallControlButton } from "./CallControlButton";
import { CallTrackToggleButton } from "./CallTrackToggleButton";
import { CallViewModeMenu } from "./CallViewModeMenu";
import { CallMoreMenu } from "./CallMoreMenu";
import { CallInteractiveMenu } from "./CallInteractiveMenu";
import { CallDeviceSelectButton } from "./CallDeviceSelectButton";
import styles from "./CallUi.module.css";
import type { CallControlsProps } from "./CallControls.props";

export const CallControls = React.memo(function CallControls({
	hasChat,
	isFocusMode,
	isCinemaMode,
	canOpenCinema,
	cameras,
	microphones,
	selectedCameraId,
	selectedMicrophoneId,
	cameraCaptureOptions,
	cameraPublishOptions,
	screenShareCaptureOptions,
	screenSharePublishOptions,
	onOpenChat,
	onOpenWhiteboard,
	onOpenCodeSession,
	onToggleScreenOverlay,
	onToggleFocus,
	onToggleCinema,
	onMinimize,
	onHide,
	onLeave,
	canUseWhiteboard = true,
	isWhiteboardOpen = false,
	isCodeSessionOpen = false,
	canUseScreenOverlay = false,
	isScreenOverlayOpen = false,
}: CallControlsProps) {
	return (
		<div className={styles["controls-bar"]} aria-label="Управление звонком">
			<div className={styles["controls-primary-group"]}>
				<div className={styles["device-control"]}>
					<CallDeviceSelectButton
						kind="microphone"
						devices={microphones}
						selectedDeviceId={selectedMicrophoneId}
					/>
					<MicrophoneToggleButton
						className={styles["control-button"]}
						enabledLabel=""
						disabledLabel=""
						showIcon
						iconSize={18}
					/>
				</div>

				<div className={styles["device-control"]}>
					<CallDeviceSelectButton
						kind="camera"
						devices={cameras}
						selectedDeviceId={selectedCameraId}
					/>
					<CallTrackToggleButton
						kind="camera"
						enabledIcon={Video}
						disabledIcon={VideoOff}
						label="Камера"
						enabledTitle="Камера включена"
						disabledTitle="Камера выключена"
						captureOptions={cameraCaptureOptions}
						publishOptions={cameraPublishOptions}
					/>
				</div>

				<CallTrackToggleButton
					kind="screenShare"
					enabledIcon={MonitorUp}
					disabledIcon={MonitorUp}
					label="Экран"
					enabledTitle="Остановить демонстрацию экрана"
					disabledTitle="Показать экран. Звук передаётся, если это поддерживают браузер и выбранное окно"
					captureOptions={screenShareCaptureOptions}
					publishOptions={screenSharePublishOptions}
				/>

				{hasChat && (
					<CallControlButton
						icon={<MessageSquare size={18} />}
						label="Чат"
						onClick={onOpenChat}
						title="Открыть чат звонка"
					/>
				)}

				<CallInteractiveMenu
					canUseWhiteboard={canUseWhiteboard}
					isWhiteboardOpen={isWhiteboardOpen}
					isCodeSessionOpen={isCodeSessionOpen}
					canUseScreenOverlay={canUseScreenOverlay}
					isScreenOverlayOpen={isScreenOverlayOpen}
					onOpenWhiteboard={onOpenWhiteboard}
					onOpenCodeSession={onOpenCodeSession}
					onToggleScreenOverlay={onToggleScreenOverlay}
				/>
			</div>

			<div className={styles["controls-secondary-group"]}>
				<CallViewModeMenu
					isFocusMode={isFocusMode}
					isCinemaMode={isCinemaMode}
					canOpenCinema={canOpenCinema}
					onToggleFocus={onToggleFocus}
					onToggleCinema={onToggleCinema}
					onMinimize={onMinimize}
				/>

				<CallMoreMenu onHide={onHide} />

				<CallControlButton
					className={styles["leave-button"]}
					icon={<PhoneOff size={20} />}
					label="Завершить"
					isDanger
					onClick={onLeave}
					title="Завершить звонок"
				/>
			</div>
		</div>
	);
});
