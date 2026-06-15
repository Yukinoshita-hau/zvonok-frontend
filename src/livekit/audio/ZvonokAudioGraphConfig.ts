
export type ZvonokVoicePresetId =
	| "default"
	| "clearVoice"
	| "softVoice"
	| "custom"

export interface ZvonokAudioGraphConfig {
	stereoOutput: boolean;

	/**
	* 1 это 100%
	* 0.5 это 50%
	* 1.5 это 150%
	* 2 это 200%
	*/
	inputVolume: number;
	outputVolume: number;

	rnnoise: {
		enabled: boolean;
	};

	highPass: {
		enabled: boolean;
		frequency: number;
	};

	presence: {
		enabled: boolean;
		frequency: number;
		gain: number;
		q: number;
	};

	compressor: {
		enabled: boolean;
		threshold: number;
		ratio: number;
		knee: number;
		attack: number;
		release: number;
	};

	limiter: {
		enabled: boolean;
		threshold: number;
		ratio: number;
		knee: number;
		attack: number;
		release: number;
	}
}

