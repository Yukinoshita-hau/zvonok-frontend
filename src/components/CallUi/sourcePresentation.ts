import type { TrackReference } from "@livekit/components-react";
import type { ParticipantCard } from "./hooks/useCallParticipants";

export interface ParticipantPresentation {
  participantIdentity: string;
  displayName: string;
  cameraAvailable: boolean;
  microphoneEnabled: boolean;
  speaking: boolean;
  card: ParticipantCard;
}

export interface MediaSourcePresentation {
  key: string;
  logicalKey: string;
  ownerIdentity: string;
  displayName: string;
  type: "camera" | "screen";
  publicationSid: string;
  trackRef: TrackReference;
  muted: boolean;
  subscribed: boolean;
  streamState: string | undefined;
  availability: "available" | "paused" | "reconnecting" | "loading";
  aspectRatio: number;
  width?: number;
  height?: number;
  card: ParticipantCard;
}

export function createPresentation(cards: ParticipantCard[], tracks: TrackReference[], reconnecting: boolean) {
  const people: ParticipantPresentation[] = cards.filter(c => !c.isScreenShareCard).map(card => ({
    participantIdentity: card.participant.identity, displayName: card.displayName,
    cameraAvailable: Boolean(card.videoTrack), microphoneEnabled: card.participant.isMicrophoneEnabled,
    speaking: card.participant.isSpeaking, card,
  }));
  const sources = new Map<string, MediaSourcePresentation>();
  for (const trackRef of tracks) {
    const { participant, publication } = trackRef;
    const person = people.find(p => p.participantIdentity === participant.identity);
    if (!person) continue;
    const type = trackRef.source === "screen_share" ? "screen" : "camera";
    const logicalKey = JSON.stringify([participant.identity, type]);
    // Camera intent follows the person; a new screen publication is a new sharing session.
    const key = type === "camera" ? logicalKey : `screen:${publication.trackSid}`;
    const dimensions = publication.dimensions;
    const ratio = dimensions && dimensions.width / dimensions.height;
    const muted = publication.isMuted;
    const subscribed = participant.isLocal || publication.isSubscribed;
    sources.set(key, {
      key, logicalKey, ownerIdentity: participant.identity, type,
      displayName: `${person.displayName} · ${type === "screen" ? "Экран" : "Камера"}`,
      publicationSid: publication.trackSid, trackRef, muted, subscribed,
      streamState: publication.track?.streamState,
      availability: reconnecting ? "reconnecting" : muted ? "paused"
        : !subscribed || !publication.track ? "loading"
          : publication.track.streamState === "paused" ? "loading" : "available",
      aspectRatio: ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9,
      width: dimensions?.width, height: dimensions?.height,
      card: { ...person.card, id: type === "screen" ? key : person.card.id,
        videoTrack: trackRef, isScreenShareCard: type === "screen" },
    });
  }
  return { people, sources: [...sources.values()] };
}

/** Never infer replacement from owner alone. Same SID / camera intent can recover in place. */
export function resolveContentSources(sources: MediaSourcePresentation[], primaryKey: string | null, secondaryKey: string | null) {
  const primary = sources.find(s => s.key === primaryKey)
    ?? sources.find(s => s.key === secondaryKey)
    ?? sources.find(s => s.type === "screen") ?? sources[0] ?? null;
  const secondary = sources.find(s => s.key === secondaryKey && s.key !== primary?.key) ?? null;
  return { primary, secondary };
}
