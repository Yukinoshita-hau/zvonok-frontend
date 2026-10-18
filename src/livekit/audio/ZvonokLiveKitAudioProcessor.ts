import type { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";
import { ZvonokAudioGraph } from "./GlobalAudioGraph";
import type { ZvonokAudioGraphConfig } from "./ZvonokAudioGraphConfig";


export class ZvonokLiveKitAudioProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
	name = "zvonok-audio-processor";

	processedTrack?: MediaStreamTrack | undefined;

	private audioGraph?: ZvonokAudioGraph;
	private lifecycle = 0;

	private config: ZvonokAudioGraphConfig;

	constructor(config: ZvonokAudioGraphConfig) { this.config = config; }

	async init(options: AudioProcessorOptions): Promise<void> {
		const lifecycle = ++this.lifecycle;
		const previous = this.audioGraph;
		this.audioGraph = undefined;
		this.processedTrack = undefined;
		await previous?.destroy();
		if (lifecycle !== this.lifecycle) return;

		const audioGraph = new ZvonokAudioGraph({
			...this.config,
			stereoOutput: true
		});

		try {
			await audioGraph.attachTrack(options.track);
		} catch (error) {
			await audioGraph.destroy();
			throw error;
		}
		if (lifecycle !== this.lifecycle) {
			await audioGraph.destroy();
			return;
		}

		this.audioGraph = audioGraph;
		this.processedTrack = audioGraph.getProcessedTrack();
	}

	async updateConfig(nextConfig: ZvonokAudioGraphConfig): Promise<void> {
		this.config = {
			...nextConfig,
			stereoOutput: true
		}

		await this.audioGraph?.updateConfig(this.config);	
	}

	async restart(options: AudioProcessorOptions): Promise<void> {
		await this.init(options);
	}

	async destroy(): Promise<void> {
		this.lifecycle++;
		const graph = this.audioGraph;
		this.audioGraph = undefined;
		this.processedTrack = undefined;
		await graph?.destroy();
	}
}
