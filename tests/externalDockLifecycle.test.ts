import { describe, it, expect, vi } from 'vitest';
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>() }));
vi.mock('electron', () => ({ BrowserWindow: class {}, dialog: {}, ipcMain: { handle: (channel: string, handler: (...args: any[]) => any) => handlers.set(channel, handler) } }));
vi.mock('../electron/windowState.js', () => ({ dockOnTop: () => false, saveOnTop: vi.fn(), trackWindowBounds: vi.fn(), windowBounds: vi.fn() }));
import { setupExternalDock } from '../electron/externalDock';

describe('external dock owner teardown', () => {
  it('cleanup is idempotent when the owner BrowserWindow and webContents are already destroyed', () => {
    let destroyed = false;
    const contents = { setBackgroundThrottling: vi.fn(), isDestroyed: () => false };
    const owner = { isDestroyed: () => destroyed, get webContents() { if (destroyed) throw new TypeError('Object has been destroyed'); return contents; } };
    const dock = setupExternalDock(() => owner as any, () => {}, () => {});
    handlers.get('dock:publish')!({}, { callKey: '42:1', title: 'Test', connection: 'connected', microphoneEnabled: false, speaking: '' });
    destroyed = true;
    expect(() => dock.clear()).not.toThrow();
    expect(() => dock.clear()).not.toThrow();
    expect(dock.hasCall()).toBe(false);
  });
});
