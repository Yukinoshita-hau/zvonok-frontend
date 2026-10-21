import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { switchCallDevice } from '../../services/callDevices';
import { normalizeDevicePreferences } from '../../utils/devicePreferences';
import { normalizeNotificationPolicy, type NotificationPolicy } from '../../utils/notificationPolicy';
import type {
	CallQualityRecommendation,
	CallQualitySetting,
	NetworkQualityMetrics,
	ScreenShareQualitySetting,
} from "../../utils/callQuality";
import { normalizeMicQualitySetting, type MicQualitySetting } from "../../utils/microphoneQuality";
import type { ZvonokAudioGraphConfig, ZvonokVoicePresetId } from "../../livekit/audio/ZvonokAudioGraphConfig";
import { getVoicePresetConfig } from "../../livekit/audio/ZvonokAudioPresets";
import {
	normalizeKeyboardShortcut,
	isKeyboardShortcutEvent,
	type KeyboardShortcutPreference,
} from "../../utils/keyboardShortcut";

export type ParticipantAudioSource = "microphone" | "screenShareAudio";

export interface ParticipantVolumePreference {
	participantIdentity: string;
	source: ParticipantAudioSource;
	volume: number;
}

export interface ScreenShareRuntimeInfo {
	requestedFps: number | null;
	actualFps: number | null;
	requestedResolution: string | null;
	actualResolution: string | null;
	activePreset: string | null;
	fallbackReason: string | null;
	updatedAt: string | null;
}

export interface ConnectionTestResult {
	status: "idle" | "running" | "succeeded" | "failed";
	summary: string | null;
	metrics: NetworkQualityMetrics | null;
	recommendation: CallQualityRecommendation | null;
	error: string | null;
	updatedAt: string | null;
}

export interface DeviceState {
	notificationPolicy: NotificationPolicy;
	selectedAudioOutputId: string;
	notificationSoundsEnabled: boolean;
	desktopNotificationsEnabled: boolean;
	persistenceError: string | null;
	mediaError: string | null;
	hotkeyError: string | null;
	notificationError: string | null;
	deviceSwitchPending: boolean;
	selectedCameraId: string;
	selectedMicrophoneId: string;
	micQualitySetting: MicQualitySetting;
	cameraQuality: CallQualitySetting;
	screenShareQuality: ScreenShareQualitySetting;

	isNoiseSuppressionEnabled: boolean;
	isEchoCancellationEnabled: boolean;
	isAutoGainControlEnabled: boolean;
	isRnnoiseEnabled: boolean;

	voiceProcessingPreset: ZvonokVoicePresetId;
	voiceProcessingConfig: ZvonokAudioGraphConfig;

	voiceActivityThreshold: number;
	isAutoInputSensitivity: boolean;
	participantVolumes: ParticipantVolumePreference[];
	screenShareRuntime: ScreenShareRuntimeInfo;
	connectionTestResult: ConnectionTestResult;
	muteMicrophoneHotkey: KeyboardShortcutPreference;
	toggleCameraHotkey: KeyboardShortcutPreference;
	toggleScreenShareHotkey: KeyboardShortcutPreference;
}

const DEVICE_PREFS_STORAGE_KEY = "device-preferences-v2";

export const DEFAULT_MUTE_MICROPHONE_HOTKEY: KeyboardShortcutPreference = {
	code: "KeyM",
	key: "m",
	ctrlKey: true,
	altKey: true,
	shiftKey: false,
	metaKey: false,
	label: "Ctrl+Alt+M",
};

export const DEFAULT_TOGGLE_CAMERA_HOTKEY: KeyboardShortcutPreference = {
	code: "KeyV",
	key: "v",
	ctrlKey: true,
	altKey: true,
	shiftKey: false,
	metaKey: false,
	label: "Ctrl+Alt+V",
};

export const DEFAULT_TOGGLE_SCREEN_SHARE_HOTKEY: KeyboardShortcutPreference = {
	code: "KeyS",
	key: "s",
	ctrlKey: true,
	altKey: true,
	shiftKey: false,
	metaKey: false,
	label: "Ctrl+Alt+S",
};

type ShortcutKey = 'muteMicrophoneHotkey' | 'toggleCameraHotkey' | 'toggleScreenShareHotkey';
function setShortcut(state: DeviceState, key: ShortcutKey, shortcut: KeyboardShortcutPreference) {
	const keys: ShortcutKey[] = ['muteMicrophoneHotkey', 'toggleCameraHotkey', 'toggleScreenShareHotkey'];
	if (keys.some(other => other !== key && isKeyboardShortcutEvent(shortcut, state[other]))) {
		state.hotkeyError = 'Комбинация уже назначена другой команде.';
		return;
	}
	state[key] = shortcut;
	state.hotkeyError = null;
	saveStoredPreferences(state);
}

let preferenceLoadError: string | null = null;
function loadStoredPreferences() {
	try {
		const raw = localStorage.getItem(DEVICE_PREFS_STORAGE_KEY);
		if (!raw) return null;
		return normalizeDevicePreferences(JSON.parse(raw));
	} catch (error) {
		preferenceLoadError = 'Не удалось восстановить локальные настройки. Используются безопасные значения по умолчанию.';
		console.error("Failed to parse device preferences", error);
		return null;
	}
}

function saveStoredPreferences(state: DeviceState) {
	try {
		const serialized = JSON.stringify({
				notificationPolicy: state.notificationPolicy,
				selectedAudioOutputId: state.selectedAudioOutputId,
				notificationSoundsEnabled: state.notificationSoundsEnabled,
				desktopNotificationsEnabled: state.desktopNotificationsEnabled,
				selectedCameraId: state.selectedCameraId,
				selectedMicrophoneId: state.selectedMicrophoneId,
				micQualitySetting: state.micQualitySetting,
				cameraQuality: state.cameraQuality,
				screenShareQuality: state.screenShareQuality,
				isNoiseSuppressionEnabled: state.isNoiseSuppressionEnabled,
				isRnnoiseEnabled: state.isRnnoiseEnabled,
				isEchoCancellationEnabled: state.isEchoCancellationEnabled,
				isAutoGainControlEnabled: state.isAutoGainControlEnabled,
				voiceActivityThreshold: state.voiceActivityThreshold,
				isAutoInputSensitivity: state.isAutoInputSensitivity,
				participantVolumes: state.participantVolumes,

				voiceProcessingPreset: state.voiceProcessingPreset,
				voiceProcessingConfig: state.voiceProcessingConfig,
				muteMicrophoneHotkey: state.muteMicrophoneHotkey,
				toggleCameraHotkey: state.toggleCameraHotkey,
				toggleScreenShareHotkey: state.toggleScreenShareHotkey,
			});
		localStorage.setItem(DEVICE_PREFS_STORAGE_KEY, serialized);
		if (localStorage.getItem(DEVICE_PREFS_STORAGE_KEY) !== serialized) throw new Error('Storage readback mismatch');
		state.persistenceError = null;
	} catch (error) {
		state.persistenceError = 'Настройки действуют в этой сессии, но не сохранены. Хранилище недоступно.';
		console.error("Failed to save device preferences", error);
	}
}

const storedPrefs = loadStoredPreferences();

const initialState: DeviceState = {
	notificationPolicy: normalizeNotificationPolicy(storedPrefs?.notificationPolicy),
	selectedAudioOutputId: storedPrefs?.selectedAudioOutputId ?? 'default',
	notificationSoundsEnabled: storedPrefs?.notificationSoundsEnabled ?? true,
	desktopNotificationsEnabled: storedPrefs?.desktopNotificationsEnabled ?? true,
	persistenceError: preferenceLoadError,
	mediaError: null,
	hotkeyError: null,
	notificationError: null,
	deviceSwitchPending: false,
	selectedCameraId: storedPrefs?.selectedCameraId ?? "default",
	selectedMicrophoneId: storedPrefs?.selectedMicrophoneId ?? "default",
	micQualitySetting: normalizeMicQualitySetting(storedPrefs?.micQualitySetting),
	cameraQuality: storedPrefs?.cameraQuality ?? "high",
	screenShareQuality: storedPrefs?.screenShareQuality ?? "medium",

	isNoiseSuppressionEnabled: storedPrefs?.isNoiseSuppressionEnabled ?? true,
	isRnnoiseEnabled: storedPrefs?.isRnnoiseEnabled ?? false,
	isEchoCancellationEnabled: storedPrefs?.isEchoCancellationEnabled ?? false,
	isAutoGainControlEnabled: storedPrefs?.isAutoGainControlEnabled ?? false,

	voiceProcessingPreset: storedPrefs?.voiceProcessingPreset ?? "default",
	voiceProcessingConfig: storedPrefs?.voiceProcessingConfig ?? getVoicePresetConfig("default"),

	voiceActivityThreshold: storedPrefs?.voiceActivityThreshold ?? 35,
	isAutoInputSensitivity: storedPrefs?.isAutoInputSensitivity ?? true,
	participantVolumes: storedPrefs?.participantVolumes ?? [],

	screenShareRuntime: {
		requestedFps: null,
		actualFps: null,
		requestedResolution: null,
		actualResolution: null,
		activePreset: null,
		fallbackReason: null,
		updatedAt: null,
	},
	connectionTestResult: {
		status: "idle",
		summary: null,
		metrics: null,
		recommendation: null,
		error: null,
		updatedAt: null,
	},
	muteMicrophoneHotkey: normalizeKeyboardShortcut(
		storedPrefs?.muteMicrophoneHotkey,
		DEFAULT_MUTE_MICROPHONE_HOTKEY
	),
	toggleCameraHotkey: normalizeKeyboardShortcut(
		storedPrefs?.toggleCameraHotkey,
		DEFAULT_TOGGLE_CAMERA_HOTKEY
	),
	toggleScreenShareHotkey: normalizeKeyboardShortcut(
		storedPrefs?.toggleScreenShareHotkey,
		DEFAULT_TOGGLE_SCREEN_SHARE_HOTKEY
	),
}

const shortcutKeys: ShortcutKey[] = ['muteMicrophoneHotkey', 'toggleCameraHotkey', 'toggleScreenShareHotkey'];
if (shortcutKeys.some((key, index) => shortcutKeys.slice(index + 1).some(other => isKeyboardShortcutEvent(initialState[key], initialState[other])))) {
	initialState.muteMicrophoneHotkey = DEFAULT_MUTE_MICROPHONE_HOTKEY;
	initialState.toggleCameraHotkey = DEFAULT_TOGGLE_CAMERA_HOTKEY;
	initialState.toggleScreenShareHotkey = DEFAULT_TOGGLE_SCREEN_SHARE_HOTKEY;
	initialState.hotkeyError = 'В хранилище найдены совпадающие комбинации. Восстановлены стандартные клавиши.';
}

export const selectMediaDevice = createAsyncThunk(
	'device/selectMediaDevice',
	async ({kind, id}: {kind: MediaDeviceKind; id: string}, {getState}) => {
		const state = getState() as {call: {status: string}; device: DeviceState};
		if (kind === 'audiooutput' && !['connecting', 'in_call'].includes(state.call.status)) {
			const audio = document.createElement('audio');
			await audio.setSinkId(id === 'default' ? '' : id);
		}
		const previousId = kind === 'audioinput' ? state.device.selectedMicrophoneId : kind === 'videoinput' ? state.device.selectedCameraId : state.device.selectedAudioOutputId;
		await switchCallDevice(kind, id, ['connecting', 'in_call'].includes(state.call.status), previousId);
		return {kind, id};
	},
	{condition: (_, {getState}) => !(getState() as {device: DeviceState}).device.deviceSwitchPending},
);

export const deviceSlice = createSlice({
	name: "device",
	initialState: initialState,
	reducers: {
		setNotificationPolicy: (state, action: PayloadAction<Partial<NotificationPolicy>>) => {
			state.notificationPolicy = normalizeNotificationPolicy({ ...state.notificationPolicy, ...action.payload });
			saveStoredPreferences(state);
		},
		setNotificationError: (state, action: PayloadAction<string | null>) => { state.notificationError = action.payload; },
		setHotkeyError: (state, action: PayloadAction<string | null>) => { state.hotkeyError = action.payload; },
		setMediaError: (state, action: PayloadAction<string | null>) => { state.mediaError = action.payload; },
		setNotificationSounds: (state, action: PayloadAction<boolean>) => {
			state.notificationSoundsEnabled = action.payload;
			saveStoredPreferences(state);
		},
		setDesktopNotifications: (state, action: PayloadAction<boolean>) => {
			state.desktopNotificationsEnabled = action.payload;
			saveStoredPreferences(state);
		},
		setCamera: (previousState, action: PayloadAction<string>) => {
			previousState.selectedCameraId = action.payload;
			saveStoredPreferences(previousState);
		},
		setMicrophone: (previousState, action: PayloadAction<string>) => {
			previousState.selectedMicrophoneId = action.payload;
			saveStoredPreferences(previousState);
		},
		setMicrophoneQuality: (state, action: PayloadAction<MicQualitySetting>) => {
			state.micQualitySetting = action.payload;
			saveStoredPreferences(state);
		},
		setMuteMicrophoneHotkey: (state, action: PayloadAction<KeyboardShortcutPreference>) => {
			setShortcut(state, 'muteMicrophoneHotkey', normalizeKeyboardShortcut(
				action.payload,
				DEFAULT_MUTE_MICROPHONE_HOTKEY
			));
		},
		resetMuteMicrophoneHotkey: (state) => {
			setShortcut(state, 'muteMicrophoneHotkey', DEFAULT_MUTE_MICROPHONE_HOTKEY);
		},
		setToggleCameraHotkey: (state, action: PayloadAction<KeyboardShortcutPreference>) => {
			setShortcut(state, 'toggleCameraHotkey', normalizeKeyboardShortcut(
				action.payload,
				DEFAULT_TOGGLE_CAMERA_HOTKEY
			));
		},
		resetToggleCameraHotkey: (state) => {
			setShortcut(state, 'toggleCameraHotkey', DEFAULT_TOGGLE_CAMERA_HOTKEY);
		},
		setToggleScreenShareHotkey: (state, action: PayloadAction<KeyboardShortcutPreference>) => {
			setShortcut(state, 'toggleScreenShareHotkey', normalizeKeyboardShortcut(
				action.payload,
				DEFAULT_TOGGLE_SCREEN_SHARE_HOTKEY
			));
		},
		resetToggleScreenShareHotkey: (state) => {
			setShortcut(state, 'toggleScreenShareHotkey', DEFAULT_TOGGLE_SCREEN_SHARE_HOTKEY);
		},
		setCameraQuality: (previousState, action: PayloadAction<CallQualitySetting>) => {
			previousState.cameraQuality = action.payload;
			saveStoredPreferences(previousState);
		},
		setScreenShareQuality: (previousState, action: PayloadAction<ScreenShareQualitySetting>) => {
			previousState.screenShareQuality = action.payload;
			saveStoredPreferences(previousState);
		},
		setNoiseSuppression: (state, action: PayloadAction<boolean>) => {
			state.isNoiseSuppressionEnabled = action.payload;
			saveStoredPreferences(state);
		},
		setRnnoise: (state, action: PayloadAction<boolean>) => {
			state.isRnnoiseEnabled = action.payload;
			state.voiceProcessingPreset = "custom";
			state.voiceProcessingConfig.rnnoise.enabled = action.payload;
			saveStoredPreferences(state);
		},
		setEchoCancellation: (state, action: PayloadAction<boolean>) => {
			state.isEchoCancellationEnabled = action.payload;
			saveStoredPreferences(state);
		},
		setAutoGainControl: (state, action: PayloadAction<boolean>) => {
			state.isAutoGainControlEnabled = action.payload;
			saveStoredPreferences(state);
		},
		setVoiceActivityThreshold: (state, action: PayloadAction<number>) => {
			state.voiceActivityThreshold = action.payload;
			saveStoredPreferences(state);
		},
		setAutoInputSensitivity: (state, action: PayloadAction<boolean>) => {
			state.isAutoInputSensitivity = action.payload;
			saveStoredPreferences(state);
		},
		setParticipantVolume: (
			state,
			action: PayloadAction<ParticipantVolumePreference>
		) => {
			const { participantIdentity, source, volume } = action.payload;
			const existing = state.participantVolumes.find(
				(item) =>
					item.participantIdentity === participantIdentity && item.source === source
			);
			if (existing) {
				existing.volume = volume;
			} else {
				state.participantVolumes.push({ participantIdentity, source, volume });
			}
			saveStoredPreferences(state);
		},
		setVoiceCompressor: (
			state,
			action: PayloadAction<{
				enabled?: boolean;
				threshold?: number;
				ratio?: number;
				knee?: number;
				attack?: number;
				release?: number;
			}>
		) => {
			state.voiceProcessingPreset = "custom";

			state.voiceProcessingConfig.compressor = {
				...state.voiceProcessingConfig.compressor,
				...action.payload,
			};

			saveStoredPreferences(state);
		},

		setVoiceLimiter: (
			state,
			action: PayloadAction<{
				enabled?: boolean;
				threshold?: number;
				ratio?: number;
				knee?: number;
				attack?: number;
				release?: number;
			}>
		) => {
			state.voiceProcessingPreset = "custom";

			state.voiceProcessingConfig.limiter = {
				...state.voiceProcessingConfig.limiter,
				...action.payload,
			};

			saveStoredPreferences(state);
		},
		resetParticipantVolume: (
			state,
			action: PayloadAction<{ participantIdentity: string; source: ParticipantAudioSource }>
		) => {
			state.participantVolumes = state.participantVolumes.filter(
				(item) =>
					!(
						item.participantIdentity === action.payload.participantIdentity &&
						item.source === action.payload.source
					)
			);
			saveStoredPreferences(state);
		},
		setScreenShareRuntimeInfo: (
			state,
			action: PayloadAction<{
				requestedFps: number | null;
				actualFps: number | null;
				requestedResolution: string | null;
				actualResolution: string | null;
				activePreset: string | null;
				fallbackReason: string | null;
			}>
		) => {
			state.screenShareRuntime = {
				...action.payload,
				updatedAt: new Date().toISOString(),
			};
		},
		setVoiceProcessingPreset: (
			state,
			action: PayloadAction<ZvonokVoicePresetId>
		) => {
			state.voiceProcessingPreset = action.payload;
			if (action.payload !== 'custom') state.voiceProcessingConfig = getVoicePresetConfig(action.payload);

			// так как старая логика этого требует надо будет это пофисить
			state.isRnnoiseEnabled = state.voiceProcessingConfig.rnnoise.enabled;

			saveStoredPreferences(state);
		},
		setVoiceInputVolume: (state, action: PayloadAction<number>) => {
			state.voiceProcessingPreset = "custom";
			state.voiceProcessingConfig.inputVolume = action.payload;
			saveStoredPreferences(state);
		},

		setVoiceOutputVolume: (state, action: PayloadAction<number>) => {
			state.voiceProcessingPreset = "custom";
			state.voiceProcessingConfig.outputVolume = action.payload;
			saveStoredPreferences(state);
		},

		setVoiceRnnoiseEnabled: (state, action: PayloadAction<boolean>) => {
			state.voiceProcessingPreset = "custom";
			state.voiceProcessingConfig.rnnoise.enabled = action.payload;

			// Пока оставляем совместимость со старым полем а не то будет бабах.
			state.isRnnoiseEnabled = action.payload;

			saveStoredPreferences(state);
		},

		setVoiceHighPass: (
			state,
			action: PayloadAction<{ enabled?: boolean; frequency?: number }>
		) => {
			state.voiceProcessingPreset = "custom";

			state.voiceProcessingConfig.highPass = {
				...state.voiceProcessingConfig.highPass,
				...action.payload,
			};

			saveStoredPreferences(state);
		},

		setVoicePresence: (
			state,
			action: PayloadAction<{ enabled?: boolean; frequency?: number; gain?: number; q?: number }>
		) => {
			state.voiceProcessingPreset = "custom";

			state.voiceProcessingConfig.presence = {
				...state.voiceProcessingConfig.presence,
				...action.payload,
			};

			saveStoredPreferences(state);
		},
		setConnectionTestRunning: (state) => {
			state.connectionTestResult.status = "running";
			state.connectionTestResult.error = null;
			state.connectionTestResult.summary = "Testing LiveKit connection...";
			state.connectionTestResult.metrics = null;
			state.connectionTestResult.recommendation = null;
			state.connectionTestResult.updatedAt = null;
		},
		setConnectionTestResult: (
			state,
			action: PayloadAction<Omit<ConnectionTestResult, "status" | "error">>
		) => {
			state.connectionTestResult = {
				...action.payload,
				status: "succeeded",
				error: null,
			};
		},
		setConnectionTestError: (
			state,
			action: PayloadAction<{ message: string; updatedAt: string }>
		) => {
			state.connectionTestResult.status = "failed";
			state.connectionTestResult.error = action.payload.message;
			state.connectionTestResult.summary = "Connection test failed.";
			state.connectionTestResult.updatedAt = action.payload.updatedAt;
		},
		applyConnectionTestRecommendation: (state) => {
			const recommendation = state.connectionTestResult.recommendation;
			if (!recommendation) return;

			state.cameraQuality = recommendation.cameraQuality;
			state.screenShareQuality = recommendation.screenShareQuality;
			saveStoredPreferences(state);
		},
		useAutoQuality: (state) => {
			state.cameraQuality = "auto";
			state.screenShareQuality = "auto";
			saveStoredPreferences(state);
		},
	},
	extraReducers: builder => builder
		.addCase(selectMediaDevice.pending, state => { state.deviceSwitchPending = true; state.mediaError = null; })
		.addCase(selectMediaDevice.fulfilled, (state, {payload: {kind, id}}) => {
			state.deviceSwitchPending = false;
			if (kind === 'audioinput') state.selectedMicrophoneId = id;
			if (kind === 'videoinput') state.selectedCameraId = id;
			if (kind === 'audiooutput') state.selectedAudioOutputId = id;
			saveStoredPreferences(state);
		})
		.addCase(selectMediaDevice.rejected, (state, action) => {
			state.deviceSwitchPending = false;
			state.mediaError = `Устройство не переключено: ${action.error.message ?? 'проверьте разрешения и доступность устройства'}`;
		}),
})

export default deviceSlice.reducer;
export const deviceActions = deviceSlice.actions;
