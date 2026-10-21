import type { AttachmentType, AttachmentValidationError } from "../api/interfaces/MessageAttachmentDtos";

export const MAX_ATTACHMENT_FILES = 10;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_ATTACHMENT_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'md', 'json', 'csv', 'docx', 'xlsx', 'pptx', 'zip'];

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"]);

export function getAttachmentType(file: File): AttachmentType | null {
	if (ALLOWED_IMAGE_TYPES.has(file.type)) return "IMAGE";
	if (ALLOWED_VIDEO_TYPES.has(file.type)) return "VIDEO";
	if (ALLOWED_AUDIO_TYPES.has(file.type)) return "AUDIO";
	if (DOCUMENT_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() ?? '')) return "FILE";
	return null;
}

export function validateAttachmentFile(file: File, existingBytes = 0): AttachmentValidationError | null {
	const type = getAttachmentType(file);

	if (!type) {
		return {
			fileName: file.name,
			message: "Поддерживаются изображения, аудио, видео, PDF, TXT, MD, JSON, CSV, DOCX, XLSX, PPTX и ZIP.",
		};
	}

	const text = ['txt', 'md', 'json', 'csv'].includes(file.name.split('.').pop()?.toLowerCase() ?? '');
	const maxSizeMb = type === 'FILE' ? text ? 5 : 50 : type === 'IMAGE' ? 10 : type === 'AUDIO' ? 25 : 50;
	const maxSize = maxSizeMb * 1024 * 1024;

	if (file.size > maxSize) {
		return {
			fileName: file.name,
			message: `Файл больше ${maxSizeMb} MiB.`,
		};
	}

    if (existingBytes + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
        return { fileName: file.name, message: 'Суммарный размер вложений больше 50 MiB.' };
    }
	return null;
}
