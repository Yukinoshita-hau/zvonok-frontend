import { describe, it, expect, vi } from 'vitest';
import { DockBroker, parseDockState, clampBounds, safeExternalUrl, desktopConnectSources } from '../electron/desktopContracts';

const state = { callKey: '42:1', title: 'Звонок', connection: 'connected', microphoneEnabled: true, speaking: 'Никто не говорит' };
describe('desktop trust boundaries', () => {
  it('explicitly includes separate LiveKit signaling and validation origins without widening loopback trust', () => {
    expect(desktopConnectSources('http://127.0.0.1:18086/api','ws://127.0.0.1:18086/api/ws-raw',true,'ws://127.0.0.1:48886')).toEqual(['http://127.0.0.1:18086','ws://127.0.0.1:18086','ws://127.0.0.1:48886','http://127.0.0.1:48886']);
    expect(() => desktopConnectSources('https://api.zvonok.info',undefined,false,'ws://127.0.0.1:48886')).toThrow();
    expect(() => desktopConnectSources('http://127.0.0.1:18086',undefined,true,'ws://remote.test:48886')).toThrow();
    expect(() => desktopConnectSources('https://api.zvonok.info',undefined,false,'wss://user:password@voice.test')).toThrow();
    expect(desktopConnectSources('https://api.zvonok.info',undefined,false,'wss://voice.test')).toContain('https://voice.test');
  });
  it('production desktop endpoints require HTTPS/WSS; staging only permits explicit loopback HTTP/WS', () => {
    expect(() => desktopConnectSources('http://localhost:8080/api', 'ws://localhost:8080/api/ws-raw', false)).toThrow();
    expect(() => desktopConnectSources('/api', undefined, false)).toThrow();
    expect(() => desktopConnectSources('http://remote.test/api', undefined, true)).toThrow();
    expect(desktopConnectSources('http://localhost:8080/api', 'ws://localhost:8080/api/ws-raw', true)).toEqual(['http://localhost:8080', 'ws://localhost:8080']);
    expect(desktopConnectSources('https://api.zvonok.info/api', undefined, false)).toEqual(['https://api.zvonok.info']);
  });
  it('projects only safe state fields and rejects unbounded/malformed input', () => {
    expect(parseDockState({ ...state, accessToken: 'secret' })).toEqual(state);
    expect(() => parseDockState({ ...state, title: 'x'.repeat(241) })).toThrow();
    expect(() => parseDockState({ ...state, microphoneEnabled: 'yes' })).toThrow();
    expect(() => parseDockState({ ...state, callKey: 'javascript:bad' })).toThrow();
  });
  it('allows only http(s) links without credentials', () => {
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'ms-settings:test', 'https://user:pass@example.org']) expect(safeExternalUrl(url)).toBe(false);
    expect(safeExternalUrl('https://zvonok.info/path')).toBe(true);
  });
  it('clamps disconnected monitor bounds and keeps sizes inside small work areas', () => {
    expect(clampBounds({ x: 3000, y: -500, width: 340, height: 200 }, { x: -1280, y: 0, width: 1280, height: 720 })).toEqual({ x: -340, y: 0, width: 340, height: 200 });
    expect(clampBounds({ x: 0, y: 0, width: 1400, height: 900 }, { x: 0, y: 0, width: 800, height: 600 })).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });
});
describe('single-owner dock command broker', () => {
  it('fences generations, rejects unknown commands and strips JWT fields', async () => {
    const send = vi.fn(); const broker = new DockBroker(send);
    broker.publish(state);
    await expect(broker.command({ callKey: '41:1', action: 'microphone', enabled: false })).rejects.toThrow('STALE_CALL');
    await expect(broker.command({ callKey: state.callKey, action: 'dispatch' })).rejects.toThrow('INVALID_COMMAND');
    const pending = broker.command({ callKey: state.callKey, action: 'microphone', enabled: false });
    const sent = send.mock.calls[0][0];
    expect(sent).toMatchObject({ callKey: state.callKey, action: 'microphone', enabled: false });
    broker.publish({ ...state, callKey: '43:2' });
    await expect(pending).rejects.toThrow('STALE_CALL');
    expect(broker.ack({ id: sent.id, callKey: state.callKey, ok: true })).toBe(false);
    broker.dispose();
  });
  it('acknowledges once, prevents concurrent commands, expires and cleans up', async () => {
    vi.useFakeTimers();
    try {
      const send = vi.fn(); const broker = new DockBroker(send);
      broker.publish(state);
      const pending = broker.command({ callKey: state.callKey, action: 'microphone', enabled: true });
      await expect(broker.command({ callKey: state.callKey, action: 'end' })).rejects.toThrow('COMMAND_BUSY');
      const sent = send.mock.calls[0][0];
      expect(broker.ack({ id: sent.id, callKey: state.callKey, ok: true })).toBe(true);
      await expect(pending).resolves.toBeUndefined();
      expect(broker.ack({ id: sent.id, callKey: state.callKey, ok: true })).toBe(false);
      const timed = broker.command({ callKey: state.callKey, action: 'end' });
      const assertion = expect(timed).rejects.toThrow('OWNER_TIMEOUT');
      await vi.advanceTimersByTimeAsync(8000); await assertion;
      const disposed = broker.command({ callKey: state.callKey, action: 'end' });
      broker.dispose(); await expect(disposed).rejects.toThrow('OWNER_GONE');
    } finally { vi.useRealTimers(); }
  });
});
