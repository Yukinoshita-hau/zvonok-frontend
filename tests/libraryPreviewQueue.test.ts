import { it, expect } from 'vitest';
import { queueImagePreview } from '../src/components/RoomAttachments/previewQueue';
it('bounds grants and decode to four and cancels queued offscreen images', async () => {
  const finish: (() => void)[] = [];
  let started = 0;
  const task = () => { started++; return new Promise<void>(resolve => finish.push(resolve)); };
  for (let i = 0; i < 4; i++) queueImagePreview(task);
  const cancel = queueImagePreview(task); cancel();
  queueImagePreview(task);
  expect(started).toBe(4);
  finish[0]();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(started).toBe(5);
  finish.forEach(resolve => resolve());
  await new Promise(resolve => setTimeout(resolve, 0));
});
