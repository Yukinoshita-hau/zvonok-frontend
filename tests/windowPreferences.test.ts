import { beforeEach, describe, expect, it, vi } from 'vitest';
const { io } = vi.hoisted(() => ({io:{readFile:vi.fn(),writeFile:vi.fn()}}));
vi.mock('electron', () => ({ app:{getPath:()=>'/isolated-e6'}, screen:{} }));
vi.mock('node:fs/promises', () => io);
import { closeToTray, readWindowState, saveCloseToTray } from '../electron/windowState';

describe('E6 native window preference', () => {
  beforeEach(() => { io.readFile.mockResolvedValue('{}'); io.writeFile.mockResolvedValue(undefined); });
  it('defaults to hide and persists an explicit exit preference with bounds', async () => {
    io.readFile.mockResolvedValue(JSON.stringify({main:{x:0,y:0,width:900,height:600}}));
    await readWindowState(); expect(closeToTray()).toBe(true);
    await saveCloseToTray(false); expect(closeToTray()).toBe(false);
    const data=JSON.parse(io.writeFile.mock.calls.at(-1)![1]);
    expect(data).toMatchObject({closeToTray:false,main:{width:900,height:600}});
    io.readFile.mockResolvedValue(JSON.stringify(data)); await readWindowState(); expect(closeToTray()).toBe(false);
  });
  it('does not claim a failed write succeeded', async () => {
    await readWindowState(); io.writeFile.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(saveCloseToTray(false)).rejects.toThrow('disk unavailable'); expect(closeToTray()).toBe(true);
    await saveCloseToTray(false); expect(closeToTray()).toBe(false);
  });
});
