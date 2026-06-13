import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";

import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

class RnnoiseResources {
	private wasmBinary?: ArrayBuffer;

	private loadedContexts = new WeakSet<AudioContext>;

	async createNode(audioContext: AudioContext): Promise<RnnoiseWorkletNode> {
		if (!this.wasmBinary) {
			this.wasmBinary = await loadRnnoise({
				url: rnnoiseWasmPath,
				simdUrl: rnnoiseSimdWasmPath,
			});
		}

		if (!this.loadedContexts.has(audioContext)) {
			await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);
			this.loadedContexts.add(audioContext);
		}

		return new RnnoiseWorkletNode(audioContext, {
			wasmBinary: this.wasmBinary,
			maxChannels: 1,
		});
	}
}

export const rnnoiseResources = new RnnoiseResources();
