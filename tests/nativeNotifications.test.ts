import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showNativeNotification } from '../electron/notifications';
afterEach(()=>vi.useRealTimers());
class Toast extends EventEmitter { show=vi.fn();close=vi.fn(()=>this.emit('close')); }
describe('native notification acknowledgement',()=>{
  it('waits for actual show and propagates OS denial',async()=>{
    const shown=new Toast();const accepted=showNativeNotification(shown as any);shown.emit('show');await expect(accepted).resolves.toBeUndefined();
    const denied=new Toast();const rejected=showNativeNotification(denied as any);denied.emit('failed');await expect(rejected).rejects.toThrow('NOTIFICATION_FAILED');
  });
  it('times out without a false show acknowledgement and closes the notification',async()=>{
    vi.useFakeTimers();const toast=new Toast();const result=expect(showNativeNotification(toast as any)).rejects.toThrow('NOTIFICATION_NOT_CONFIRMED');
    await vi.advanceTimersByTimeAsync(5000);await result;expect(toast.close).toHaveBeenCalledOnce();
  });
  it('clears the deadline after explicit dismissal or a synchronous show error',async()=>{
    vi.useFakeTimers();const dismissed=new Toast();const result=showNativeNotification(dismissed as any);dismissed.emit('close');await result;expect(vi.getTimerCount()).toBe(0);
    const broken=new Toast();broken.show.mockImplementation(()=>{throw new Error('unavailable');});await expect(showNativeNotification(broken as any)).rejects.toThrow('NOTIFICATION_FAILED');expect(vi.getTimerCount()).toBe(0);
  });
});
