import type { AttachmentType, AttachmentValidationError } from "../api/interfaces/MessageAttachmentDtos";

export const MAX_ATTACHMENT_FILES = 10;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function getAttachmentType(file: File): AttachmentType | null {
	if (ALLOWED_IMAGE_TYPES.has(file.type)) return "IMAGE";
	if (ALLOWED_VIDEO_TYPES.has(file.type)) return "VIDEO";
	return null;
}

export function validateAttachmentFile(file: File): AttachmentValidationError | null {
	const type = getAttachmentType(file);

	if (!type) {
		return {
			fileName: file.name,
			message: "Можно прикреплять только JPEG, PNG, WebP, GIF, MP4, WebM или MOV.",
		};
	}

	const maxSize = type === "IMAGE" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
	const maxSizeMb = type === "IMAGE" ? 10 : 100;

	if (file.size > maxSize) {
		return {
			fileName: file.name,
			message: `${type === "IMAGE" ? "Изображение" : "Видео"} больше ${maxSizeMb} MB.`,
		};
	}

	return null;
}
