import { api } from "./api";
import type { ShortMessageResponse } from "../entities/shortMessage";
import type { SendMessageWithAttachmentsPayload } from "./interfaces/MessageAttachmentDtos";

export const messageAttachmentsApi = {
	sendMessageWithAttachments: async (
		roomId: number,
		payload: SendMessageWithAttachmentsPayload
	): Promise<ShortMessageResponse> => {
		const formData = new FormData();

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

	downloadAttachmentBlob: async (url: string): Promise<Blob> => {
		const { data } = await api.get<Blob>(toApiPath(url), { responseType: "blob" });
		return data;
	},
};

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
