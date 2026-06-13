import type { RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";
import { rnnoiseResources } from "./RnnoiseResources";

export interface ZvonokAudioGraphConfig {
	rnnoiseEnabled: boolean;
	inputVolume?: number;
	outputVolume?: number;
	stereoOutput?: boolean;
}

export class ZvonokAudioGraph {
	private readonly audioContext: AudioContext;

	private config: ZvonokAudioGraphConfig;

	private source?: MediaStreamAudioSourceNode;
	private sourceStream?: MediaStream;

	private inputGain: GainNode;
	private outputGain: GainNode;

	private rnnoiseNode?: RnnoiseWorkletNode;

	private highPass: BiquadFilterNode;
	private presence: BiquadFilterNode;
	private compressor: DynamicsCompressorNode;
	private limiter: DynamicsCompressorNode;

	private splitter: ChannelSplitterNode;
	private merger: ChannelMergerNode;

	private analyser: AnalyserNode;
	private destination: MediaStreamAudioDestinationNode;

	private destroyed = false;

	constructor(config: ZvonokAudioGraphConfig) {
		this.config = {
			inputVolume: 1,
			outputVolume: 1,
			stereoOutput: true,
			...config,
		};

		this.audioContext = new AudioContext();

		this.inputGain = this.audioContext.createGain();
		this.outputGain = this.audioContext.createGain();

		this.inputGain.gain.value = this.config.inputVolume ?? 1;
		this.outputGain.gain.value = this.config.outputVolume ?? 1;

		this.highPass = this.audioContext.createBiquadFilter();
		this.highPass.type = "highpass";
		this.highPass.frequency.value = 90;

		this.presence = this.audioContext.createBiquadFilter();
		this.presence.type = "peaking";
		this.presence.frequency.value = 3000;
		this.presence.Q.value = 1;
		this.presence.gain.value = 3;

		this.compressor = this.audioContext.createDynamicsCompressor();

		this.compressor.threshold.value = -30;
		this.compressor.ratio.value = 8;
		this.compressor.knee.value = 10;
		this.compressor.attack.value = 0.003;
		this.compressor.release.value = 0.18;

		this.limiter = this.audioContext.createDynamicsCompressor();

		this.limiter.threshold.value = -8;
		this.limiter.ratio.value = 20;
		this.limiter.knee.value = 0;
		this.limiter.attack.value = 0.001;
		this.limiter.release.value = 0.06;

		this.splitter = this.audioContext.createChannelSplitter(1);
		this.merger = this.audioContext.createChannelMerger(2);

		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftSize = 2048;

		this.destination = this.audioContext.createMediaStreamDestination();
	}

	async attachTrack(track: MediaStreamTrack): Promise<void> {
		if (this.destroyed) return;

		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}

		this.sourceStream = new MediaStream([track]);

		await this.rebuildGraph();
	}

	async setRnnoiseEnabled(enabled: boolean): Promise<void> {
		if (this.config.rnnoiseEnabled === enabled) return;

		this.config = {
			...this.config,
			rnnoiseEnabled: enabled
		};

		await this.rebuildGraph();
	}

	setInputVolume(value: number): void {
		this.inputGain.gain.value = value;
		this.config.inputVolume = value;
	}


	setOutputVolume(value: number): void {
		this.outputGain.gain.value = value;
		this.config.outputVolume = value;
	}

	getOutputStream(): MediaStream {
		return this.destination.stream;
	}

	getAnalyser(): AnalyserNode {
		return this.analyser;
	}

	getProcessedTrack(): MediaStreamTrack {
		const track = this.destination.stream.getAudioTracks()[0];

		if (!track) {
			throw new Error("Processed audio track is not ready");
		}

		return track;
	}

	private async rebuildGraph(): Promise<void> {
		if (!this.sourceStream) return;

		this.disconnectGraph();

		this.source = this.audioContext.createMediaStreamSource(this.sourceStream);

		if (this.config.rnnoiseEnabled) {
			const rnnoiseNode = await rnnoiseResources.createNode(this.audioContext);

			if (this.destroyed) {
				rnnoiseNode.disconnect();
				return;
			}

			this.rnnoiseNode = rnnoiseNode;

			this.source
				.connect(this.inputGain)
				.connect(rnnoiseNode)
				.connect(this.highPass)
				.connect(this.presence)
				.connect(this.compressor)
				.connect(this.limiter)

			this.connectTail(this.limiter);
		} else {
			this.rnnoiseNode = undefined;

			this.source
				.connect(this.inputGain)
				.connect(this.highPass)
				.connect(this.presence)
				.connect(this.compressor)
				.connect(this.limiter)

			this.connectTail(this.limiter);
		}
	}

	// Mono -> stereo.
	// Микрофон обычно mono, но preview иногда может рофлить и играет в одно ухо.
	private connectTail(node: AudioNode): void {
		node.connect(this.outputGain);

		if (this.config.stereoOutput) {
			this.outputGain.connect(this.splitter);

			this.splitter.connect(this.merger, 0, 0)
			this.splitter.connect(this.merger, 0, 1)

			this.merger.connect(this.analyser);
			this.merger.connect(this.destination);
		} else {
			this.outputGain.connect(this.analyser);
			this.outputGain.connect(this.destination);
		}
	}

	private disconnectGraph(): void {
		this.source?.disconnect();
		this.inputGain.disconnect();
		this.rnnoiseNode?.disconnect();
		this.highPass.disconnect();
		this.presence.disconnect();
		this.compressor.disconnect();
		this.limiter.disconnect();
		this.outputGain.disconnect();
		this.splitter.disconnect();
		this.merger.disconnect();
		this.analyser.disconnect();
	}

	async destroy(): Promise<void> {
		if (this.destroyed) return;

		this.destroyed = true;

		this.disconnectGraph();

		this.destination.stream.getTracks().forEach((track) => track.stop());

		await this.audioContext.close();
	}

	async updateConfig(nextConfig: Partial<ZvonokAudioGraphConfig>): Promise<void> {
		if (this.destroyed) return;

		const shouldRebuild =
			(nextConfig.rnnoiseEnabled !== undefined &&
			nextConfig.rnnoiseEnabled !== this.config.rnnoiseEnabled) ||
			(nextConfig.stereoOutput !== undefined &&
			nextConfig.stereoOutput !== this.config.stereoOutput);

		this.config = {
			...this.config,
			...nextConfig,
		};

		if (nextConfig.inputVolume !== undefined) {
			this.inputGain.gain.value = nextConfig.inputVolume;
		}

		if (nextConfig.outputVolume !== undefined) {
			this.outputGain.gain.value = nextConfig.outputVolume;
		}

		if (shouldRebuild) {
			await this.rebuildGraph();
		}
	}

}
