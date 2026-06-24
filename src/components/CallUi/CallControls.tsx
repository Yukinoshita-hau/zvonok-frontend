import React from "react";
import { Brush, MessageSquare, MonitorUp, PenLine, PhoneOff, Video, VideoOff } from "lucide-react";
import { MicrophoneToggleButton } from "./MicrophoneToggleButton";
import { CallControlButton } from "./CallControlButton";
import { CallTrackToggleButton } from "./CallTrackToggleButton";
import { CallViewModeMenu } from "./CallViewModeMenu";
import { CallMoreMenu } from "./CallMoreMenu";
import styles from "./CallUi.module.css";
import type { CallControlsProps } from "./CallControls.props";

export const CallControls = React.memo(function CallControls({
	hasChat,
	isFocusMode,
	isCinemaMode,
	canOpenCinema,
	cameraCaptureOptions,
	cameraPublishOptions,
	screenShareCaptureOptions,
	screenSharePublishOptions,
	onOpenChat,
	onOpenWhiteboard,
	onToggleScreenOverlay,
	onToggleFocus,
	onToggleCinema,
	onMinimize,
	onHide,
	onLeave,
	canUseWhiteboard = true,
	isWhiteboardOpen = false,
	canUseScreenOverlay = false,
	isScreenOverlayOpen = false,
}: CallControlsProps) {
	return (
		<div className={styles["controls-bar"]} aria-label="Управление звонком">
			<div className={styles["controls-primary-group"]}>
				<MicrophoneToggleButton
					className={styles["control-button"]}
					enabledLabel=""
					disabledLabel=""
					showIcon
					iconSize={18}
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

				<CallControlButton
					icon={<Brush size={18} />}
					label="Доска"
					isActive={isWhiteboardOpen}
					onClick={onOpenWhiteboard}
					disabled={!canUseWhiteboard}
					title={canUseWhiteboard ? "Открыть доску" : "Доска доступна после подключения к звонку"}
				/>

				<CallControlButton
					icon={<PenLine size={18} />}
					label="Разметка"
					isActive={isScreenOverlayOpen}
					onClick={onToggleScreenOverlay}
					disabled={!canUseScreenOverlay}
					title={canUseScreenOverlay
						? (isScreenOverlayOpen ? "Скрыть инструменты" : "Открыть инструменты")
						: "Сначала откройте трансляцию экрана в фокусе"}
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
