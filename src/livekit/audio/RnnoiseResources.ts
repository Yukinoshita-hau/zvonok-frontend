import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";

import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

class RnnoiseResources {
	private wasmBinary?: Promise<ArrayBuffer>;

	private loadedContexts = new WeakMap<AudioContext, Promise<void>>;

	async createNode(audioContext: AudioContext): Promise<RnnoiseWorkletNode> {
		this.wasmBinary ??= loadRnnoise({
			url: rnnoiseWasmPath,
			simdUrl: rnnoiseSimdWasmPath,
		}).catch(error => { this.wasmBinary = undefined; throw error; });
		const wasmBinary = await this.wasmBinary;
		let module = this.loadedContexts.get(audioContext);
		if (!module) {
			module = audioContext.audioWorklet.addModule(rnnoiseWorkletPath).catch(error => {
				this.loadedContexts.delete(audioContext);
				throw error;
			});
			this.loadedContexts.set(audioContext, module);
		}
		await module;

		return new RnnoiseWorkletNode(audioContext, {
			wasmBinary,
			maxChannels: 1,
		});
	}
}

export const rnnoiseResources = new RnnoiseResources();
