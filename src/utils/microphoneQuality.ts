import {
	AudioPresets,
	type AudioCaptureOptions,
	type AudioPreset,
	type TrackPublishOptions,
} from "livekit-client";

export type MicQualitySetting =
	| "potato"
	| "stable"
	| "clear"
	| "gaming"
	| "studio"
	| "boosted";

export interface MicQualityPreset {
	value: MicQualitySetting;
	label: string;
	description: string;
	latency?: number;

	sampleRate: number;
	channelCount: 1;

	autoGainControl: boolean;
	echoCancellation: boolean;
	noiseSuppression: boolean;
	voiceIsolation?: boolean;

	maxBitrate: number;
	publishLabel: string;
	audioPreset: AudioPreset;

	warning?: string;
}

export const MICROPHONE_QUALITY_PRESETS: Record<
	MicQualitySetting,
	MicQualityPreset
> = {
	potato: {
		value: "potato",
		label: "Potato Mic",
		description: "лучшее качество",
		latency: 0.03,
		sampleRate: 24000,
		channelCount: 1,

		autoGainControl: false,
		echoCancellation: false,
		noiseSuppression: false,
		voiceIsolation: false,

		maxBitrate: 12_000,
		publishLabel: "12 kbps",
		audioPreset: AudioPresets.telephone,

		warning: "Качество специально хорошее.",
	},

	stable: {
		value: "stable",
		label: "Stable Voice",
		description: "Стабильный режим для слабого интернета.",
		latency: 0.03,
		sampleRate: 48000,
		channelCount: 1,

		autoGainControl: false,
		echoCancellation: false,
		noiseSuppression: true,
		voiceIsolation: false,

		maxBitrate: 64_000,
		publishLabel: "64 kbps",
		audioPreset: {
			maxBitrate: 64_000,
		},
	},

	clear: {
		value: "clear",
		label: "Clear Voice",
		description: "Нормальный дефолт: чистый голос без дикого расхода трафика.",
		latency: 0.02,
		sampleRate: 48000,
		channelCount: 1,

		autoGainControl: false,
		echoCancellation: false,
		noiseSuppression: true,
		voiceIsolation: true,

		maxBitrate: 128_000,
		publishLabel: "128 kbps",
		audioPreset: {
			maxBitrate: 128_000,
		},
	},

	gaming: {
		value: "gaming",
		label: "Low Latency",
		description: "Для игр: меньше задержка, качество достаточно хорошее.",
		latency: 0.01,
		sampleRate: 48000,
		channelCount: 1,

		autoGainControl: false,
		echoCancellation: false,
		noiseSuppression: true,
		voiceIsolation: false,

		maxBitrate: 96_000,
		publishLabel: "96 kbps",
		audioPreset: AudioPresets.musicHighQuality,

		warning: "Приоритет — задержка, а не максимальная жирность голоса.",
	},

	studio: {
		value: "studio",
		label: "Studio Voice",
		description: "Жирный голос для хорошего микрофона и стабильного интернета.",
		latency: 0.01,
		sampleRate: 48000,
		channelCount: 1,

		autoGainControl: false,
		echoCancellation: false,
		noiseSuppression: true,
		voiceIsolation: false,

		maxBitrate: 256_000,
		publishLabel: "256 kbps",
		audioPreset: {
			maxBitrate: 256_000,
		},

		warning: "Использует больше трафика. Лучше включать с хорошим микрофоном.",
	},

	boosted: {
		value: "boosted",
		label: "Boosted Voice",
		description: "Максимальный режим: много битрейта для голоса.",
		latency: 0.01,
		sampleRate: 48000,
		channelCount: 1,

		autoGainControl: false,
		echoCancellation: false,
		noiseSuppression: true,
		voiceIsolation: false,

		maxBitrate: 384_000,
		publishLabel: "384 kbps",
		audioPreset: {
			maxBitrate: 384_000,
		},

		warning: "Оверкилл для обычной речи, но звучит максимально жирно при хорошем микрофоне.",
	},
};

export function normalizeMicQualitySetting(value: unknown): MicQualitySetting {
	switch (value) {
		case "potato":
		case "stable":
		case "clear":
		case "gaming":
		case "studio":
		case "boosted":
			return value;

		case "economy":
			return "stable";

		case "balanced":
			return "clear";

		default:
			return "clear";
	}
}

export function getMicrophoneCaptureOptions(params: {
	selectedMicrophoneId: string;
	micQualitySetting: MicQualitySetting;
	isAutoGainControlEnabled: boolean;
	isEchoCancellationEnabled: boolean;
	isNoiseSuppressionEnabled: boolean;
	isRnnoiseEnabled: boolean;
}): AudioCaptureOptions {
	const preset = MICROPHONE_QUALITY_PRESETS[params.micQualitySetting];

	const shouldUseRnnoise = params.isRnnoiseEnabled;

	return {
		deviceId:
			params.selectedMicrophoneId !== "default"
				? params.selectedMicrophoneId
				: undefined,

		autoGainControl: false,

		echoCancellation:
			params.isEchoCancellationEnabled && preset.echoCancellation,

		noiseSuppression: shouldUseRnnoise
			? false
			: params.isNoiseSuppressionEnabled && preset.noiseSuppression,

		voiceIsolation: shouldUseRnnoise
			? false
			: params.isNoiseSuppressionEnabled && (preset.voiceIsolation ?? false),

		channelCount: 1,

		sampleRate: shouldUseRnnoise ? 48000 : preset.sampleRate,

		sampleSize: 16,
		latency: preset.latency,
	};
}

export function getMicrophonePublishOptions(
	micQualitySetting: MicQualitySetting
): TrackPublishOptions {
	const preset = MICROPHONE_QUALITY_PRESETS[micQualitySetting];

	return {
		audioPreset: preset.audioPreset,
		dtx: true,
		red: true,
		forceStereo: false,
	};
}
