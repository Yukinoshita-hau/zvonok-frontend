import type { RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";
import { rnnoiseResources } from "./RnnoiseResources";
import type { ZvonokAudioGraphConfig } from "./ZvonokAudioGraphConfig";

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
		this.config = config;

		this.audioContext = new AudioContext();

		this.inputGain = this.audioContext.createGain();
		this.outputGain = this.audioContext.createGain();

		this.highPass = this.audioContext.createBiquadFilter();
		this.presence = this.audioContext.createBiquadFilter();
		this.compressor = this.audioContext.createDynamicsCompressor();
		this.limiter = this.audioContext.createDynamicsCompressor();

		this.splitter = this.audioContext.createChannelSplitter(1);
		this.merger = this.audioContext.createChannelMerger(2);

		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftSize = 2048;

		this.destination = this.audioContext.createMediaStreamDestination();

		this.applyConfigToNodes();
	}

	async attachTrack(track: MediaStreamTrack): Promise<void> {
		if (this.destroyed) return;

		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}

		this.sourceStream = new MediaStream([track]);

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
		this.applyConfigToNodes();

		this.source = this.audioContext.createMediaStreamSource(this.sourceStream);

		let currentNode: AudioNode = this.source.connect(this.inputGain);

		if (this.config.rnnoise.enabled) {
			const rnnoiseNode = await rnnoiseResources.createNode(this.audioContext);

			if (this.destroyed) {
				rnnoiseNode.disconnect();
				return;
			}

			this.rnnoiseNode = rnnoiseNode;

			currentNode = currentNode.connect(rnnoiseNode);
		} else {
			this.rnnoiseNode = undefined;
		}

		if (this.config.highPass.enabled) {
			currentNode = currentNode.connect(this.highPass);
		}

		if (this.config.presence.enabled) {
			currentNode = currentNode.connect(this.presence);
		}

		if (this.config.compressor.enabled) {
			currentNode = currentNode.connect(this.compressor);
		}

		if (this.config.limiter.enabled) {
			currentNode = currentNode.connect(this.limiter);
		}

		this.connectTail(currentNode);
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

	async updateConfig(nextConfig: ZvonokAudioGraphConfig): Promise<void> {
		if (this.destroyed) return;

		const shouldRebuild =
			nextConfig.rnnoise.enabled !== this.config.rnnoise.enabled ||
			nextConfig.highPass.enabled !== this.config.highPass.enabled ||
			nextConfig.presence.enabled !== this.config.presence.enabled ||
			nextConfig.compressor.enabled !== this.config.compressor.enabled ||
			nextConfig.limiter.enabled !== this.config.limiter.enabled ||
			nextConfig.stereoOutput !== this.config.stereoOutput;

		this.config = nextConfig;
		this.applyConfigToNodes();

		if (shouldRebuild) {
			await this.rebuildGraph();
		}
	}

	private applyConfigToNodes(): void {
		this.setAudioParamValue(this.inputGain.gain, this.config.inputVolume);
		this.setAudioParamValue(this.outputGain.gain, this.config.outputVolume);

		this.highPass.type = "highpass";
		this.highPass.frequency.value = this.config.highPass.frequency;

		this.presence.type = "peaking";
		this.presence.frequency.value = this.config.presence.frequency;
		this.presence.gain.value = this.config.presence.gain;
		this.presence.Q.value = this.config.presence.q;

		this.compressor.threshold.value = this.config.compressor.threshold;
		this.compressor.ratio.value = this.config.compressor.ratio;
		this.compressor.knee.value = this.config.compressor.knee;
		this.compressor.attack.value = this.config.compressor.attack;
		this.compressor.release.value = this.config.compressor.release;

		this.limiter.threshold.value = this.config.limiter.threshold;
		this.limiter.ratio.value = this.config.limiter.ratio;
		this.limiter.knee.value = this.config.limiter.knee;
		this.limiter.attack.value = this.config.limiter.attack;
		this.limiter.release.value = this.config.limiter.release;
	}

	private setAudioParamValue(param: AudioParam, value: number): void {
		const now = this.audioContext.currentTime;

		param.cancelScheduledValues(now);

		if (value === 0) {
			param.setValueAtTime(0, now);
			return;
		}

		param.setTargetAtTime(value, now, 0.015);
	}
}
