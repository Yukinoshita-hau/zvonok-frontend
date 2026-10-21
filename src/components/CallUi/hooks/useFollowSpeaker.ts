import { useEffect, useRef, useState } from "react";
import { ConnectionState, RoomEvent, Track, type Participant, type Room } from "livekit-client";
import { initialSpeakerState, selectSpeaker, type SpeakerState } from "../speakerSelection";

/** Same SDK speech and existing local sensitivity used by tiles and Compact. */
export function participantSpeaking(p: Participant, localThreshold: number) {
  return p.isMicrophoneEnabled && (p.isLocal ? p.audioLevel >= localThreshold : p.isSpeaking);
}

const events = [RoomEvent.ActiveSpeakersChanged, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
  RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ConnectionStateChanged];

export function observeFollowSpeaker(room: Room, state: { current: SpeakerState },
  options: { follow: boolean; pin: string | null; focus: string | null; threshold: number },
  onSelected: (identity: string | null) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    clearTimeout(timer); timer = undefined;
    // Room recovery can temporarily empty membership; it is not a departure.
    if (room.state !== ConnectionState.Connected) {
      state.current = { ...state.current, candidate: null, nextAt: null };
      return;
    }
    const people = [room.localParticipant, ...room.remoteParticipants.values()].map(p => ({
      // SDK speech is participant-wide; shared music cannot safely identify microphone speech.
      identity: p.identity, speaking: participantSpeaking(p, options.threshold)
        && p.getTrackPublication(Track.Source.ScreenShareAudio)?.isMuted !== false,
      microphoneEnabled: p.isMicrophoneEnabled, connected: true,
      cameraAvailable: p.isCameraEnabled, audioLevel: p.audioLevel,
    }));
    const before = state.current.selected;
    state.current = selectSpeaker(state.current, people, performance.now(), options.focus, options.pin, options.follow);
    if (before !== state.current.selected) onSelected(state.current.selected);
    const nextAt = state.current.nextAt;
    if (nextAt !== null) timer = setTimeout(update, Math.max(1, nextAt - performance.now()));
  };
  events.forEach(event => room.on(event, update));
  update();
  return () => { clearTimeout(timer); events.forEach(event => room.off(event, update)); };
}

export function useFollowSpeaker(room: Room, callKey: string, follow: boolean, pin: string | null,
  focus: string | null, threshold: number) {
  const state = useRef(initialSpeakerState());
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { state.current = initialSpeakerState(); setSelected(null); }, [room, callKey]);
  useEffect(() => observeFollowSpeaker(room, state, { follow, pin, focus, threshold }, setSelected),
    [room, callKey, follow, pin, focus, threshold]);
  return selected;
}
