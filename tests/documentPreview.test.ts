import { expect, it } from 'vitest';
import { previewKind, readTextPreview } from '../src/components/MessageAttachments/documentPreview';
import { getAttachmentType, validateAttachmentFile } from '../src/utils/messageAttachmentValidation';
import type { MessageAttachment } from '../src/api/interfaces/MessageAttachmentDtos';
import { isMessage } from '../src/store/middlewares/websocket/payloadValidation';

const file = (contentType: string, type = 'FILE') => ({ type, contentType, originalFileName: 'file.pdf' } as MessageAttachment);
it('accepts FILE messages received through STOMP while rejecting unknown attachment types', () => {
  const message = { id: 1, type: 'DEFAULT', eventType: 'MESSAGE', content: '', sentAt: '2026-10-19T10:00:00', editedAt: null, replyToMessageId: null, replyPreview: null,
    sender: { id: 1, username: 'alice', displayName: 'Alice', status: 'ONLINE', avatarUrl: null }, room: { id: 1, type: 'GROUP' },
    attachments: [{ ...file('application/pdf'), id: 7, sizeBytes: 200 }] };
  expect(isMessage(message)).toBe(true);
  expect(isMessage({ ...message, attachments: [{ ...message.attachments[0], type: 'EXECUTABLE' }] })).toBe(false);
});
it('selects previews only by trusted DTO type and MIME, with legacy missing metadata fallback', () => {
  expect(previewKind(file('application/pdf'))).toBe('pdf');
  expect(previewKind(file('text/markdown'))).toBe('text');
  expect(previewKind(file('image/webp', 'IMAGE'))).toBe('image');
  for (const mime of ['text/html', 'image/svg+xml', '', 'application/zip']) expect(previewKind(file(mime))).toBe('download');
  expect(previewKind(file('application/pdf', 'VIDEO'))).toBe('download');
});
it('bounds streaming text even when the server ignores Range, and cancels the reader', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('<script>hello</script>')); }, cancel() { cancelled = true; } }));
  expect(await readTextPreview(response, 8)).toBe('<script>'); expect(cancelled).toBe(true);
});
it('preserves raw text, rejects invalid UTF-8 and unavailable files', async () => {
  expect(await readTextPreview(new Response('Привет\n<script>raw</script>'))).toBe('Привет\n<script>raw</script>');
  await expect(readTextPreview(new Response(new Uint8Array([255])))).rejects.toThrow();
  await expect(readTextPreview(new Response('', { status: 404 }))).rejects.toThrow('Файл недоступен');
});
it('supports FILE input and enforces text/document size boundaries before upload', () => {
  const input = (name: string, size: number) => ({ name, size, type: '' } as File);
  for (const extension of ['pdf', 'txt', 'md', 'json', 'csv', 'docx', 'xlsx', 'pptx', 'zip']) {
    expect(getAttachmentType(input('file.' + extension, 50))).toBe('FILE');
    expect(validateAttachmentFile(input('file.' + extension, 50))).toBeNull();
  }
  expect(validateAttachmentFile(input('file.txt', 5 * 1024 * 1024 + 1))).not.toBeNull();
  expect(validateAttachmentFile(input('file.zip', 50 * 1024 * 1024 + 1))).not.toBeNull();
  const video = (size: number) => ({ name: 'video.mp4', type: 'video/mp4', size } as File);
  expect(validateAttachmentFile(video(50 * 1024 * 1024))).toBeNull();
  expect(validateAttachmentFile(video(50 * 1024 * 1024 + 1))).not.toBeNull();
  expect(validateAttachmentFile(video(20 * 1024 * 1024), 30 * 1024 * 1024)).toBeNull();
  expect(validateAttachmentFile(video(20 * 1024 * 1024 + 1), 30 * 1024 * 1024)).not.toBeNull();
  expect(getAttachmentType(input('file.html', 50))).toBeNull();
});
