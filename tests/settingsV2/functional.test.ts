import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Room } from 'livekit-client';
import device, { deviceActions, selectMediaDevice, DEFAULT_MUTE_MICROPHONE_HOTKEY } from '../../src/store/slices/device.slice';
import { bindCallDevices } from '../../src/services/callDevices';
import { normalizeDevicePreferences } from '../../src/utils/devicePreferences';
import { getMicrophoneCaptureOptions, MICROPHONE_QUALITY_PRESETS, type MicQualitySetting } from '../../src/utils/microphoneQuality';
import { getDefaultScreenShareQuality } from '../../src/components/ScreenSharePicker/screenSharePickerService';
import { VoiceProcessingSection } from '../../src/components/VoiceVideoSetting/sections/VoiceProcessingSection';
import { createShortcutPreference, normalizeKeyboardShortcut } from '../../src/utils/keyboardShortcut';
import { onDesktopNotificationClicked, showDesktopNotification } from '../../src/services/desktop.service';

let values: Map<string, string>;
let unbind: (() => void) | undefined;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value)});
});
afterEach(() => { unbind?.(); unbind = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const makeStore = (status = 'in_call') => configureStore({reducer: {device, call: () => ({status})}});
const fakeRoom = (switcher = vi.fn().mockResolvedValue(true)) => ({switchActiveDevice: switcher, getActiveDevice: () => 'old', localParticipant: {getTrackPublication: () => undefined}});

describe('media preference regressions', () => {
  it.each(Object.keys(MICROPHONE_QUALITY_PRESETS))('honors EC/AGC/NS in %s', quality => {
    const base = {selectedMicrophoneId: 'mic', micQualitySetting: quality as MicQualitySetting, isEchoCancellationEnabled: true, isAutoGainControlEnabled: true, isNoiseSuppressionEnabled: true, isRnnoiseEnabled: false};
    expect(getMicrophoneCaptureOptions(base)).toMatchObject({deviceId: 'mic', echoCancellation: true, autoGainControl: true, noiseSuppression: true});
    expect(getMicrophoneCaptureOptions({...base, isEchoCancellationEnabled: false, isAutoGainControlEnabled: false})).toMatchObject({echoCancellation: false, autoGainControl: false});
    expect(getMicrophoneCaptureOptions({...base, isRnnoiseEnabled: true})).toMatchObject({noiseSuppression: false, voiceIsolation: false, sampleRate: 48000});
  });
  it('preserves custom processing and renders its selected option', () => {
    let state = device(undefined, deviceActions.setVoiceInputVolume(1.8));
    state = device(state, deviceActions.setVoiceProcessingPreset('custom'));
    expect(state.voiceProcessingConfig.inputVolume).toBe(1.8);
    expect(renderToStaticMarkup(createElement(VoiceProcessingSection, {dispatch: vi.fn(), voiceProcessingPreset: state.voiceProcessingPreset, voiceProcessingConfig: state.voiceProcessingConfig, inputVolumePercent: 180, outputVolumePercent: 100, onInputVolumePercentChange: vi.fn(), onOutputVolumePercentChange: vi.fn()}))).toContain('value="custom" selected=""');
  });
  it.each(['low', 'medium', 'mediumPlus', 'high', 'highPlus', 'game60', 'c4k60'] as const)('uses stored picker default %s', quality => {
    expect(getDefaultScreenShareQuality(quality)).toBe(quality);
  });
  it('resolves auto once from recommendation without claiming continuous adaptation', () => {
    expect(getDefaultScreenShareQuality('auto')).toBe('medium');
    expect(getDefaultScreenShareQuality('auto', {cameraQuality: 'low', screenShareQuality: 'highPlus'})).toBe('highPlus');
  });
  it('persists only after SDK confirmation and serializes selection', async () => {
    let resolve!: (value: boolean) => void;
    const room = fakeRoom(vi.fn(() => new Promise<boolean>(done => {resolve = done;})));
    unbind = bindCallDevices(room as unknown as Room);
    const store = makeStore();
    const pending = store.dispatch(selectMediaDevice({kind: 'audioinput', id: 'new'}));
    expect(store.getState().device.selectedMicrophoneId).toBe('default');
    expect(values.size).toBe(0);
    await store.dispatch(selectMediaDevice({kind: 'audioinput', id: 'ignored'}));
    expect(room.switchActiveDevice).toHaveBeenCalledTimes(1);
    resolve(true); await pending;
    expect(store.getState().device.selectedMicrophoneId).toBe('new');
    expect(JSON.parse(values.get('device-preferences-v2')!).selectedMicrophoneId).toBe('new');
  });
  it.each(['audioinput', 'videoinput', 'audiooutput'] as const)('restores previous %s on false SDK response', async kind => {
    const room = fakeRoom(vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true));
    unbind = bindCallDevices(room as unknown as Room);
    const store = makeStore(); await store.dispatch(selectMediaDevice({kind, id: 'bad'}));
    expect(store.getState().device.mediaError).toContain('восстановлено');
    expect(store.getState().device.selectedMicrophoneId).toBe('default');
    expect(store.getState().device.selectedCameraId).toBe('default');
    expect(values.size).toBe(0);
    expect(room.switchActiveDevice).toHaveBeenLastCalledWith(kind, 'old', true);
  });
  it('reports unconfirmed current hardware if switching and restore fail', async () => {
    const room = fakeRoom(vi.fn().mockRejectedValue(new Error('permission denied')));
    unbind = bindCallDevices(room as unknown as Room);
    const store = makeStore(); await store.dispatch(selectMediaDevice({kind: 'audioinput', id: 'bad'}));
    expect(store.getState().device.mediaError).toContain('Текущее устройство не подтверждено');
    expect(store.getState().device.deviceSwitchPending).toBe(false);
  });
  it('does not accept a switch resolved after its call ended', async () => {
    let resolve!: (value: boolean) => void;
    const room = fakeRoom(vi.fn(() => new Promise<boolean>(done => {resolve = done;})));
    unbind = bindCallDevices(room as unknown as Room);
    const store = makeStore(); const pending = store.dispatch(selectMediaDevice({kind: 'videoinput', id: 'new'}));
    unbind(); resolve(true); await pending;
    expect(store.getState().device.selectedCameraId).toBe('default');
    expect(store.getState().device.mediaError).toContain('Звонок завершился');
  });
  it('does not create a room or capture before a call; connecting without a bound room fails', async () => {
    const before = makeStore('idle'); await before.dispatch(selectMediaDevice({kind: 'audioinput', id: 'preferred'}));
    expect(before.getState().device.selectedMicrophoneId).toBe('preferred');
    const active = makeStore('connecting'); await active.dispatch(selectMediaDevice({kind: 'audioinput', id: 'bad'}));
    expect(active.getState().device.mediaError).toContain('ещё не готова');
  });
});

describe('persistence boundary', () => {
  it.each([null, [], 'bad', 5, {voiceProcessingConfig: null}])('restores safe nested graph from %j', raw => {
    expect(normalizeDevicePreferences(raw).voiceProcessingConfig?.highPass.frequency).toBe(90);
  });
  it('rejects invalid stored values while retaining legitimate partial custom values', () => {
    const state = normalizeDevicePreferences({selectedMicrophoneId: 7, cameraQuality: 'ultra', screenShareQuality: '__proto__', isEchoCancellationEnabled: 'false', voiceProcessingPreset: 'custom', voiceProcessingConfig: {inputVolume: 2, highPass: {frequency: -5}, compressor: {ratio: 999}}, participantVolumes: [{participantIdentity: 'a', source: 'microphone', volume: 50}, null]});
    expect(state.selectedMicrophoneId).toBeUndefined(); expect(state.cameraQuality).toBeUndefined(); expect(state.screenShareQuality).toBeUndefined();
    expect(state.isEchoCancellationEnabled).toBeUndefined(); expect(state.voiceProcessingConfig?.inputVolume).toBe(2);
    expect(state.voiceProcessingConfig?.compressor.ratio).toBe(8); expect(state.participantVolumes).toHaveLength(1);
  });
  it.each(['throw', 'drop'])('reports %s storage failure without false persistent success', mode => {
    vi.stubGlobal('localStorage', {getItem: () => null, setItem: () => {if (mode === 'throw') throw new Error('quota');}});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = device(undefined, deviceActions.setNotificationSounds(false));
    expect(state.notificationSoundsEnabled).toBe(false); expect(state.persistenceError).toContain('не сохранены');
  });
  it('keeps notification and call state independent', () => {
    const store = makeStore('incoming_ringing'); store.dispatch(deviceActions.setNotificationSounds(false));
    expect(store.getState().call.status).toBe('incoming_ringing');
    expect(JSON.parse(values.get('device-preferences-v2')!).notificationSoundsEnabled).toBe(false);
  });
});

describe('hotkeys and notification capabilities', () => {
  it.each(['KeyW', 'KeyR', 'KeyT', 'KeyN', 'KeyL'])('rejects reserved browser Ctrl+%s', code => {
    expect(createShortcutPreference({code, key: code.slice(3), ctrlKey: true} as KeyboardEvent)).toBeNull();
  });
  it('captures and persists an allowed shortcut', () => {
    const shortcut = createShortcutPreference({...DEFAULT_MUTE_MICROPHONE_HOTKEY, code: 'KeyQ', key: 'q'} as KeyboardEvent)!;
    expect(device(undefined, deviceActions.setMuteMicrophoneHotkey(shortcut)).muteMicrophoneHotkey.code).toBe('KeyQ');
  });
  it('rebuilds a stored label from actual code/modifiers', () => {
    expect(normalizeKeyboardShortcut({...DEFAULT_MUTE_MICROPHONE_HOTKEY, code: 'KeyQ', label: 'incorrect'}, DEFAULT_MUTE_MICROPHONE_HOTKEY).label).toBe('Ctrl+Alt+Q');
  });
  it('rejects duplicate assignments and conflicting individual resets in the shared reducer', () => {
    let state = device(undefined, deviceActions.setToggleCameraHotkey(DEFAULT_MUTE_MICROPHONE_HOTKEY));
    expect(state.toggleCameraHotkey.code).toBe('KeyV');
    expect(state.hotkeyError).toContain('уже назначена');
    state = device(state, deviceActions.setMuteMicrophoneHotkey({...DEFAULT_MUTE_MICROPHONE_HOTKEY, code: 'KeyQ', key: 'q', label: 'Ctrl+Alt+Q'}));
    state = device(state, deviceActions.setToggleCameraHotkey(DEFAULT_MUTE_MICROPHONE_HOTKEY));
    state = device(state, deviceActions.resetMuteMicrophoneHotkey());
    expect(state.muteMicrophoneHotkey.code).toBe('KeyQ');
    expect(state.hotkeyError).toContain('уже назначена');
  });
  it('does not request permission when notifications are unavailable or denied', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('Notification', undefined);
    await expect(showDesktopNotification({title: 'test'})).resolves.toBeUndefined();
    const ctor = vi.fn(); Object.assign(ctor, {permission: 'denied', requestPermission: vi.fn()}); vi.stubGlobal('Notification', ctor);
    await showDesktopNotification({title: 'test'}); expect(ctor).not.toHaveBeenCalled(); expect(ctor.requestPermission).not.toHaveBeenCalled();
  });
  it('routes permitted browser notification clicks and cleans listeners', async () => {
    const focus = vi.fn(), close = vi.fn(), clicked = vi.fn(); let notification: {onclick?: () => void};
    vi.stubGlobal('window', {focus});
    class BrowserNotification { static permission = 'granted'; close = close; constructor() {notification = this;} }
    vi.stubGlobal('Notification', BrowserNotification);
    const unsubscribe = onDesktopNotificationClicked(clicked);
    await showDesktopNotification({title: 'Message', roomId: 42}); notification!.onclick!();
    expect(clicked).toHaveBeenCalledWith({title: 'Message', roomId: 42}); expect(focus).toHaveBeenCalled(); expect(close).toHaveBeenCalled();
    unsubscribe(); clicked.mockClear(); notification!.onclick!(); expect(clicked).not.toHaveBeenCalled();
  });
});
