export type AttachmentType = "IMAGE" | "VIDEO" | "AUDIO" | "VIDEO_NOTE";

export interface MessageAttachment {
	id: number;
	type: AttachmentType;
	url?: string | null;
	downloadUrl?: string | null;
	originalFileName: string;
	contentType: string;
	sizeBytes: number;
	width?: number | null;
	height?: number | null;
	durationMs?: number | null;
	waveform?: number[] | null;
}

export interface SelectedMessageAttachment {
	id: string;
	file: File;
	type: AttachmentType;
	previewUrl: string;
}

export interface AttachmentValidationError {
	fileName: string;
	message: string;
}

export interface SendMessageWithAttachmentsPayload {
	content?: string;
	files: File[];
	replyToMessageId?: number | null;
	attachmentType?: AttachmentType;
	durationMs?: number | null;
}
