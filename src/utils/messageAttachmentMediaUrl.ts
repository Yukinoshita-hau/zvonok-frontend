import { resolveMediaUrl } from "./mediaUrl";

export function resolveAttachmentUrl(url?: string | null): string {
	return resolveMediaUrl(url);
}
