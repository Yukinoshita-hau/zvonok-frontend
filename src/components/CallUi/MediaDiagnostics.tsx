import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import { useEffect } from "react";

type Snapshot = Record<string, unknown>;
interface DiagnosticSink {
  events: Snapshot[];
  log: (event: string, detail?: Snapshot) => void;
  snapshot?: () => Snapshot;
  collect?: (label: string) => Promise<unknown>;
  session?: { callId: number | null; generation: number };
}
declare global { interface Window { __mediaDiag?: DiagnosticSink } }

export function mediaDiagnostic(event: string, detail: Snapshot = {}) {
  if (!import.meta.env.DEV || import.meta.env.VITE_MEDIA_DIAGNOSTICS !== "true") return;
  window.__mediaDiag?.log(event, { ...window.__mediaDiag.snapshot?.(), ...detail });
}

/** Acceptance-only observer. Never enabled in a production build or by default. */
export function MediaDiagnostics({ callId, generation }: { callId: number | null; generation: number }) {
  const room = useRoomContext();
  useEffect(() => {
    if (!import.meta.env.DEV || import.meta.env.VITE_MEDIA_DIAGNOSTICS !== "true") return;
    const sink = window.__mediaDiag;
    if (!sink) return;
    const aliases = new Map<string, string>();
    const alias = (identity: string) => {
      if (!aliases.has(identity)) aliases.set(identity, `p${aliases.size + 1}`);
      return aliases.get(identity);
    };
    const participant = (p: Participant) => ({
      identity: alias(p.identity), local: p.isLocal, microphoneEnabled: p.isMicrophoneEnabled,
      publications: [...p.trackPublications.values()].map(publication => ({
        sid: publication.trackSid, source: publication.source, muted: publication.isMuted,
        streamState: publication.track?.streamState,
        elements: publication.track?.attachedElements.map(element => ({ readyState: element.readyState, currentTime: element.currentTime, visible: element.getClientRects().length > 0, width: element instanceof HTMLVideoElement ? element.videoWidth : undefined, height: element instanceof HTMLVideoElement ? element.videoHeight : undefined })),
        subscribed: "isSubscribed" in publication ? publication.isSubscribed : undefined,
        track: publication.track ? {
          kind: publication.track.kind, muted: publication.track.isMuted,
          media: { id: publication.track.mediaStreamTrack.id,
            enabled: publication.track.mediaStreamTrack.enabled,
            muted: publication.track.mediaStreamTrack.muted,
            readyState: publication.track.mediaStreamTrack.readyState },
        } : null,
      })),
    });
    const snapshot = () => ({ timestamp: Date.now(), callId, generation, connection: room.state,
      participants: [participant(room.localParticipant), ...[...room.remoteParticipants.values()].map(participant)] });
    const session = { callId, generation };
    sink.session = session;
    const log = (event: string, detail?: Snapshot) => sink.log(event, { ...snapshot(), ...detail });
    sink.snapshot = snapshot;
    log("react.mount");
    const events = [RoomEvent.Connected, RoomEvent.Disconnected, RoomEvent.Reconnecting,
      RoomEvent.Reconnected, RoomEvent.SignalReconnecting, RoomEvent.ConnectionStateChanged,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackStreamStateChanged, RoomEvent.TrackSubscriptionFailed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ConnectionQualityChanged,
      RoomEvent.AudioPlaybackStatusChanged];
    const handlers = events.map(event => { const handler = () => {
      log(`livekit.${event}`);
      if ([RoomEvent.Connected, RoomEvent.LocalTrackPublished, RoomEvent.TrackSubscribed, RoomEvent.Disconnected].includes(event)) void sink.collect?.(`event:${event}`);
    }; room.on(event, handler); return { event, handler }; });
    const local = room.localParticipant;
    const createTracks = local.createTracks;
    const publishTrack = local.publishTrack;
    const setMicrophoneEnabled = local.setMicrophoneEnabled;
    const wrappedCreate: typeof createTracks = async (...args) => {
      log("createTracks.request");
      try { const tracks = await createTracks.apply(local, args); log("createTracks.resolved", { tracks: tracks.map(t => ({kind:t.kind, enabled:t.mediaStreamTrack.enabled,readyState:t.mediaStreamTrack.readyState})) }); return tracks; }
      catch (error) { log("createTracks.rejected", { error: error instanceof Error ? error.name : "unknown" }); throw error; }
    };
    const wrappedPublish: typeof publishTrack = async (...args) => {
      log("publishTrack.request");
      try { const publication = await publishTrack.apply(local, args); log("publishTrack.resolved", { sid: publication.trackSid }); return publication; }
      catch (error) { log("publishTrack.rejected", { error: error instanceof Error ? error.name : "unknown" }); throw error; }
    };
    const wrappedMicrophone: typeof setMicrophoneEnabled = async (...args) => {
      log("microphone.request", { enabled: args[0] });
      void sink.collect?.("microphone-request");
      try { const publication = await setMicrophoneEnabled.apply(local, args); log("microphone.resolved"); return publication; }
      catch (error) { log("microphone.rejected", { error: error instanceof Error ? error.name : "unknown" }); throw error; }
    };
    local.createTracks = wrappedCreate;
    local.publishTrack = wrappedPublish;
    local.setMicrophoneEnabled = wrappedMicrophone;
    return () => {
      log("react.unmount");
      handlers.forEach(({event,handler}) => room.off(event, handler));
      if (local.createTracks === wrappedCreate) local.createTracks = createTracks;
      if (local.publishTrack === wrappedPublish) local.publishTrack = publishTrack;
      if (local.setMicrophoneEnabled === wrappedMicrophone) local.setMicrophoneEnabled = setMicrophoneEnabled;
      if (sink.snapshot === snapshot) sink.snapshot = undefined;
    };
  }, [room, callId, generation]);
  return null;
}
