export interface SpeakerInput {
  identity: string;
  speaking: boolean;
  microphoneEnabled: boolean;
  connected: boolean;
  cameraAvailable: boolean;
  audioLevel: number;
}

export const SPEAKER_TIMING = { activation: 500, silence: 1200, dwell: 2200 };
export const initialSpeakerState = () => ({
  candidate: null as string | null, candidateSince: 0,
  selected: null as string | null, selectedAt: 0, quietSince: null as number | null,
  reason: "empty", automaticSwitchAllowed: false, nextAt: null as number | null,
});
export type SpeakerState = ReturnType<typeof initialSpeakerState>;

/** Presentation only. Times must come from the same monotonic clock. */
export function selectSpeaker(previous: SpeakerState, people: SpeakerInput[], now: number,
  currentFocus: string | null, pin: string | null, follow: boolean): SpeakerState {
  const present = people.filter(p => p.connected);
  const exists = (id: string | null) => present.some(p => p.identity === id);
  const pinned = exists(pin) ? pin : null;
  const selected = pinned ?? (exists(previous.selected) ? previous.selected : exists(currentFocus) ? currentFocus : present[0]?.identity ?? null);
  const changed = previous.selected !== selected;
  const selectedAt = changed ? now : previous.selectedAt;
  const incumbent = present.find(p => p.identity === selected);
  const speaking = (p: SpeakerInput) => p.microphoneEnabled && p.speaking;
  const quietSince = incumbent && speaking(incumbent) ? null : changed ? now : previous.quietSince ?? now;
  const base = { ...previous, selected, selectedAt, quietSince, candidate: null, candidateSince: 0,
    automaticSwitchAllowed: false, nextAt: null };
  if (pinned !== null || !follow || selected === null) return { ...base, reason: pinned !== null ? "manual-pin" : selected !== null ? "follow-off" : "empty" };
  // Overlap retains the incumbent. Audio-level fluctuations must not direct the camera.
  if (incumbent && speaking(incumbent)) return { ...base, reason: "incumbent-speaking" };
  const candidates = present.filter(p => p.identity !== selected && speaking(p));
  const candidate = candidates.find(p => p.identity === previous.candidate)
    ?? candidates.sort((a, b) => b.audioLevel - a.audioLevel || a.identity.localeCompare(b.identity))[0];
  if (!candidate) return { ...base, reason: "silence-hold" };
  const candidateSince = previous.candidate === candidate.identity ? previous.candidateSince : now;
  const deadline = Math.max(candidateSince + SPEAKER_TIMING.activation,
    selectedAt + SPEAKER_TIMING.dwell, (quietSince ?? now) + SPEAKER_TIMING.silence);
  if (now < deadline) return { ...base, candidate: candidate.identity, candidateSince, nextAt: deadline, reason: "candidate-pending" };
  return { ...base, selected: candidate.identity, selectedAt: now, quietSince: null,
    automaticSwitchAllowed: true, reason: "stable-speaker" };
}
