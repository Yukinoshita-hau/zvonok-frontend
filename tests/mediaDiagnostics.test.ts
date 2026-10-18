import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomEvent } from "livekit-client";
const h = vi.hoisted(() => ({ room: null as unknown, cleanup: undefined as undefined | (() => void) }));
vi.mock("react", () => ({ useEffect: (effect: () => void | (() => void)) => { h.cleanup = effect() || undefined; } }));
vi.mock("@livekit/components-react", () => ({ useRoomContext: () => h.room }));
import { MediaDiagnostics } from "../src/components/CallUi/MediaDiagnostics";
const makeRoom = () => {
  const local = {
    identity: "private-account-name", isLocal: true, isMicrophoneEnabled: false,
    trackPublications: new Map(),
    createTracks: vi.fn(async () => []),
    publishTrack: vi.fn(async () => ({ trackSid: "test-track" })),
    setMicrophoneEnabled: vi.fn(async (_enabled: boolean, _options?: unknown) => undefined),
  };
  const handlers = new Map<string, () => void>();
  return { localParticipant: local, remoteParticipants: new Map(), state: "connected",
    on: vi.fn((event: string, handler: () => void) => handlers.set(event, handler)),
    off: vi.fn((event: string) => handlers.delete(event)), handlers };
};
beforeEach(() => { vi.stubEnv("DEV", true); vi.stubEnv("VITE_MEDIA_DIAGNOSTICS", "true"); });
afterEach(() => { h.cleanup?.(); h.cleanup = undefined; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("acceptance media observer", () => {
  it.each([false, true])("does not mutate SDK methods outside explicit dev diagnostics (production=%s)", production => {
    vi.stubEnv("DEV", !production); vi.stubEnv("VITE_MEDIA_DIAGNOSTICS", production ? "true" : "false");
    const room = makeRoom(), original = room.localParticipant.setMicrophoneEnabled; h.room = room;
    vi.stubGlobal("window", {});
    MediaDiagnostics({ callId: 12, generation: 3 });
    expect(room.localParticipant.setMicrophoneEnabled).toBe(original); expect(room.on).not.toHaveBeenCalled();
  });
  it("records anonymous lifecycle, preserves calls and detaches all observers", async () => {
    const room = makeRoom(), local = room.localParticipant, original = local.setMicrophoneEnabled;
    const rows: unknown[] = [], collect = vi.fn(async () => undefined);
    vi.stubGlobal("window", { __mediaDiag: { events: rows, collect, log: (event: string, detail: unknown) => rows.push({event,detail}) } });
    h.room = room; MediaDiagnostics({ callId: 12, generation: 3 });
    await local.setMicrophoneEnabled(true, { deviceId: "private-hardware-id" });
    room.handlers.get(RoomEvent.Connected)?.();
    expect(original).toHaveBeenCalledWith(true, { deviceId: "private-hardware-id" });
    expect(collect).toHaveBeenCalledWith("microphone-request");
    const json = JSON.stringify(rows); expect(json).toContain("microphone.resolved"); expect(json).toContain('"identity":"p1"');
    expect(json).not.toContain("private-account-name"); expect(json).not.toContain("private-hardware-id");
    h.cleanup?.(); h.cleanup = undefined;
    expect(local.setMicrophoneEnabled).toBe(original); expect(room.handlers.size).toBe(0);
  });
  it("propagates the original rejection without logging sensitive error messages", async () => {
    const room = makeRoom(), failure = new Error("cookie=private-secret"); room.localParticipant.setMicrophoneEnabled.mockRejectedValue(failure);
    const rows: unknown[] = []; vi.stubGlobal("window", { __mediaDiag: { events: rows, log: (event: string, detail: unknown) => rows.push({event,detail}) } });
    h.room = room; MediaDiagnostics({ callId: 12, generation: 3 });
    await expect(room.localParticipant.setMicrophoneEnabled(true)).rejects.toBe(failure);
    expect(JSON.stringify(rows)).not.toContain("private-secret"); expect(JSON.stringify(rows)).toContain("microphone.rejected");
  });
});
