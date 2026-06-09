export class AudioEngine {
	private ctx: AudioContext;

	private source?: MediaStreamAudioSourceNode;

	private currentDeviceId: string | null = null;
	private currentStream: MediaStream | null = null;

	private inputGain!: GainNode;
	private outputGain!: GainNode;

	private rnnoiseNode?: AudioNode;
	private eqHighPass!: BiquadFilterNode;
	private eqPresence!: BiquadFilterNode;
	private compressor!: DynamicsCompressorNode;
	private limiter!: DynamicsCompressorNode;

	private splitter!: ChannelSplitterNode;
	private merger!: ChannelMergerNode;

	private destination!: MediaStreamAudioDestinationNode;

	private analyser!: AnalyserNode;

	constructor(ctx: AudioContext) {
		this.ctx = ctx;
		this.buildGraph();
	}

	private buildGraph() {
		this.inputGain = this.ctx.createGain();
		this.outputGain = this.ctx.createGain();

		// EQ 
		this.eqHighPass = this.ctx.createBiquadFilter();
		this.eqHighPass.type = "highpass";
		this.eqHighPass.frequency.value = 90;

		this.eqPresence = this.ctx.createBiquadFilter();
		this.eqPresence.type = "peaking";
		this.eqPresence.frequency.value = 3000;
		this.eqPresence.Q.value = 1;
		this.eqPresence.gain.value = 3;

		// Compressor
		this.compressor = this.ctx.createDynamicsCompressor();
		this.compressor.threshold.value = -24;
		this.compressor.ratio.value = 12;

		// Limiter
		this.limiter = this.ctx.createDynamicsCompressor();
		this.limiter.threshold.value = -2;
		this.limiter.ratio.value = 20;

		// Stereo fix
		this.splitter = this.ctx.createChannelSplitter(1);
		this.merger = this.ctx.createChannelMerger(2);

		this.destination = this.ctx.createMediaStreamDestination();

		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = 2048;

		// Static pipeline
		this.inputGain
			.connect(this.eqHighPass)
			.connect(this.eqPresence)
			.connect(this.compressor)
			.connect(this.limiter)
			.connect(this.outputGain)
			.connect(this.splitter);

		this.splitter.connect(this.merger, 0, 0);
		this.splitter.connect(this.merger, 0, 1);

		this.merger.connect(this.analyser);
		this.merger.connect(this.destination);
	}

	public attachStream(stream: MediaStream) {
		if (this.source) {
			this.source.disconnect();
		}

		this.source = this.ctx.createMediaStreamSource(stream);
		this.source.connect(this.inputGain);
	}

	public async enableRnnoise() {
		if (!this.currentStream) return;

		const processTrack = this.currentStream.getAudioTracks()[0];

		const stream = new MediaStream([processTrack]);

		if (this.source) {
			this.source.disconnect();
		}

		this.source = this.ctx.createMediaStreamSource(stream);
		this.source.connect(this.inputGain);
	}

	public disableRnnoise(originalStream: MediaStream) {
		if (this.source) {
			this.source.disconnect();
		}

		this.source = this.ctx.createMediaStreamSource(originalStream);
		this.source.connect(this.inputGain);
	}

	public async setMicDevice(deviceId: string) {
		this.currentDeviceId = deviceId;

		if (this.currentStream) {
			this.currentStream.getTracks().forEach(t => t.stop());
		}

		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: deviceId === "default"
					? undefined
					: { exact: deviceId }
			}
		});

		this.currentStream = stream;

		this.attachStream(stream);
	}

	public setInputVolume(value: number) {
		this.inputGain.gain.value = value;
	}

	public setOutputVolume(value: number) {
		this.outputGain.gain.value = value;
	}

	public getPreviewStream() {
		return this.destination.stream;
	}

	public getAnalyser() {
		return this.analyser;
	}

	public async destroy() {
		if (this.source) {
			this.source.disconnect();
		}

		if (this.currentStream) {
			this.currentStream.getTracks().forEach(track => track.stop());
		}

		this.destination.disconnect();
		this.analyser.disconnect();

		await this.ctx.close();
	}
}
