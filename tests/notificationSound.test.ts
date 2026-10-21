import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { soundPlayer } from '../src/utils/soundPlayer';
let audio: { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; removeAttribute: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn>; onended?: () => void };
beforeEach(() => {
  vi.useFakeTimers();
  audio={play:vi.fn().mockResolvedValue(undefined),pause:vi.fn(),removeAttribute:vi.fn(),load:vi.fn()};
  vi.stubGlobal('Audio',class {constructor(){return audio;}});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('explicit notification sound test',()=>{
  it('uses a temporary player and releases it after a bounded sample',async()=>{
    await soundPlayer.test('call'); expect(audio.play).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2500);expect(audio.pause).toHaveBeenCalledOnce();expect(audio.removeAttribute).toHaveBeenCalledWith('src');expect(audio.load).toHaveBeenCalledOnce();
  });
  it('reports permission/playback failure and clears the timer',async()=>{
    audio.play.mockRejectedValue(new Error('denied'));await expect(soundPlayer.test('message')).rejects.toThrow('denied');
    expect(audio.pause).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
});
