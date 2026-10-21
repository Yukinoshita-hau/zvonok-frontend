import type { DeviceState } from '../store/slices/device.slice';
import { normalizeNotificationPolicy } from './notificationPolicy';
import { getVoicePresetConfig } from '../livekit/audio/ZvonokAudioPresets';
import { CAMERA_QUALITY_PRESETS, SCREEN_SHARE_QUALITY_PRESETS } from './callQuality';

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const ranges: Record<string, [number, number]> = {
  inputVolume: [0, 3], outputVolume: [0, 2], frequency: [20, 20000],
  gain: [-40, 40], q: [0.0001, 1000], threshold: [-100, 0], ratio: [1, 20],
  knee: [0, 40], attack: [0, 1], release: [0, 1],
};
function graphConfig(raw: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  const value = record(raw);
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const candidate = value[key];
    if (typeof fallback === 'object') return [key, graphConfig(candidate, record(fallback))];
    if (typeof fallback === 'boolean') return [key, typeof candidate === 'boolean' ? candidate : fallback];
    const range = ranges[key];
    return [key, typeof candidate === 'number' && Number.isFinite(candidate) && range && candidate >= range[0] && candidate <= range[1] ? candidate : fallback];
  }));
}
export function normalizeDevicePreferences(raw: unknown): Partial<DeviceState> {
  const value = record(raw), result: Record<string, unknown> = {};
  result.notificationPolicy = normalizeNotificationPolicy(value.notificationPolicy);
  for (const key of ['selectedCameraId', 'selectedMicrophoneId', 'selectedAudioOutputId']) {
    if (typeof value[key] === 'string' && value[key].length > 0) result[key] = value[key];
  }
  for (const key of ['notificationSoundsEnabled', 'desktopNotificationsEnabled', 'isNoiseSuppressionEnabled', 'isRnnoiseEnabled', 'isEchoCancellationEnabled', 'isAutoGainControlEnabled', 'isAutoInputSensitivity']) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  if (value.cameraQuality === 'auto' || Object.hasOwn(CAMERA_QUALITY_PRESETS, String(value.cameraQuality))) result.cameraQuality = value.cameraQuality;
  if (value.screenShareQuality === 'auto' || Object.hasOwn(SCREEN_SHARE_QUALITY_PRESETS, String(value.screenShareQuality))) result.screenShareQuality = value.screenShareQuality;
  result.micQualitySetting = value.micQualitySetting;
  result.voiceProcessingPreset = ['default', 'clearVoice', 'softVoice', 'custom'].includes(String(value.voiceProcessingPreset)) ? value.voiceProcessingPreset : 'default';
  result.voiceProcessingConfig = graphConfig(value.voiceProcessingConfig, getVoicePresetConfig(result.voiceProcessingPreset === 'custom' ? 'default' : result.voiceProcessingPreset as 'default' | 'clearVoice' | 'softVoice') as unknown as Record<string, unknown>);
  result.isRnnoiseEnabled = record(record(result.voiceProcessingConfig).rnnoise).enabled;
  if (typeof value.voiceActivityThreshold === 'number' && Number.isFinite(value.voiceActivityThreshold) && value.voiceActivityThreshold >= 0 && value.voiceActivityThreshold <= 100) result.voiceActivityThreshold = value.voiceActivityThreshold;
  result.participantVolumes = Array.isArray(value.participantVolumes) ? value.participantVolumes.filter(item => {
    const row = record(item);
    return typeof row.participantIdentity === 'string' && ['microphone', 'screenShareAudio'].includes(String(row.source)) && typeof row.volume === 'number' && Number.isFinite(row.volume) && row.volume >= 0 && row.volume <= 100;
  }) : [];
  for (const key of ['muteMicrophoneHotkey', 'toggleCameraHotkey', 'toggleScreenShareHotkey']) result[key] = value[key];
  return result as Partial<DeviceState>;
}
