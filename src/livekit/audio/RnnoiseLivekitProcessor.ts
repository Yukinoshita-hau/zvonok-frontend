import type { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";
import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

export class RnnoiseLiveKitProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {

	name = "rnnoise-audio-processor";

	processedTrack?: MediaStreamTrack | undefined;

	private source?: MediaStreamAudioSourceNode;
	private destination?: MediaStreamAudioDestinationNode;
	private rnnoiseNode?: RnnoiseWorkletNode;

	private wasmBinary?: ArrayBuffer;
	private workletLoadedAudioContext?: AudioContext;

	async init(options: AudioProcessorOptions): Promise<void> {
		await this.createAudioGraph(options);
	}

	async restart(options: AudioProcessorOptions): Promise<void> {
		await this.destroy();
		await this.createAudioGraph(options);
	}

	async destroy(): Promise<void> {
		this.source?.disconnect();
		this.rnnoiseNode?.disconnect();
		this.destination?.disconnect();

		this.rnnoiseNode?.destroy();
		this.processedTrack?.stop();

		this.source = undefined;
		this.rnnoiseNode = undefined;
		this.destination = undefined;
		this.processedTrack = undefined;
	}

	private async createAudioGraph(options: AudioProcessorOptions): Promise<void> {
		const { track, audioContext } = options;

		if (!this.wasmBinary) {
			this.wasmBinary = await loadRnnoise({
				url: rnnoiseWasmPath,
				simdUrl: rnnoiseSimdWasmPath
			});
		}

		if (this.workletLoadedAudioContext !== audioContext) {

			await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);
			this.workletLoadedAudioContext = audioContext;
		}

		this.source = audioContext.createMediaStreamSource(
			new MediaStream([track])
		)

		this.rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
			wasmBinary: this.wasmBinary,
			maxChannels: 1
		})

		this.destination = audioContext.createMediaStreamDestination();

		this.source.connect(this.rnnoiseNode);
		this.rnnoiseNode.connect(this.destination);

		const [processedTrack] = this.destination.stream.getAudioTracks();

		if (!processedTrack) {
			throw new Error("RNNoise processed audio track was not created");
		}

		this.processedTrack = processedTrack;
	}
}

