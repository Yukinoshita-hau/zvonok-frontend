import type { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";
import { ZvonokAudioGraph } from "./GlobalAudioGraph";
import type { ZvonokAudioGraphConfig } from "./ZvonokAudioGraphConfig";


export class ZvonokLiveKitAudioProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
	name = "zvonok-audio-processor";

	processedTrack?: MediaStreamTrack | undefined;

	private audioGraph?: ZvonokAudioGraph;

	constructor(private config: ZvonokAudioGraphConfig) {}

	async init(options: AudioProcessorOptions): Promise<void> {
		await this.destroy();

		const audioGraph = new ZvonokAudioGraph({
			...this.config,
			stereoOutput: false
		});

		await audioGraph.attachTrack(options.track);

		this.audioGraph = audioGraph;
		this.processedTrack = audioGraph.getProcessedTrack();
	}

	async updateConfig(nextConfig: ZvonokAudioGraphConfig): Promise<void> {
		this.config = {
			...nextConfig,
			stereoOutput: false
		}

		await this.audioGraph?.updateConfig(this.config);	
	}

	async restart(options: AudioProcessorOptions): Promise<void> {
		await this.init(options);
	}

	async destroy(): Promise<void> {
		await this.audioGraph?.destroy();

		this.audioGraph = undefined;
		this.processedTrack = undefined;
	}
}
