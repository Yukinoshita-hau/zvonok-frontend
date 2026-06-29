import { FileVideo, X } from "lucide-react";
import type { AttachmentValidationError, SelectedMessageAttachment } from "../../api/interfaces/MessageAttachmentDtos";
import styles from "./MessageAttachments.module.css";

interface SelectedAttachmentsPreviewProps {
	attachments: SelectedMessageAttachment[];
	errors: AttachmentValidationError[];
	onRemove: (id: string) => void;
	onClearError?: () => void;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SelectedAttachmentsPreview({
	attachments,
	errors,
	onRemove,
	onClearError,
}: SelectedAttachmentsPreviewProps) {
	if (attachments.length === 0 && errors.length === 0) return null;

	return (
		<div className={styles["selected-panel"]}>
			{errors.length > 0 && (
				<div className={styles["validation-list"]}>
					{errors.map((error) => (
						<div key={`${error.fileName}-${error.message}`} className={styles["validation-error"]}>
							<span>{error.message}</span>
							{onClearError && (
								<button type="button" onClick={onClearError} aria-label="Скрыть ошибку">
									<X size={14} />
								</button>
							)}
						</div>
					))}
				</div>
			)}

			{attachments.length > 0 && (
				<div className={styles["selected-grid"]}>
					{attachments.map((attachment) => (
						<div key={attachment.id} className={styles["selected-card"]}>
							{attachment.type === "IMAGE" ? (
								<img src={attachment.previewUrl} alt={attachment.file.name} />
							) : (
								<div className={styles["video-preview"]}>
									<video src={attachment.previewUrl} muted preload="metadata" />
									<FileVideo size={20} />
								</div>
							)}
							<div className={styles["selected-meta"]}>
								<span>{attachment.file.name}</span>
								<small>{formatFileSize(attachment.file.size)}</small>
							</div>
							<button
								type="button"
								className={styles["remove-selected"]}
								onClick={() => onRemove(attachment.id)}
								aria-label="Удалить вложение"
							>
								<X size={14} />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
