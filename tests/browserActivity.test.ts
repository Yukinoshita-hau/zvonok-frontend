import { describe, expect, it } from 'vitest';
import { applyBrowserUpdate, pageCoordinates, type BrowserSession } from '../src/components/CallUi/BrowserActivity/browserActivity';

const session = (generation = 1): BrowserSession => ({ sessionId: 'one', status: 'active', currentUrl: 'https://example.com', expiresAt: '', media: { epoch: 'epoch1', state: 'streaming' }, collaboration: { identity: 'A', role: 'owner', controller: 'A', generation, epoch: 'epoch1', expiresAt: 20000, serverTime: 10000, ownerPresent: true, result: '' } });
describe('Browser Activity presentation boundaries', () => {
  it('rejects late input responses after revoke, close, replacement and epoch rotation', () => {
    const revoked = session(5);
    expect(applyBrowserUpdate(revoked, session(4))).toBe(revoked);
    const closed = { ...revoked, status: 'closed' };
    expect(applyBrowserUpdate(closed, session(6))).toBe(closed);
    expect(applyBrowserUpdate(revoked, { ...session(6), sessionId: 'two' })).toBe(revoked);
    expect(applyBrowserUpdate(revoked, { ...session(6), media: { epoch: 'epoch2', state: 'streaming' } })).toBe(revoked);
    expect(applyBrowserUpdate(revoked, session(6))?.collaboration?.generation).toBe(6);
  });
  it('maps resized contain video and rejects letterbox input', () => {
    const rect = { left: 100, top: 100, width: 640, height: 500 };
    expect(pageCoordinates(rect, 420, 350)).toEqual({ x: 640, y: 360 });
    expect(pageCoordinates(rect, 420, 110)).toBeUndefined();
    expect(pageCoordinates({ ...rect, width: 0 }, 100, 100)).toBeUndefined();
    expect(pageCoordinates(rect, 740, 350)).toBeUndefined();
  });
});
