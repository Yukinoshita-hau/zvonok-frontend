import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
	CallQualityRecommendation,
	CallQualitySetting,
	NetworkQualityMetrics,
	ScreenShareQualitySetting,
} from "../../utils/callQuality";
import type { MicQualitySetting } from "../../utils/microphoneQuality";

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
	selectedCameraId: string;
	selectedMicrophoneId: string;
	micQualitySetting: MicQualitySetting;
	cameraQuality: CallQualitySetting;
	screenShareQuality: ScreenShareQualitySetting;
	isNoiseSuppressionEnabled: boolean;
	isEchoCancellationEnabled: boolean;
	isAutoGainControlEnabled: boolean;
	voiceActivityThreshold: number;
	isAutoInputSensitivity: boolean;
	participantVolumes: ParticipantVolumePreference[];
	screenShareRuntime: ScreenShareRuntimeInfo;
	connectionTestResult: ConnectionTestResult;
}

const DEVICE_PREFS_STORAGE_KEY = "device-preferences-v2";

function loadStoredPreferences() {
	try {
		const raw = localStorage.getItem(DEVICE_PREFS_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as Partial<DeviceState>;
	} catch (error) {
		console.error("Failed to parse device preferences", error);
		return null;
	}
}

function saveStoredPreferences(state: DeviceState) {
	try {
		localStorage.setItem(
			DEVICE_PREFS_STORAGE_KEY,
			JSON.stringify({
				selectedCameraId: state.selectedCameraId,
				selectedMicrophoneId: state.selectedMicrophoneId,
				micQualitySetting: state.micQualitySetting,
				cameraQuality: state.cameraQuality,
				screenShareQuality: state.screenShareQuality,
				isNoiseSuppressionEnabled: state.isNoiseSuppressionEnabled,
				isEchoCancellationEnabled: state.isEchoCancellationEnabled,
				isAutoGainControlEnabled: state.isAutoGainControlEnabled,
				voiceActivityThreshold: state.voiceActivityThreshold,
				isAutoInputSensitivity: state.isAutoInputSensitivity,
				participantVolumes: state.participantVolumes,
			})
		);
	} catch (error) {
		console.error("Failed to save device preferences", error);
	}
}

const storedPrefs = loadStoredPreferences();

const initialState: DeviceState = {
	selectedCameraId: storedPrefs?.selectedCameraId ?? "default",
	selectedMicrophoneId: storedPrefs?.selectedMicrophoneId ?? "default",
	micQualitySetting: storedPrefs?.micQualitySetting ?? "balanced",
	cameraQuality: storedPrefs?.cameraQuality ?? "high",
	screenShareQuality: storedPrefs?.screenShareQuality ?? "medium",
	isNoiseSuppressionEnabled: storedPrefs?.isNoiseSuppressionEnabled ?? true,
	isEchoCancellationEnabled: storedPrefs?.isEchoCancellationEnabled ?? true,
	isAutoGainControlEnabled: storedPrefs?.isAutoGainControlEnabled ?? true,
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
}

export const deviceSlice = createSlice({
	name: "device",
	initialState: initialState,
	reducers: {
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
		}
	}
})

export default deviceSlice.reducer;
export const deviceActions = deviceSlice.actions;
