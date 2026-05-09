import type { AudioCaptureOptions } from "livekit-client";

export type MicQualitySetting = "economy" | "balanced" | "studio" | "gaming";

export interface MicQualityPreset {
	value: MicQualitySetting;
	label: string;
	description: string;
	latency?: number;
	sampleRate: number;
	channelCount: 1 | 2;
	autoGainControl: boolean;
	echoCancellation: boolean;
	noiseSuppression: boolean;
	voiceIsolation?: boolean;
	warning?: string;
}

export const MICROPHONE_QUALITY_PRESETS: Record<MicQualitySetting, MicQualityPreset> = {
	economy: {
		value: "economy",
		label: "Economy",
		description: "Lower CPU/network impact for unstable connections.",
		latency: 0.03,
		sampleRate: 24000,
		channelCount: 1,
		autoGainControl: true,
		echoCancellation: true,
		noiseSuppression: true,
		voiceIsolation: false,
	},
	balanced: {
		value: "balanced",
		label: "Balanced",
		description: "Default voice quality and stability.",
		latency: 0.02,
		sampleRate: 48000,
		channelCount: 1,
		autoGainControl: true,
		echoCancellation: true,
		noiseSuppression: true,
		voiceIsolation: true,
	},
	studio: {
		value: "studio",
		label: "Studio Voice",
		description: "Prioritizes cleaner voice quality over latency.",
		latency: 0.01,
		sampleRate: 48000,
		channelCount: 2,
		autoGainControl: false,
		echoCancellation: false,
		noiseSuppression: false,
		voiceIsolation: false,
		warning: "May increase CPU usage and end-to-end latency.",
	},
	gaming: {
		value: "gaming",
		label: "Gaming Voice",
		description: "Lower latency voice response with balanced processing.",
		latency: 0.01,
		sampleRate: 48000,
		channelCount: 1,
		autoGainControl: false,
		echoCancellation: true,
		noiseSuppression: false,
		voiceIsolation: false,
		warning: "Background noise suppression may be weaker.",
	},
};

export function getMicrophoneCaptureOptions(
	params: {
		selectedMicrophoneId: string;
		micQualitySetting: MicQualitySetting;
		isAutoGainControlEnabled: boolean;
		isEchoCancellationEnabled: boolean;
		isNoiseSuppressionEnabled: boolean;
	}
): AudioCaptureOptions {
	const preset = MICROPHONE_QUALITY_PRESETS[params.micQualitySetting];

	return {
		deviceId:
			params.selectedMicrophoneId !== "default"
				? params.selectedMicrophoneId
				: undefined,
		autoGainControl: params.isAutoGainControlEnabled && preset.autoGainControl,
		echoCancellation: params.isEchoCancellationEnabled && preset.echoCancellation,
		noiseSuppression: params.isNoiseSuppressionEnabled && preset.noiseSuppression,
		voiceIsolation: params.isNoiseSuppressionEnabled && (preset.voiceIsolation ?? false),
		channelCount: preset.channelCount,
		sampleRate: preset.sampleRate,
		sampleSize: 16,
		latency: preset.latency,
	};
}
