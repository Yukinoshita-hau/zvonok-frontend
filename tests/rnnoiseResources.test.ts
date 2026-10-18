import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), nodes: [] as unknown[] }));
vi.mock("@sapphi-red/web-noise-suppressor", () => ({
	loadRnnoise: mocks.load,
	RnnoiseWorkletNode: class {
		constructor(...args: unknown[]) {
			mocks.nodes.push(args);
		}
	},
}));
afterEach(() => {
	mocks.load.mockReset();
	mocks.nodes = [];
	vi.unstubAllGlobals();
});
describe("RNNoise loading", () => {
	it("shares pending WASM and worklet-module loads for one context", async () => {
		vi.resetModules();
		let finish!: (buffer: ArrayBuffer) => void;
		mocks.load.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const context = {
			audioWorklet: { addModule: vi.fn(async () => {}) },
		} as unknown as AudioContext;
		const { rnnoiseResources } = await import("../src/livekit/audio/RnnoiseResources");
		const first = rnnoiseResources.createNode(context),
			second = rnnoiseResources.createNode(context);
		finish(new ArrayBuffer(1));
		await Promise.all([first, second]);
		expect(mocks.load).toHaveBeenCalledOnce();
		expect(context.audioWorklet.addModule).toHaveBeenCalledOnce();
		expect(mocks.nodes).toHaveLength(2);
	});
	it("retries failed WASM and module loads without caching the rejection", async () => {
		vi.resetModules();
		mocks.load.mockRejectedValueOnce(new Error("wasm")).mockResolvedValue(new ArrayBuffer(1));
		const addModule = vi
			.fn()
			.mockRejectedValueOnce(new Error("module"))
			.mockResolvedValue(undefined);
		const context = { audioWorklet: { addModule } } as unknown as AudioContext;
		const { rnnoiseResources } = await import("../src/livekit/audio/RnnoiseResources");
		await expect(rnnoiseResources.createNode(context)).rejects.toThrow("wasm");
		await expect(rnnoiseResources.createNode(context)).rejects.toThrow("module");
		await rnnoiseResources.createNode(context);
		expect(mocks.load).toHaveBeenCalledTimes(2);
		expect(addModule).toHaveBeenCalledTimes(2);
	});
	it("the unused AudioEngine initializes its supplied context once and guards pending teardown", async () => {
		vi.resetModules();
		let finish!: (buffer: ArrayBuffer) => void;
		mocks.load.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const node = () => ({
			connect: vi.fn(function (this: unknown) {
				return this;
			}),
			disconnect: vi.fn(),
			gain: { value: 0 },
			frequency: { value: 0 },
			Q: { value: 0 },
			threshold: { value: 0 },
			ratio: { value: 0 },
		});
		const stop = vi.fn();
		const context = {
			createGain: node,
			createBiquadFilter: node,
			createDynamicsCompressor: node,
			createChannelSplitter: node,
			createChannelMerger: node,
			createAnalyser: node,
			createMediaStreamDestination: () => ({ ...node(), stream: { getTracks: () => [{ stop }] } }),
			audioWorklet: { addModule: vi.fn() },
			close: vi.fn(async () => {}),
		};
		const extraContext = vi.fn();
		vi.stubGlobal("AudioContext", extraContext);
		const { AudioEngine } = await import("../src/audio/AudioEngine");
		const engine = new AudioEngine(context as unknown as AudioContext);
		const first = engine.init(),
			second = engine.init();
		await engine.destroy();
		finish(new ArrayBuffer(1));
		await Promise.all([first, second]);
		await engine.destroy();
		expect(extraContext).not.toHaveBeenCalled();
		expect(mocks.load).toHaveBeenCalledOnce();
		expect(context.audioWorklet.addModule).not.toHaveBeenCalled();
		expect(context.close).toHaveBeenCalledOnce();
		expect(stop).toHaveBeenCalledOnce();
	});
});
