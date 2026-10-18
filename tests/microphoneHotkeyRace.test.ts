import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionState } from "livekit-client";
const h = vi.hoisted(() => ({ callbacks: [] as (() => void)[], setEnabled: vi.fn(async () => undefined), room: { state: "connecting", localParticipant: { isMicrophoneEnabled: false, setMicrophoneEnabled: vi.fn(async () => undefined) } } }));
vi.mock("react", () => ({ useCallback: (fn: () => void) => { h.callbacks.push(fn); return fn; }, useMemo: (fn: () => unknown) => fn(), useRef: (value: unknown) => ({ current: value }), useEffect: () => undefined }));
vi.mock("@livekit/components-react", () => ({ useRoomContext: () => h.room }));
vi.mock("react-redux", () => ({ useSelector: () => ({ connectionTestResult: { recommendation: "high" } }) }));
vi.mock("../src/components/CallUi/useMicrophoneCaptureOptions", () => ({ useMicrophoneCaptureOptions: () => ({}) }));
vi.mock("../src/utils/callQuality", () => ({ resolveQualitySetting: () => "high", getQualityPreset: () => ({}) }));
vi.mock("../src/components/CallUi/CallMicrophoneProvider", () => ({ useCallMicrophoneOwner: () => ({ setEnabled: h.setEnabled }) }));
vi.mock("../src/utils/microphoneQuality", () => ({ getMicrophonePublishOptions: () => ({}) }));
import { CallHotkeys } from "../src/components/ActiveCallOverlay/CallHotkeys";
beforeEach(() => { h.callbacks = []; h.room.localParticipant.isMicrophoneEnabled = false; h.room.localParticipant.setMicrophoneEnabled.mockClear(); h.setEnabled.mockClear(); });
describe("microphone hotkey uses the same connection guard as the UI", () => {
  it("cannot bypass initial signal setup", () => {
    h.room.state = ConnectionState.Connecting; CallHotkeys(); h.callbacks[0]();
    expect(h.setEnabled).not.toHaveBeenCalled();
  });
  it("enables a connected microphone", () => {
    h.room.state = ConnectionState.Connected; CallHotkeys(); h.callbacks[0]();
    expect(h.setEnabled).toHaveBeenCalledWith(true, {}, {});
  });
  it("can still mute during reconnect", () => {
    h.room.state = ConnectionState.Reconnecting; h.room.localParticipant.isMicrophoneEnabled = true; CallHotkeys(); h.callbacks[0]();
    expect(h.setEnabled).toHaveBeenCalledWith(false, {}, {});
  });
});
