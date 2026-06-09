import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";

import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

export class RnnoiseProcessor {
	private wasmBinary?: ArrayBuffer;
	private loadedContext?: AudioContext;

	async createNode(
		audioContext: AudioContext
	): Promise<RnnoiseWorkletNode> {

		if (!this.wasmBinary) {
			this.wasmBinary = await loadRnnoise({
				url: rnnoiseWasmPath,
				simdUrl: rnnoiseSimdWasmPath,
			});
		}

		if (this.loadedContext !== audioContext) {
			await audioContext.audioWorklet.addModule(
				rnnoiseWorkletPath
			);

			this.loadedContext = audioContext;
		}

		return new RnnoiseWorkletNode(audioContext, {
			wasmBinary: this.wasmBinary,
			maxChannels: 1,
		});
	}
}
