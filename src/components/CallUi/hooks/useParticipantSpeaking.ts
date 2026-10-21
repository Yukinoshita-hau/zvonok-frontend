import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import { useCallback, useSyncExternalStore } from "react";
import { participantSpeaking } from "./useFollowSpeaker";

/** Only this tile updates when its boolean speech indication changes. */
export function useParticipantSpeaking(participant: Participant, threshold: number) {
  const room = useRoomContext();
  const subscribe = useCallback((notify: () => void) => {
    const events = [RoomEvent.ActiveSpeakersChanged, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.TrackPublished, RoomEvent.TrackUnpublished];
    events.forEach(event => room.on(event, notify));
    return () => { events.forEach(event => room.off(event, notify)); };
  }, [room]);
  return useSyncExternalStore(subscribe, () => participantSpeaking(participant, threshold));
}
