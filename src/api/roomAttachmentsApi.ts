import { api } from './api';
import type { MessageAttachment } from './interfaces/MessageAttachmentDtos';

export type AttachmentCategory = 'all' | 'media' | 'image' | 'video' | 'document' | 'audio';
export interface RoomAttachmentItem {
  attachment: MessageAttachment;
  messageId: number;
  sentAt: string;
  authorId: number;
  authorName: string;
}
export interface AttachmentPage { items: RoomAttachmentItem[]; nextCursor: string | null }
export interface AttachmentFilters { category: AttachmentCategory; filenameQuery: string; sortDirection: 'asc' | 'desc' }
export const roomAttachmentsApi = {
  list: (roomId: number, filters: AttachmentFilters, cursor: string | null, signal: AbortSignal) =>
    api.get<AttachmentPage>(`/rooms/${roomId}/attachments`, { params: { ...filters, cursor, limit: 40 }, signal, timeout: 15000 }),
};
