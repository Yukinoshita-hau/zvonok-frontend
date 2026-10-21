import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PreparedUpdates, updateIdentity } from '../electron/preparedUpdates';

const runtime = vi.hoisted(() => ({ directory: '', installed: true, trusted: true, failInstall: false, newer: true, offline: false, installer: null as any }));
vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '1.0.0', getPath: () => runtime.directory, once: vi.fn() },
  dialog: {}, ipcMain: { handle: vi.fn() }, session: { fromPartition: () => ({ webRequest: { onBeforeRequest: vi.fn() } }) },
}));
vi.mock('../electron/installability', () => ({ hasNsisInstallation: async () => runtime.installed }));
vi.mock('electron-updater', () => ({ default: { NsisUpdater: class extends EventEmitter {
  currentVersion = { compare: () => runtime.newer ? -1 : 0 };
  verifyUpdateCodeSignature = async (_names: string[], file: string) => runtime.trusted || file === process.execPath ? null : 'invalid signature';
  quitAndInstall = vi.fn(() => { if (runtime.failInstall) this.emit('error', new Error('install failed')); });
  constructor() { super(); runtime.installer = this; }
  async checkForUpdates() {
    if (runtime.offline) throw new Error('offline');
    this.emit('update-available', info);
    this.emit('update-downloaded', { ...info, downloadedFile: 'cached-installer.exe' });
    return { downloadPromise: Promise.resolve([]) };
  }
} } }));
const info = { version: '1.1.0', files: [{ sha512: Buffer.alloc(64, 1).toString('base64') }] };
const originalResources = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
beforeEach(async () => {
  runtime.directory = await mkdtemp(path.join(tmpdir(), 'zvonok-startup-'));
  Object.assign(runtime, { installed: true, trusted: true, failInstall: false, newer: true, offline: false });
  Object.defineProperty(process, 'resourcesPath', { configurable: true, value: runtime.directory });
  await writeFile(path.join(runtime.directory, 'desktop-update-policy.json'), JSON.stringify({ url: 'https://updates.example.invalid/', channel: 'latest', publisherName: ['Pinned publisher'] }));
  await new PreparedUpdates(path.join(runtime.directory, 'prepared-update-attempt.json')).record(updateIdentity(info), '1.0.0');
  await new PreparedUpdates(path.join(runtime.directory, 'prepared-update-attempt.json')).safeShutdown(true);
});
afterEach(() => { if (originalResources) Object.defineProperty(process, 'resourcesPath', originalResources); else Reflect.deleteProperty(process, 'resourcesPath'); });

describe('startup install orchestration with simulated NSIS, never executes an installer', () => {
  async function setup(idle = true) {
    const { setupUpdates } = await import('../electron/updates');
    return setupUpdates(() => null, () => {}, () => false, () => {}, () => idle);
  }
  it('installs only a reverified prepared target before any renderer exists and persists the attempt', async () => {
    const service = await setup(); const preparing = vi.fn();
    expect(await service.prepareStartup(preparing)).toBe(true);
    expect(preparing).toHaveBeenCalledOnce(); expect(runtime.installer.quitAndInstall).toHaveBeenCalledOnce();
    const next = await setup(); expect(await next.prepareStartup(vi.fn())).toBe(false);
    expect(next.get().notice).toBe('install-failed');
  });
  it.each(['signature', 'unpacked', 'busy', 'not-newer', 'offline', 'install-failure'])('fails safely for %s', async mode => {
    runtime.trusted = mode !== 'signature'; runtime.installed = mode !== 'unpacked'; runtime.newer = mode !== 'not-newer'; runtime.offline = mode === 'offline'; runtime.failInstall = mode === 'install-failure';
    const service = await setup(mode !== 'busy');
    expect(await service.prepareStartup(vi.fn())).toBe(false);
    if (mode !== 'install-failure') expect(runtime.installer.quitAndInstall).not.toHaveBeenCalled();
  });
  it('does not auto-install after an unsafe or unconfirmed shutdown', async () => {
    await new PreparedUpdates(path.join(runtime.directory, 'prepared-update-attempt.json')).safeShutdown(false);
    const service = await setup(); expect(await service.prepareStartup(vi.fn())).toBe(false);
    expect(runtime.installer.quitAndInstall).not.toHaveBeenCalled();
  });
});
