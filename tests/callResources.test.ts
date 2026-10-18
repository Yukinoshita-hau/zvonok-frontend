import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleCallRecovery } from "../src/components/ActiveCallOverlay/callRecovery";
const { graphs, attach } = vi.hoisted(() => ({ graphs: [] as any[], attach: vi.fn() }));
vi.mock("../src/livekit/audio/GlobalAudioGraph", () => ({ ZvonokAudioGraph: class {
	destroy = vi.fn(async () => {});
	attachTrack = attach;
	getProcessedTrack = () => "processed";
	constructor() { graphs.push(this); }
} }));
import { ZvonokLiveKitAudioProcessor } from "../src/livekit/audio/ZvonokLiveKitAudioProcessor";

afterEach(() => { vi.useRealTimers(); graphs.length = 0; attach.mockReset(); });
describe("call recovery timer ownership", () => {
	it("cancellation removes the timer and suppresses a pending attempt's retry", async () => {
		vi.useFakeTimers();
		let finish!: () => void;
		const attempt = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
		const expired = vi.fn();
		const cancel = scheduleCallRecovery(attempt, expired, Date.now());
		await vi.advanceTimersByTimeAsync(1000); cancel(); finish();
		await vi.advanceTimersByTimeAsync(100000);
		expect(attempt).toHaveBeenCalledOnce(); expect(expired).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
	it("retries are bounded and expire once", async () => {
		vi.useFakeTimers();
		const attempt = vi.fn(async () => {}), expired = vi.fn();
		scheduleCallRecovery(attempt, expired, Date.now(), 9000, 2000);
		await vi.advanceTimersByTimeAsync(10000);
		expect(attempt).toHaveBeenCalledTimes(4); expect(expired).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});
});
describe("microphone processor resource ownership", () => {
	it("failed initialization destroys the graph and its AudioContext", async () => {
		attach.mockRejectedValue(new Error("worklet failed"));
		const processor = new ZvonokLiveKitAudioProcessor({} as any);
		await expect(processor.init({ track: {} } as any)).rejects.toThrow("worklet failed");
		expect(graphs[0].destroy).toHaveBeenCalledOnce(); expect(processor.processedTrack).toBeUndefined();
	});
	it("destroy during pending initialization closes the eventual graph", async () => {
		let finish!: () => void;
		attach.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
		const processor = new ZvonokLiveKitAudioProcessor({} as any);
		const init = processor.init({ track: {} } as any);
		await Promise.resolve(); await processor.destroy(); finish(); await init;
		expect(graphs[0].destroy).toHaveBeenCalledOnce(); expect(processor.processedTrack).toBeUndefined();
	});
});
