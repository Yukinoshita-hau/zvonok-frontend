import type { ParticipantCard } from "./hooks/useCallParticipants";

export type StageLayout = "auto" | "voice" | "grid" | "focus" | "screen";

export function resolveStageLayout(
  cards: ParticipantCard[],
  layout: StageLayout,
  pinnedId: string | null,
  screenSid: string | null,
) {
  const screens = cards.filter((c) => c.isScreenShareCard);
  const mode =
    layout === "auto"
      ? screens.length
        ? "screen"
        : cards.some(c => c.videoTrack) ? "grid" : "voice"
      : layout === "screen" && !screens.length
        ? "grid"
        : layout;
  const pinned = cards.find((c) => c.id === pinnedId);
  const screen =
    screens.find((c) => c.videoTrack?.publication.trackSid === screenSid) ??
    screens[0];
  const focusedCard =
    (mode === "grid" || mode === "voice")
      ? null
      : mode === "screen"
        ? pinned?.isScreenShareCard
          ? pinned
          : screen
        : (pinned ?? cards.find((c) => !c.isScreenShareCard) ?? null);
  return {
    mode,
    focusedCard,
    stripCards: cards.filter((c) => c.id !== focusedCard?.id),
  };
}
