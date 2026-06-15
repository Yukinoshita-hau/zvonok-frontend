import { type ZvonokAudioGraphConfig, type ZvonokVoicePresetId } from "./ZvonokAudioGraphConfig";

export const DEFAULT_VOICE_PRESET: ZvonokAudioGraphConfig = {
	stereoOutput: true,

	inputVolume: 1,
	outputVolume: 1,

	rnnoise: {
		enabled: false,
	},

	highPass: {
		enabled: true,
		frequency: 90,
	},

	presence: {
		enabled: true,
		frequency: 3000,
		gain: 3,
		q: 1,
	},

	compressor: {
		enabled: true,
		threshold: -30,
		ratio: 8,
		knee: 10,
		attack: 0.003,
		release: 0.18,
	},

	limiter: {
		enabled: true,
		threshold: -8,
		ratio: 20,
		knee: 0,
		attack: 0.001,
		release: 0.06,
	},
};	

export const CLEAR_VOICE_PRESET: ZvonokAudioGraphConfig = {
	...DEFAULT_VOICE_PRESET,

	rnnoise: {
		enabled: true,
	},

	highPass: {
		enabled: true,
		frequency: 100,
	},

	presence: {
		enabled: true,
		frequency: 3200,
		gain: 4,
		q: 1,
	},

	outputVolume: 0.9,
}

export const SOFT_VOICE_PRESET: ZvonokAudioGraphConfig = {
	...DEFAULT_VOICE_PRESET,

	rnnoise: {
		enabled: false,
	},

	highPass: {
		enabled: true,
		frequency: 80,
	},

	presence: {
		enabled: true,
		frequency: 2800,
		gain: 1.5,
		q: 0.8,
	},

	compressor: {
		enabled: true,
		threshold: -26,
		ratio: 4,
		knee: 16,
		attack: 0.006,
		release: 0.25,
	},

	limiter: {
		enabled: true,
		threshold: -6,
		ratio: 16,
		knee: 0,
		attack: 0.001,
		release: 0.08,
	},

	outputVolume: 1,
}


export const VOICE_PRESETS: Record<
	Exclude<ZvonokVoicePresetId, "custom">,
	ZvonokAudioGraphConfig
> = {
	default: DEFAULT_VOICE_PRESET,
	clearVoice: CLEAR_VOICE_PRESET,
	softVoice: SOFT_VOICE_PRESET
}

export function cloneAudioConfig(config: ZvonokAudioGraphConfig): ZvonokAudioGraphConfig {
	return structuredClone(config);
}

export function getVoicePresetConfig(presetId: Exclude<ZvonokVoicePresetId, "custom">): ZvonokAudioGraphConfig {
	return cloneAudioConfig(VOICE_PRESETS[presetId]);	
}

export function volumePercentToGain(percent: number): number {
	const safePercent = Math.min(300, Math.max(0, percent));

	return safePercent / 100;
}

export function gainToVolumePercent(gain: number): number {
	return Math.round(gain * 100);
}

