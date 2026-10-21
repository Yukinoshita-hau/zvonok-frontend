import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/api/api', () => ({ api: { post: vi.fn() } }));
import { api } from '../src/api/api';
import { MediaAccessClient, mediaAccessError } from '../src/api/MediaAccessClient';
import type { MediaAccess } from '../src/api/MediaAccessClient';
beforeEach(() => vi.clearAllMocks());
it('limits automatic renewal to two attempts near expiry', () => {
  const client = new MediaAccessClient();
  const expired = { expiresAt: new Date(Date.now()-1000).toISOString() } as MediaAccess;
  expect(client.isExpired(expired)).toBe(true); expect(client.canRenew(expired, 1)).toBe(true);
  expect(client.canRenew(expired, 2)).toBe(false);
  expect(client.canRenew({ ...expired, expiresAt: new Date(Date.now()+900000).toISOString() }, 0)).toBe(false);
});
it('deduplicates in-flight grants and aborts only after the final consumer closes', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(api.post).mockReturnValue(new Promise(r => { resolve = r; }));
  const client = new MediaAccessClient(), a = client.acquire(7), b = client.acquire(7);
  expect(api.post).toHaveBeenCalledOnce();
  const signal = vi.mocked(api.post).mock.calls[0][2]?.signal;
  a.release(); expect(signal?.aborted).toBe(false);
  b.release(); expect(signal?.aborted).toBe(true);
  resolve({ data: { attachmentId: 7 } }); await a.promise;
  client.acquire(7); expect(api.post).toHaveBeenCalledTimes(2);
});
it('classifies access revocation and unsupported responses', () => {
  expect(mediaAccessError({ isAxiosError: true, response: { status: 404 } })).toBe('denied');
  expect(mediaAccessError({ isAxiosError: true, response: { status: 415 } })).toBe('unsupported');
  expect(mediaAccessError(new Error())).toBe('network');
});
