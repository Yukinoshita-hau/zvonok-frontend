import { afterEach, describe, expect, it, vi } from "vitest";
import { startCameraCapture } from "../src/components/VoiceVideoSetting/CameraPreview/cameraCapture";
import { parseWaveform } from "../src/utils/parseWaveform";
import {
	isCallEvent,
	isMessage,
	isRoomResponse,
	parseObject,
} from "../src/store/middlewares/websocket/payloadValidation";
import { normalizeRoom } from "../src/utils/normalizeRoom";
const { createNode } = vi.hoisted(() => ({ createNode: vi.fn() }));
vi.mock("../src/livekit/audio/RnnoiseResources", () => ({ rnnoiseResources: { createNode } }));
import { ZvonokAudioGraph } from "../src/livekit/audio/GlobalAudioGraph";
import type { ZvonokAudioGraphConfig } from "../src/livekit/audio/ZvonokAudioGraphConfig";
const config: ZvonokAudioGraphConfig = {
	stereoOutput: true,
	inputVolume: 1,
	outputVolume: 1,
	rnnoise: { enabled: true },
	highPass: { enabled: true, frequency: 90 },
	presence: { enabled: true, frequency: 3000, gain: 3, q: 1 },
	compressor: { enabled: true, threshold: -24, ratio: 12, knee: 1, attack: 0, release: 0 },
	limiter: { enabled: true, threshold: -2, ratio: 20, knee: 1, attack: 0, release: 0 },
};
const param = () => ({
	value: 0,
	cancelScheduledValues: vi.fn(),
	setValueAtTime: vi.fn(),
	setTargetAtTime: vi.fn(),
});
const node = () => ({
	connect: vi.fn(function (this: unknown) {
		return this;
	}),
	disconnect: vi.fn(),
	destroy: vi.fn(),
	gain: param(),
	frequency: param(),
	Q: param(),
	threshold: param(),
	ratio: param(),
	knee: param(),
	attack: param(),
	release: param(),
});
function audioFixture() {
	const output = { stop: vi.fn() };
	const context = {
		state: "running",
		currentTime: 0,
		close: vi.fn(async () => {}),
		createGain: node,
		createBiquadFilter: node,
		createDynamicsCompressor: node,
		createChannelSplitter: node,
		createChannelMerger: node,
		createAnalyser: node,
		createMediaStreamSource: node,
		createMediaStreamDestination: () => ({
			...node(),
			stream: { getTracks: () => [output], getAudioTracks: () => [output] },
		}),
	};
	vi.stubGlobal(
		"AudioContext",
		class {
			constructor() {
				return context;
			}
		},
	);
	vi.stubGlobal(
		"MediaStream",
		class {
			constructor(public tracks: unknown[]) {}
		},
	);
	return { context, output };
}
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});
describe("Stage 7 media resource regressions", () => {
	it("late camera permission completion after cleanup stops tracks without attaching", async () => {
		let resolve!: (stream: MediaStream) => void;
		vi.stubGlobal("navigator", {
			mediaDevices: {
				getUserMedia: () =>
					new Promise<MediaStream>((r) => {
						resolve = r;
					}),
			},
		});
		const stop = vi.fn(),
			ready = vi.fn(),
			failed = vi.fn();
		const cancel = startCameraCapture({ video: true }, ready, failed);
		cancel();
		resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
		await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
		expect(ready).not.toHaveBeenCalled();
	});
	it("camera cleanup is idempotent and stops the acquired stream", async () => {
		const stop = vi.fn(),
			ready = vi.fn();
		vi.stubGlobal("navigator", {
			mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
		});
		const cancel = startCameraCapture({ video: true }, ready, vi.fn());
		await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
		cancel();
		cancel();
		expect(stop).toHaveBeenCalledOnce();
	});
	it("destroy during pending RNNoise creation destroys the eventual WASM processor", async () => {
		const { context, output } = audioFixture();
		const worklet = node();
		let resolve!: (value: typeof worklet) => void;
		createNode.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				}),
		);
		const graph = new ZvonokAudioGraph(config);
		const attach = graph.attachTrack({} as MediaStreamTrack);
		await graph.destroy();
		resolve(worklet);
		await attach;
		expect(worklet.destroy).toHaveBeenCalledOnce();
		expect(worklet.disconnect).toHaveBeenCalledOnce();
		expect(worklet.connect).not.toHaveBeenCalled();
		expect(context.close).toHaveBeenCalledOnce();
		expect(output.stop).toHaveBeenCalledOnce();
	});
	it("disabling RNNoise while initialization is pending cannot reconnect stale worklet", async () => {
		audioFixture();
		const worklet = node();
		let resolve!: (value: typeof worklet) => void;
		createNode.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				}),
		);
		const graph = new ZvonokAudioGraph(config);
		const attach = graph.attachTrack({} as MediaStreamTrack);
		await graph.updateConfig({ ...config, rnnoise: { enabled: false } });
		resolve(worklet);
		await attach;
		expect(worklet.destroy).toHaveBeenCalledOnce();
		expect(worklet.connect).not.toHaveBeenCalled();
		await graph.destroy();
	});
	it("toggling RNNoise off destroys the installed processor", async () => {
		audioFixture();
		const worklet = node();
		createNode.mockResolvedValue(worklet);
		const graph = new ZvonokAudioGraph(config);
		await graph.attachTrack({} as MediaStreamTrack);
		await graph.updateConfig({ ...config, rnnoise: { enabled: false } });
		await graph.destroy();
		expect(worklet.destroy).toHaveBeenCalledOnce();
	});
});
describe("Stage 7 contracts", () => {
	it("decodes serialized waveform and rejects invalid/nonfinite samples", () => {
		expect(parseWaveform("[0,0.5,-1]")).toEqual([0, 0.5, -1]);
		for (const value of [null, "bad", "{}", '[1,"x"]', "[1e999]", "[]"])
			expect(parseWaveform(value)).toBeNull();
	});
	it("rejects malformed JSON and unknown/invalid call events", () => {
		for (const value of ["bad", "null", "[]"]) expect(parseObject(value)).toBeNull();
		expect(isCallEvent({ type: "NEW_EVENT", callId: 1 })).toBe(false);
		expect(isCallEvent({ type: "CALL_STARTED", callId: "1" })).toBe(false);
		expect(isCallEvent({ type: "CALL_STARTED", callId: 1, participantStatus: "INVALID" })).toBe(
			false,
		);
		expect(isCallEvent({ type: "CALL_STARTED", callId: 1 })).toBe(true);
	});
	it("preserves nullable private-room name/avatar in normalized Redux state", () => {
		const dto = {
			id: 1,
			type: "PRIVATE",
			name: null,
			avatarUrl: null,
			isActive: true,
			createdAt: "2026-10-18",
			lastMessageId: null,
			lastMessageContent: null,
			lastActivityAt: null,
			firstUnreadMessageId: null,
			unreadCount: 0,
			members: [],
		};
		expect(isRoomResponse(dto)).toBe(true);
		if (!isRoomResponse(dto)) throw new Error("invalid fixture");
		expect(normalizeRoom(dto).room).toMatchObject({ name: null, avatarUrl: null, memberIds: [] });
		expect(isMessage({ id: 1, sender: null, room: {} })).toBe(false);
	});
});
