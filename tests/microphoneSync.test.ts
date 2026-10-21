import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Deterministic effect harness: retains refs/dependencies and runs React-style cleanup
// before the next effect. SDK operations are deferred to exercise real hook queues.
const h = vi.hoisted(() => ({
	refs: [] as { current: unknown }[],
	effects: [] as { deps: unknown[]; cleanup?: () => void }[],
	index: 0,
	jobs: [] as (() => void)[],
	room: null as any,
	state: null as any,
	capture: {} as any,
	processors: [] as any[],
}));
vi.mock("react", () => ({
	useRef: (initial: unknown) => {
		const index = h.index++;
		return (h.refs[index] ??= { current: initial });
	},
	useMemo: (fn: () => unknown) => fn(),
	useEffect: (fn: () => (() => void) | void, deps: unknown[]) => {
		const index = h.index++,
			previous = h.effects[index];
		if (
			previous &&
			deps.length === previous.deps.length &&
			deps.every((item, i) => Object.is(item, previous.deps[i]))
		)
			return;
		h.jobs.push(() => {
			previous?.cleanup?.();
			h.effects[index] = { deps, cleanup: fn() || undefined };
		});
	},
}));
vi.mock("@livekit/components-react", () => ({ useRoomContext: () => h.room }));
vi.mock("react-redux", () => ({
	useDispatch: () => vi.fn(),
	useSelector: (selector: (state: unknown) => unknown) => selector(h.state),
}));
vi.mock('../src/store/slices/device.slice', () => ({deviceActions: {setMediaError: vi.fn()}}));
vi.mock("../src/components/CallUi/useMicrophoneCaptureOptions", () => ({
	useMicrophoneCaptureOptions: () => h.capture,
}));
vi.mock("../src/utils/microphoneQuality", () => ({
	getMicrophonePublishOptions: (quality: string) => ({ quality }),
}));
vi.mock("../src/components/CallUi/CallMicrophoneProvider", () => ({
	useCallMicrophoneOwner: () => ({ updateOptions: vi.fn() }),
}));
vi.mock("livekit-client", () => ({
	Track: { Source: { Microphone: "microphone" } },
	LocalAudioTrack: class {
		stop = vi.fn();
		stopProcessor = vi.fn(async () => {});
		setProcessor = vi.fn(async () => {});
	},
}));
vi.mock("../src/livekit/audio/ZvonokLiveKitAudioProcessor", () => ({
	ZvonokLiveKitAudioProcessor: class {
		destroy = vi.fn(async () => {});
		updateConfig = vi.fn(async () => {});
		constructor() {
			h.processors.push(this);
		}
	},
}));
import { LocalAudioTrack } from "livekit-client";
import { MicrophoneSettingsSync } from "../src/components/CallUi/MicrophoneSettingsSync";
import { MicrophoneProcessorSync } from "../src/components/CallUi/MicrophoneProcessorSync";
function render(component: () => unknown) {
	h.index = 0;
	component();
	const jobs = h.jobs.splice(0);
	jobs.forEach((job) => job());
}
function unmount() {
	h.effects.forEach((effect) => effect?.cleanup?.());
	h.effects = [];
}
const flush = async () => {
	for (let i = 0; i < 12; i++) await Promise.resolve();
};
const makeTrack = () => new (LocalAudioTrack as any)();
beforeEach(() => {
	h.refs = [];
	h.effects = [];
	h.jobs = [];
	h.processors = [];
	h.state = { device: { micQualitySetting: "high", voiceProcessingConfig: { inputVolume: 1 } } };
	h.capture = { deviceId: "first" };
	h.room = {
		localParticipant: {
			isMicrophoneEnabled: true,
			getTrackPublication: vi.fn(),
			createTracks: vi.fn(),
			publishTrack: vi.fn(async () => {}),
			unpublishTrack: vi.fn(async () => {}),
			on: vi.fn(),
			off: vi.fn(),
		},
	};
});
afterEach(() => {
	unmount();
	vi.restoreAllMocks();
});
describe("microphone async lifecycle regressions", () => {
	it('retains an SDK-confirmed device switch without republishing or stopping its processor', async () => {
		const track = makeTrack();
		track.mediaStreamTrack = {getSettings: () => ({deviceId: 'second'})};
		h.room.localParticipant.createTracks.mockResolvedValue([track]);
		render(MicrophoneSettingsSync); await flush();
		h.room.localParticipant.getTrackPublication.mockReturnValue({track});
		h.capture = {deviceId: 'second'};
		render(MicrophoneSettingsSync); await flush();
		expect(h.room.localParticipant.createTracks).toHaveBeenCalledOnce();
		expect(h.room.localParticipant.unpublishTrack).not.toHaveBeenCalled();
		expect(track.stopProcessor).not.toHaveBeenCalled();
	});
	it("uses the newest capture options queued during pending capture", async () => {
		let finish!: (tracks: unknown[]) => void;
		const first = makeTrack(),
			second = makeTrack();
		h.room.localParticipant.createTracks
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			)
			.mockResolvedValueOnce([second]);
		render(MicrophoneSettingsSync);
		h.capture = { deviceId: "second" };
		render(MicrophoneSettingsSync);
		finish([first]);
		await flush();
		expect(
			h.room.localParticipant.createTracks.mock.calls.map((call: any[]) => call[0].audio.deviceId),
		).toEqual(["first", "second"]);
		expect(h.room.localParticipant.publishTrack).toHaveBeenCalledTimes(2);
	});
	it("stops tracks acquired after unmount without publishing", async () => {
		let finish!: (tracks: unknown[]) => void;
		const track = makeTrack();
		h.room.localParticipant.createTracks.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		render(MicrophoneSettingsSync);
		unmount();
		finish([track]);
		await flush();
		expect(track.stop).toHaveBeenCalledOnce();
		expect(h.room.localParticipant.publishTrack).not.toHaveBeenCalled();
	});
	it("stops newly captured tracks if publication fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const track = makeTrack();
		h.room.localParticipant.createTracks.mockResolvedValue([track]);
		h.room.localParticipant.publishTrack.mockRejectedValue(new Error("offline"));
		render(MicrophoneSettingsSync);
		await flush();
		expect(track.stop).toHaveBeenCalledOnce();
	});
	it("stops a settings-replacement track immediately when unmounted during publish", async () => {
		let finish!: () => void;
		const track = makeTrack();
		h.room.localParticipant.createTracks.mockResolvedValue([track]);
		h.room.localParticipant.publishTrack.mockImplementation(
			() => new Promise<void>((resolve) => { finish = resolve; }),
		);
		render(MicrophoneSettingsSync);
		await flush();
		expect(h.room.localParticipant.publishTrack).toHaveBeenCalledOnce();
		unmount();
		expect(track.stop).toHaveBeenCalledOnce();
		finish();
		await flush();
		expect(track.stop).toHaveBeenCalledOnce();
	});
	it("applies config queued during setProcessor and detaches all listeners", async () => {
		let finish!: () => void;
		const track = makeTrack();
		track.setProcessor.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		h.room.localParticipant.getTrackPublication.mockReturnValue({ track });
		render(MicrophoneProcessorSync);
		h.state.device.voiceProcessingConfig = { inputVolume: 0.4 };
		render(MicrophoneProcessorSync);
		finish();
		await flush();
		expect(h.processors[0].updateConfig).toHaveBeenLastCalledWith({
			inputVolume: 0.4,
			stereoOutput: false,
		});
		unmount();
		expect(track.stopProcessor).toHaveBeenCalledOnce();
		expect(h.room.localParticipant.off).toHaveBeenCalledTimes(2);
	});
	it("stops processor if setup completes after unmount", async () => {
		let finish!: () => void;
		const track = makeTrack();
		track.setProcessor.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		h.room.localParticipant.getTrackPublication.mockReturnValue({ track });
		render(MicrophoneProcessorSync);
		unmount();
		finish();
		await flush();
		expect(track.stopProcessor).toHaveBeenCalledOnce();
	});
	it("destroys a processor rejected by the SDK", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		const track = makeTrack();
		track.setProcessor.mockRejectedValue(new Error("worklet failed"));
		h.room.localParticipant.getTrackPublication.mockReturnValue({ track });
		render(MicrophoneProcessorSync);
		await flush();
		expect(h.processors[0].destroy).toHaveBeenCalledOnce();
	});
});
