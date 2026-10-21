import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PreparedUpdates, updateIdentity } from '../electron/preparedUpdates';

const identity = updateIdentity({ version: '1.1.0', files: [{ sha512: Buffer.alloc(64, 1).toString('base64') }] });
async function journal() { return new PreparedUpdates(path.join(await mkdtemp(path.join(tmpdir(), 'zvonok-update-')), 'attempt.json')); }
describe('prepared update attempt journal (never an installer cache)', () => {
  it('blocks the same automatic attempt across processes and permits explicit retry', async () => {
    const store = await journal(); await store.record(identity, '1.0.0');
    await store.begin(identity, '1.0.0');
    expect((await store.reconcile('1.0.0'))?.outcome).toBe('failed');
    await store.record(identity, '1.0.0');
    await expect(store.begin(identity, '1.0.0')).rejects.toThrow('UPDATE_ATTEMPT_BLOCKED');
    await store.begin(identity, '1.0.0', true);
    expect((await store.read())?.attempts).toBe(2);
  });
  it('confirms success only from the actual version on the next launch', async () => {
    const store = await journal(); await store.record(identity, '1.0.0'); await store.begin(identity, '1.0.0');
    expect((await store.reconcile('1.1.0'))?.outcome).toBe('verified');
    await expect(store.begin({ ...identity, artifact: 'f'.repeat(64) }, '1.0.0')).rejects.toThrow();
  });
  it('rejects malformed metadata and corrupt journal without interpreting filesystem installer paths', async () => {
    expect(() => updateIdentity({ version: '1.1.0', files: [{ sha512: 'invalid' }] })).toThrow();
    const dir = await mkdtemp(path.join(tmpdir(), 'zvonok-update-')); const file = path.join(dir, 'attempt.json');
    await writeFile(file, '{bad json'); expect(await new PreparedUpdates(file).read()).toBeNull();
    await writeFile(file, JSON.stringify({ ...identity, installedVersion: '1.0.0', attempts: -1, outcome: 'pending' }));
    expect(await new PreparedUpdates(file).read()).toBeNull();
  });
});
