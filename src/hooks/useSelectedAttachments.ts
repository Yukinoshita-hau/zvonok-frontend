import { useCallback, useEffect, useRef, useState } from "react";
import type { AttachmentValidationError, SelectedMessageAttachment } from "../api/interfaces/MessageAttachmentDtos";
import { getAttachmentType, MAX_ATTACHMENT_FILES, validateAttachmentFile } from "../utils/messageAttachmentValidation";

function createAttachmentId(file: File): string {
	return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

export function useSelectedAttachments() {
	const [attachments, setAttachments] = useState<SelectedMessageAttachment[]>([]);
	const [errors, setErrors] = useState<AttachmentValidationError[]>([]);
	const attachmentsRef = useRef<SelectedMessageAttachment[]>([]);

	const updateAttachments = useCallback((nextAttachments: SelectedMessageAttachment[]) => {
		attachmentsRef.current = nextAttachments;
		setAttachments(nextAttachments);
	}, []);

	const addFiles = useCallback((files: FileList | File[]) => {
		const fileArray = Array.from(files);
		const nextErrors: AttachmentValidationError[] = [];
		const nextAttachments: SelectedMessageAttachment[] = [];
		const currentAttachments = attachmentsRef.current;
		const freeSlots = Math.max(0, MAX_ATTACHMENT_FILES - currentAttachments.length);

		if (fileArray.length > freeSlots) {
			nextErrors.push({
				fileName: "attachments",
				message: `Можно выбрать максимум ${MAX_ATTACHMENT_FILES} файлов.`,
			});
		}

		for (const file of fileArray.slice(0, freeSlots)) {
			const validationError = validateAttachmentFile(file);
			if (validationError) {
				nextErrors.push(validationError);
				continue;
			}

			const type = getAttachmentType(file);
			if (!type) continue;

			nextAttachments.push({
				id: createAttachmentId(file),
				file,
				type,
				previewUrl: URL.createObjectURL(file),
			});
		}

		if (nextAttachments.length > 0) {
			const updated = [...currentAttachments, ...nextAttachments];
			attachmentsRef.current = updated;
			setAttachments(updated);
		}

		setErrors(nextErrors);
	}, []);

	const removeAttachment = useCallback((id: string) => {
		const removed = attachmentsRef.current.find((item) => item.id === id);
		if (removed) URL.revokeObjectURL(removed.previewUrl);

		updateAttachments(attachmentsRef.current.filter((item) => item.id !== id));
	}, [updateAttachments]);

	const clearAttachments = useCallback(() => {
		attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
		updateAttachments([]);
		setErrors([]);
	}, [updateAttachments]);

	useEffect(() => {
		return () => {
			attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
		};
	}, []);

	return {
		attachments,
		errors,
		addFiles,
		removeAttachment,
		clearAttachments,
		clearErrors: () => setErrors([]),
	};
}
