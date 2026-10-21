import { describe, expect, it, vi } from 'vitest';
import { AttachmentMediaCoordinator, playbackShortcut } from '../src/components/MessageAttachments/playback';
import { readFileSync, existsSync } from 'node:fs';
import { getAttachmentType, validateAttachmentFile } from '../src/utils/messageAttachmentValidation';

const engine = () => ({ play: vi.fn(async () => {}), pause: vi.fn(), currentTime: 3, volume: 1, playbackRate: 1, paused: true });
describe('attachment playback isolation', () => {
  it('accepts ordinary audio files within the existing backend limit', () => {
    const file = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
    expect(getAttachmentType(file)).toBe('AUDIO'); expect(validateAttachmentFile(file)).toBeNull();
    expect(validateAttachmentFile({ ...file, name: 'large.mp3', type: 'audio/mpeg', size: 26*1024*1024 } as File)).not.toBeNull();
  });
  it('pauses only registered attachments, and unregisters disposed media', () => {
    const coordinator = new AttachmentMediaCoordinator(), a = engine(), b = engine(), call = engine();
    const dispose = coordinator.register(a); coordinator.register(b);
    coordinator.activate(b); expect(a.pause).toHaveBeenCalledOnce(); expect(call.pause).not.toHaveBeenCalled();
    dispose(); a.pause.mockClear(); coordinator.pauseAll(); expect(a.pause).not.toHaveBeenCalled();
    expect(b.pause).toHaveBeenCalledOnce();
  });
  it('handles only playback keys and clamps backward seeking', () => {
    const media = engine(); expect(playbackShortcut(media, 'ArrowLeft')).toBe(true); expect(media.currentTime).toBe(0);
    playbackShortcut(media, 'ArrowRight'); expect(media.currentTime).toBe(5);
    playbackShortcut(media, ' '); expect(media.play).toHaveBeenCalledOnce();
    expect(playbackShortcut(media, 'a')).toBe(false);
  });
  it('removes recording creation while retaining historical types', () => {
    const composer = readFileSync('src/pages/DmChat/DmChat.tsx', 'utf8');
    expect(composer).not.toMatch(/MessageRecorderControls|handleSendRecorded|useVoiceRecorder|useVideoNoteRecorder/);
    expect(existsSync('src/components/MessageAttachments/MessageRecorderControls.tsx')).toBe(false);
    expect(readFileSync('src/api/interfaces/MessageAttachmentDtos.ts', 'utf8')).toContain('"VIDEO_NOTE"');
  });
});
