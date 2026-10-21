import { api } from "./api";
import type { ShortMessageResponse } from "../entities/shortMessage";
import type { SendMessageWithAttachmentsPayload } from "./interfaces/MessageAttachmentDtos";
import type { MessageAttachment } from './interfaces/MessageAttachmentDtos';
import type { MediaAccess } from './MediaAccessClient';

export const messageAttachmentsApi = {
	sendMessageWithAttachments: async (
		roomId: number,
		payload: SendMessageWithAttachmentsPayload
	): Promise<ShortMessageResponse> => {
		const formData = new FormData();
		formData.append("clientRequestId", payload.clientRequestId ?? crypto.randomUUID());

		if (payload.content?.trim()) {
			formData.append("content", payload.content.trim());
		}

		if (payload.replyToMessageId != null) {
			formData.append("replyToMessageId", String(payload.replyToMessageId));
		}

		payload.files.forEach((file) => {
			formData.append("files", file);
		});

		if (payload.attachmentType) {
			formData.append("attachmentType", payload.attachmentType);
		}

		if (payload.durationMs != null) {
			formData.append("durationMs", String(payload.durationMs));
		}

		const { data } = await api.post<ShortMessageResponse>(
			`/rooms/${roomId}/messages/attachments`,
			formData
		);

		return data;
	},

	downloadAttachmentBlob: async (url: string, signal?: AbortSignal): Promise<Blob> => {
		const { data } = await api.get<Blob>(toApiPath(url), { responseType: "blob", signal });
		return data;
	},
};

export async function downloadAttachmentOriginal(attachment: MessageAttachment, signal?: AbortSignal) {
	let objectUrl = '';
	let url: string;
	if (import.meta.env.VITE_PRIVATE_MEDIA_STREAMING === 'true') {
		const { data } = await api.post<MediaAccess>(`/message-attachments/${attachment.id}/download-access`, undefined, { signal });
		url = data.url;
	} else {
		const blob = await messageAttachmentsApi.downloadAttachmentBlob(`/message-attachments/${attachment.id}/download`, signal);
		url = objectUrl = URL.createObjectURL(blob);
	}
	if (!signal?.aborted) {
		const link = document.createElement('a');
		link.href = url; link.download = attachment.originalFileName || 'file'; link.referrerPolicy = 'no-referrer';
		document.body.append(link); link.click(); link.remove();
	}
	if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function toApiPath(url: string): string {
	if (!/^https?:\/\//i.test(url)) return stripApiPrefix(url);

	try {
		const parsed = new URL(url);
		return `${stripApiPrefix(parsed.pathname)}${parsed.search}`;
	} catch {
		return stripApiPrefix(url);
	}
}

function stripApiPrefix(path: string): string {
	return path.startsWith("/api/") ? path.slice(4) : path;
}
