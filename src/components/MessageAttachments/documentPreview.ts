import type { MessageAttachment } from '../../api/interfaces/MessageAttachmentDtos';

export const TEXT_PREVIEW_BYTES = 256 * 1024;
export function previewKind(attachment: MessageAttachment) {
  const mime = attachment.contentType?.split(';')[0].trim().toLowerCase();
  if ((attachment.type === 'VIDEO' || attachment.type === 'VIDEO_NOTE') && ['video/mp4', 'video/webm', 'video/quicktime'].includes(mime)) return 'media';
  if (attachment.type === 'AUDIO' && ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm'].includes(mime)) return 'media';
  if (attachment.type === 'IMAGE' && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) return 'image';
  if (attachment.type === 'FILE' && mime === 'application/pdf') return 'pdf';
  if (attachment.type === 'FILE' && ['text/plain', 'text/markdown', 'text/csv', 'application/json'].includes(mime)) return 'text';
  return 'download';
}

export async function readTextPreview(response: Response, limit = TEXT_PREVIEW_BYTES) {
  if (!response.ok || !response.body) throw Error('Файл недоступен');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', size = 0;
  try {
    while (size < limit) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      const chunk = value.subarray(0, limit - size);
      text += decoder.decode(chunk, { stream: true });
      size += chunk.length;
    }
    // The last codepoint may straddle the preview boundary; never decode a partial UTF-8 sequence.
    return text;
  } finally { await reader.cancel(); reader.releaseLock(); }
}
