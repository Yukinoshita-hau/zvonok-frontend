import type { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";

export class PassThroughAudioProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
	name = "pass-through-audio-processor";

	processedTrack?: MediaStreamTrack | undefined;

	private source?: MediaStreamAudioSourceNode;
	private destination?: MediaStreamAudioDestinationNode;
	private gain?: GainNode;

	async init(options: AudioProcessorOptions): Promise<void> {
		console.log("[rnnoise-debug] processor init");

		this.createAudioGraph(options);
	}

	async restart(options: AudioProcessorOptions): Promise<void> {
		console.log("[rnnoise-debug] processor restart");

		await this.destroy();
		this.createAudioGraph(options);
	}

	async destroy(): Promise<void> {
		console.log("[rnnoise-debug] processor destroy");

		this.source?.disconnect();
		this.gain?.disconnect();
		this.destination?.disconnect();

		this.processedTrack?.stop();

		this.source = undefined;
		this.gain = undefined;
		this.destination = undefined;
		this.processedTrack = undefined;
	}

	private createAudioGraph(options: AudioProcessorOptions): void {
		const { track, audioContext } = options;	

		this.source = audioContext.createMediaStreamSource(
			new MediaStream([track])
		);

		this.gain = audioContext.createGain();

		this.gain.gain.value = 1;

		this.destination = audioContext.createMediaStreamDestination();

		this.source.connect(this.gain);
		this.gain.connect(this.destination);

		const [processedTrack] = this.destination.stream.getAudioTracks();

		if (!processedTrack) {
			throw new Error("Processed audio track was not created");
		}

		this.processedTrack = processedTrack;

		console.log("[rnnoise-debug] processed track created: ", processedTrack);
	}
}
