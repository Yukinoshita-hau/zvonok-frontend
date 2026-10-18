import { beforeEach, describe, expect, it, vi } from "vitest";
import { MicrophoneCaptureOwner, type MicrophoneOwnerAdapter } from "../src/components/CallUi/MicrophoneCaptureOwner";

type FakeTrack = { id: string; kind: "audio" | "video"; readyState: "live" | "ended"; stop: ReturnType<typeof vi.fn> };
type FakePublication = { track?: FakeTrack; mute: ReturnType<typeof vi.fn>; unmute: ReturnType<typeof vi.fn> };
type Adapter = MicrophoneOwnerAdapter<FakeTrack, { capture: string }, { quality: string }>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function track(id: string): FakeTrack {
	const result = { id, kind: "audio" as const, readyState: "live" as const, stop: vi.fn() };
	result.stop.mockImplementation(() => { result.readyState = "ended"; });
	return result;
}

function fixture() {
	let connected = true;
	let current = true;
	let publication: FakePublication | undefined;
	const adapter: Adapter = {
		isConnected: () => connected,
		isCallCurrent: () => current,
		getPublication: () => publication,
		createTracks: vi.fn(async () => []),
		isAudioTrack: (value) => value.kind === "audio",
		stop: (value) => value.stop(),
		publish: vi.fn(async (value) => {
			publication = { track: value, mute: vi.fn(async () => undefined), unmute: vi.fn(async () => undefined) };
			return publication as unknown as FakePublication;
		}),
		unpublish: vi.fn(async (value) => { if (publication?.track === value) publication = undefined; }),
	};
	return {
		adapter,
		owner: new MicrophoneCaptureOwner(41, 7, adapter),
		setConnected(value: boolean) { connected = value; },
		setCallCurrent(value: boolean) { current = value; },
		getPublication() { return publication; },
	};
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe("call-scoped microphone capture ownership", () => {
	it("stops a stream that resolves after terminal hangup without publishing it", async () => {
		const f = fixture(), capture = deferred<FakeTrack[]>(), lateTrack = track("late-capture");
		f.adapter.createTracks = vi.fn(() => capture.promise);
		const operation = f.owner.setEnabled(true, { capture: "default" }, { quality: "high" });
		f.owner.dispose();
		capture.resolve([lateTrack]);
		await operation;
		expect(lateTrack.readyState).toBe("ended");
		expect(lateTrack.stop).toHaveBeenCalledOnce();
		expect(f.adapter.publish).not.toHaveBeenCalled();
	});

	it("does not let a late old-call capture touch the next call's track", async () => {
		const old = fixture(), next = fixture(), capture = deferred<FakeTrack[]>();
		const oldTrack = track("old-call"), nextTrack = track("new-call");
		old.adapter.createTracks = vi.fn(() => capture.promise);
		next.adapter.createTracks = vi.fn(async () => [nextTrack]);
		const oldOperation = old.owner.setEnabled(true, { capture: "a" }, { quality: "high" });
		old.owner.dispose();
		await next.owner.setEnabled(true, { capture: "b" }, { quality: "high" });
		capture.resolve([oldTrack]);
		await oldOperation;
		expect(oldTrack.readyState).toBe("ended");
		expect(nextTrack.readyState).toBe("live");
		expect(old.adapter.publish).not.toHaveBeenCalled();
		expect(next.adapter.publish).toHaveBeenCalledOnce();
	});

	it("checks call identity and media generation again when capture resolves", async () => {
		const f = fixture(), capture = deferred<FakeTrack[]>(), audio = track("stale-generation");
		f.adapter.createTracks = vi.fn(() => capture.promise);
		const operation = f.owner.setEnabled(true, { capture: "default" }, { quality: "high" });
		f.setCallCurrent(false);
		capture.resolve([audio]);
		await operation;
		expect(audio.readyState).toBe("ended");
		expect(f.adapter.publish).not.toHaveBeenCalled();
	});

	it("stops immediately when publish acknowledgement is pending, then safely removes the late publication", async () => {
		const f = fixture(), publishAck = deferred<FakePublication>(), audio = track("pending-publish");
		f.adapter.createTracks = vi.fn(async () => [audio]);
		f.adapter.publish = vi.fn(async () => publishAck.promise);
		const operation = f.owner.setEnabled(true, { capture: "default" }, { quality: "high" });
		await flush();
		expect(f.adapter.publish).toHaveBeenCalledOnce();
		f.owner.dispose();
		expect(audio.readyState).toBe("ended");
		expect(audio.stop).toHaveBeenCalledOnce();
		publishAck.resolve({ track: audio, mute: vi.fn(), unmute: vi.fn() });
		await operation;
		expect(f.adapter.unpublish).toHaveBeenCalledOnce();
		expect(audio.stop).toHaveBeenCalledOnce();
	});

	it("makes repeated teardown idempotent", async () => {
		const f = fixture(), audio = track("active");
		f.adapter.createTracks = vi.fn(async () => [audio]);
		await f.owner.setEnabled(true, { capture: "default" }, { quality: "high" });
		f.owner.dispose();
		f.owner.dispose();
		expect(audio.stop).toHaveBeenCalledOnce();
		expect(f.adapter.unpublish).toHaveBeenCalledOnce();
	});

	it("cleans up capture canceled by mute before getUserMedia returns", async () => {
		const f = fixture(), capture = deferred<FakeTrack[]>(), audio = track("muted-before-capture");
		f.adapter.createTracks = vi.fn(() => capture.promise);
		const operation = f.owner.setEnabled(true, { capture: "default" }, { quality: "high" });
		await f.owner.setEnabled(false, { capture: "default" }, { quality: "high" });
		capture.resolve([audio]);
		await operation;
		expect(audio.readyState).toBe("ended");
		expect(f.adapter.publish).not.toHaveBeenCalled();
	});

	it("restarts a pending capture with the newly selected microphone", async () => {
		const f = fixture(), firstCapture = deferred<FakeTrack[]>(), stale = track("old-device"), current = track("new-device");
		f.adapter.createTracks = vi.fn().mockImplementationOnce(() => firstCapture.promise).mockResolvedValueOnce([current]);
		const operation = f.owner.setEnabled(true, { capture: "device-a" }, { quality: "high" });
		f.owner.updateOptions({ capture: "device-b" }, { quality: "high" });
		firstCapture.resolve([stale]);
		await operation;
		await flush();
		expect(stale.readyState).toBe("ended");
		expect(current.readyState).toBe("live");
		expect(f.adapter.createTracks).toHaveBeenNthCalledWith(1, { capture: "device-a" });
		expect(f.adapter.createTracks).toHaveBeenNthCalledWith(2, { capture: "device-b" });
		expect(f.adapter.publish).toHaveBeenCalledTimes(1);
	});

	it("keeps a healthy track during reconnect mute and does not perform terminal cleanup", async () => {
		const f = fixture(), audio = track("reconnecting");
		f.adapter.createTracks = vi.fn(async () => [audio]);
		await f.owner.setEnabled(true, { capture: "default" }, { quality: "high" });
		f.setConnected(false);
		await f.owner.setEnabled(false, { capture: "default" }, { quality: "high" });
		expect(audio.readyState).toBe("live");
		expect(f.getPublication()?.mute).toHaveBeenCalledOnce();
		expect(f.adapter.unpublish).not.toHaveBeenCalled();
	});
});
