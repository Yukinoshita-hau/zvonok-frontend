import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { ConnectionState } from "livekit-client";
const h = vi.hoisted(() => ({ connection: "connecting", enabled: false, pending: false, setEnabled: vi.fn(async () => undefined) }));
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useState: () => [h.pending, vi.fn()] }));
vi.mock("@livekit/components-react", () => ({
  useConnectionState: () => h.connection,
  useTrackToggle: () => ({ enabled: h.enabled, buttonProps: { disabled: h.pending, onClick: vi.fn() } }),
}));
vi.mock("../src/components/CallUi/CallMicrophoneProvider", () => ({ useCallMicrophoneOwner: () => ({ setEnabled: h.setEnabled }) }));
vi.mock("react-redux", () => ({ useSelector: () => "high" }));
vi.mock("../src/components/CallUi/useMicrophoneCaptureOptions", () => ({ useMicrophoneCaptureOptions: () => ({}) }));
vi.mock("../src/utils/microphoneQuality", () => ({ getMicrophonePublishOptions: () => ({}) }));
import { MicrophoneToggleButton } from "../src/components/CallUi/MicrophoneToggleButton";
const button = () => MicrophoneToggleButton({ className: "test" });
beforeEach(() => { vi.stubGlobal("React", React); h.setEnabled.mockClear(); });
afterEach(() => vi.unstubAllGlobals());
describe("microphone intent versus LiveKit initial audio=false", () => {
  it.each([ConnectionState.Connecting, ConnectionState.Disconnected, ConnectionState.Reconnecting])("blocks unmute before media is ready (%s)", connection => {
    Object.assign(h, { connection, enabled: false, pending: false });
    expect(button().props.disabled).toBe(true);
  });
  it("allows unmute after connected, after the SDK initial microphone state is applied", () => {
    Object.assign(h, { connection: ConnectionState.Connected, enabled: false, pending: false });
    expect(button().props.disabled).toBe(false);
  });
  it("still allows muting an existing microphone during reconnect", () => {
    Object.assign(h, { connection: ConnectionState.Reconnecting, enabled: true, pending: false });
    expect(button().props.disabled).toBe(false);
  });
  it("preserves the SDK pending-operation disable guard", () => {
    Object.assign(h, { connection: ConnectionState.Connected, enabled: false, pending: true });
    expect(button().props.disabled).toBe(true);
  });
});
