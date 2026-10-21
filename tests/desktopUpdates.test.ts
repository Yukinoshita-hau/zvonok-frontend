import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
import { UpdateController, validateUpdatePolicy } from '../electron/updateController';
class Updater extends EventEmitter {
  autoDownload = true; autoInstallOnAppQuit = true; allowDowngrade = true; allowPrerelease = true; disableWebInstaller = false;
  checkForUpdates = vi.fn(async () => null); quitAndInstall = vi.fn();
}
describe('updates policy and call safety', () => {
  it('does not expose a downloaded installer as ready before publisher verification', async () => {
    const updater = new Updater();
    let reject!: (error: Error) => void;
    const verification = new Promise<void>((_resolve, fail) => { reject = fail; });
    const controller = new UpdateController(updater as any, () => true, true, () => {}, '1.0.0', () => verification);
    updater.emit('update-downloaded', { version: '1.0.1', downloadedFile: 'cached.exe' });
    expect(controller.state.status).not.toBe('ready');
    expect(() => controller.install()).toThrow('UPDATE_NOT_READY');
    reject(new Error('Publisher mismatch')); await verification.catch(() => {});
    expect(controller.state.status).toBe('error');
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    controller.dispose();
  });
  it('production fails closed without HTTPS feed and certificate identity', () => {
    expect(() => validateUpdatePolicy({ url: 'http://host/feed', publisherName: ['Zvonok'], channel: 'latest' }, false)).toThrow();
    expect(() => validateUpdatePolicy({ url: 'https://host/feed', publisherName: [], channel: 'latest' }, false)).toThrow();
    expect(() => validateUpdatePolicy({ url: 'https://u:p@host/feed', publisherName: ['X'], channel: 'latest' }, false)).toThrow();
    expect(() => validateUpdatePolicy({ url: 'http://example.org', channel: 'latest' }, true)).toThrow();
    expect(validateUpdatePolicy({ url: 'http://127.0.0.1:3041', channel: 'latest' }, true).url).toContain('127.0.0.1');
  });
  it('single-flight checks, progress, errors and ready state never install automatically', async () => {
    const updater = new Updater();
    const controller = new UpdateController(updater as any, () => false, true, () => {});
    expect(updater.autoInstallOnAppQuit).toBe(false); expect(updater.allowDowngrade).toBe(false);
    await Promise.all([controller.check(), controller.check()]); expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    updater.emit('update-available', { version: '0.0.1' }); expect(controller.state.status).toBe('available');
    updater.emit('download-progress', { percent: 42 }); expect(controller.state.percent).toBe(42);
    updater.emit('update-downloaded', { version: '0.0.1' });
    expect(controller.state.status).toBe('ready'); expect(updater.quitAndInstall).not.toHaveBeenCalled();
    expect(() => controller.install()).toThrow('CALL_OR_OWNER_BUSY');
    updater.emit('error', new Error('sensitive internal URL')); expect(controller.state.status).toBe('error');
    expect(JSON.stringify(controller.state)).not.toContain('sensitive'); controller.dispose();
  });
  it('requires ready state, fresh idle owner and an installable packaged build', () => {
    const updater = new Updater(); let idle = true;
    const controller = new UpdateController(updater as any, () => idle, true, () => {});
    expect(() => controller.install()).toThrow('UPDATE_NOT_READY');
    updater.emit('update-downloaded', { version: '0.0.1' }); idle = false;
    expect(() => controller.install()).toThrow('CALL_OR_OWNER_BUSY'); idle = true;
    controller.install(); expect(updater.quitAndInstall).toHaveBeenCalledTimes(1); controller.dispose();
    const staging = new UpdateController(new Updater() as any, () => true, false, () => {});
    expect(() => staging.install()).toThrow('STAGING_INSTALL_DISABLED'); staging.dispose();
  });
});
