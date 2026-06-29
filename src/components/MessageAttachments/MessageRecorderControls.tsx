import { Mic, Send, Square, Trash2, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttachmentType } from "../../api/interfaces/MessageAttachmentDtos";
import { useVideoNoteRecorder } from "../../hooks/useVideoNoteRecorder";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import styles from "./MessageAttachments.module.css";

interface MessageRecorderControlsProps {
	disabled?: boolean;
	onSendRecorded: (payload: {
		file: File;
		attachmentType: Extract<AttachmentType, "AUDIO" | "VIDEO_NOTE">;
		durationMs: number;
	}) => Promise<void>;
}

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function MessageRecorderControls({
	disabled = false,
	onSendRecorded,
}: MessageRecorderControlsProps) {
	const [activeRecorder, setActiveRecorder] = useState<"voice" | "video" | null>(null);
	const [isSending, setIsSending] = useState(false);
	const voiceRecorder = useVoiceRecorder();
	const videoRecorder = useVideoNoteRecorder();
	const liveVideoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		if (liveVideoRef.current) {
			liveVideoRef.current.srcObject = videoRecorder.liveStream;
		}
	}, [videoRecorder.liveStream]);

	const setLiveVideoElement = useCallback((element: HTMLVideoElement | null) => {
		liveVideoRef.current = element;
		if (element) element.srcObject = videoRecorder.liveStream;
	}, [videoRecorder.liveStream]);

	const startVoice = () => {
		if (disabled || activeRecorder) return;
		setActiveRecorder("voice");
		void voiceRecorder.start();
	};

	const startVideo = () => {
		if (disabled || activeRecorder) return;
		setActiveRecorder("video");
		void videoRecorder.start();
	};

	const closeVoice = () => {
		voiceRecorder.cancel();
		setActiveRecorder(null);
	};

	const closeVideo = () => {
		videoRecorder.cancel();
		setActiveRecorder(null);
	};

	const sendVoice = async () => {
		if (!voiceRecorder.file) return;
		setIsSending(true);
		try {
			await onSendRecorded({
				file: voiceRecorder.file,
				attachmentType: "AUDIO",
				durationMs: voiceRecorder.durationMs,
			});
			voiceRecorder.reset();
			setActiveRecorder(null);
		} catch {
			// Toast is shown by the parent; keep the preview so the user can retry.
		} finally {
			setIsSending(false);
		}
	};

	const sendVideo = async () => {
		if (!videoRecorder.file) return;
		setIsSending(true);
		try {
			await onSendRecorded({
				file: videoRecorder.file,
				attachmentType: "VIDEO_NOTE",
				durationMs: videoRecorder.durationMs,
			});
			videoRecorder.reset();
			setActiveRecorder(null);
		} catch {
			// Toast is shown by the parent; keep the preview so the user can retry.
		} finally {
			setIsSending(false);
		}
	};

	const videoNoteModal = activeRecorder === "video" ? (
		<div className={styles["video-note-modal"]}>
			<div className={styles["video-note-card"]}>
				<div className={styles["recorder-header"]}>
					<span className={styles["recording-dot"]} />
					<strong>Видео-кружок</strong>
					<span>{formatDuration(videoRecorder.durationMs)}</span>
				</div>

				<div className={styles["video-note-preview"]}>
					{videoRecorder.status === "recording" ? (
						<video ref={setLiveVideoElement} autoPlay muted playsInline />
					) : videoRecorder.previewUrl ? (
						<video
							key={videoRecorder.previewUrl}
							src={videoRecorder.previewUrl}
							controls
							autoPlay
							muted
							loop
							playsInline
							preload="metadata"
						/>
					) : (
						<div className={styles["video-note-placeholder"]}>Камера</div>
					)}
				</div>

				{videoRecorder.status === "recording" && (
					<div className={styles["recorder-actions"]}>
						<button type="button" onClick={videoRecorder.stop}>
							<Square size={16} />
							Остановить
						</button>
						<button type="button" onClick={closeVideo}>
							<Trash2 size={16} />
							Отменить
						</button>
					</div>
				)}

				{videoRecorder.status === "stopped" && videoRecorder.previewUrl && (
					<div className={styles["recorder-actions"]}>
						<button type="button" onClick={() => void sendVideo()} disabled={isSending}>
							<Send size={16} />
							Отправить
						</button>
						<button type="button" onClick={closeVideo}>
							<Trash2 size={16} />
							Удалить
						</button>
					</div>
				)}

				{videoRecorder.error && (
					<div className={styles["recorder-error"]}>{videoRecorder.error}</div>
				)}
			</div>
		</div>
	) : null;

	return (
		<>
			<button
				type="button"
				className={styles["picker-button"]}
				disabled={disabled || activeRecorder !== null}
				title="Записать голосовое"
				aria-label="Записать голосовое"
				onClick={startVoice}
			>
				<Mic size={19} />
			</button>
			<button
				type="button"
				className={styles["picker-button"]}
				disabled={disabled || activeRecorder !== null}
				title="Записать видео-кружок"
				aria-label="Записать видео-кружок"
				onClick={startVideo}
			>
				<Video size={19} />
			</button>

			{activeRecorder === "voice" && (
				<div className={styles["recorder-panel"]}>
					<div className={styles["recorder-header"]}>
						<span className={styles["recording-dot"]} />
						<strong>Голосовое</strong>
						<span>{formatDuration(voiceRecorder.durationMs)}</span>
					</div>

					{voiceRecorder.status === "recording" && (
						<div className={styles["recorder-actions"]}>
							<button type="button" onClick={voiceRecorder.stop}>
								<Square size={16} />
								Остановить
							</button>
							<button type="button" onClick={closeVoice}>
								<Trash2 size={16} />
								Отменить
							</button>
						</div>
					)}

					{voiceRecorder.status === "stopped" && voiceRecorder.previewUrl && (
						<>
							<audio src={voiceRecorder.previewUrl} controls preload="metadata" />
							<div className={styles["recorder-actions"]}>
								<button type="button" onClick={() => void sendVoice()} disabled={isSending}>
									<Send size={16} />
									Отправить
								</button>
								<button type="button" onClick={closeVoice}>
									<Trash2 size={16} />
									Удалить
								</button>
							</div>
						</>
					)}

					{voiceRecorder.error && (
						<div className={styles["recorder-error"]}>{voiceRecorder.error}</div>
					)}
				</div>
			)}

			{videoNoteModal && createPortal(videoNoteModal, document.body)}
		</>
	);
}
