import type { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";
import { ZvonokAudioGraph, type ZvonokAudioGraphConfig } from "./GlobalAudioGraph";


export class ZvonokLiveKitAudioProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
	name = "zvonok-audio-processor";

	processedTrack?: MediaStreamTrack | undefined;

	private audioGraph?: ZvonokAudioGraph;

	constructor(private readonly config: ZvonokAudioGraphConfig) {}

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

	async restart(options: AudioProcessorOptions): Promise<void> {
		await this.init(options);
	}

	async destroy(): Promise<void> {
		await this.audioGraph?.destroy();

		this.audioGraph = undefined;
		this.processedTrack = undefined;
	}
}
