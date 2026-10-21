import React, { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CallParticipantTile } from "./CallParticipantTile";
import styles from "./CallUi.module.css";
import type { ParticipantCard } from "./hooks/useCallParticipants";
import { calculateLayout, mediaAspectRatio, pageForAnchor, type LayoutCard } from "./adaptiveLayout";
import { useContainerSize } from "./hooks/useContainerSize";

export interface ParticipantContextMenuAnchor {
  left: number; top: number; right: number; bottom: number; width: number; height: number;
  preferAbove?: boolean;
}

interface ParticipantsGridProps {
  participantCards: ParticipantCard[];
  focusedCardId: string | null;
  onOpenCard: (card: ParticipantCard) => void;
  onOpenContextMenu?: (card: ParticipantCard, anchor: ParticipantContextMenuAnchor) => void;
  strip?: boolean;
  preferContextMenuAbove?: boolean;
  focus?: boolean;
  cinema?: boolean;
}

export const ParticipantsGrid = React.memo(function ParticipantsGrid({
  participantCards, focusedCardId, onOpenCard, onOpenContextMenu, strip = false,
  preferContextMenuAbove = false, focus = false, cinema = false,
}: ParticipantsGridProps) {
  const { ref, width, height } = useContainerSize();
  const [pageState, setPageState] = useState({ anchor: null as string | null, fallback: 0 });
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const onAspectRatio = useCallback((id: string, ratio: number) => {
    setAspects((previous) => Math.abs((previous[id] ?? 0) - ratio) < 0.02
      ? previous : { ...previous, [id]: ratio });
  }, []);
  // Primitive geometry inputs keep VAD/mute renders out of the calculation.
  const modelKey = JSON.stringify(participantCards.map((card) => {
    const dimensions = card.videoTrack?.publication.dimensions;
    return {
      id: card.id, source: card.isScreenShareCard ? "screen" : "camera",
      cameraPresent: Boolean(card.videoTrack),
      aspectRatio: aspects[card.id] ?? card.aspectRatio ?? (dimensions ? mediaAspectRatio(dimensions.width, dimensions.height) : undefined),
    };
  }));
  const layout = useMemo(() => {
    const cards: LayoutCard[] = JSON.parse(modelKey);
    if (focus && focusedCardId) {
      const others = cards.filter(c => c.id !== focusedCardId);
      const stripHeight = others.length ? Math.min(132, height * 0.28) : 0;
      const mainHeight = Math.max(1, height - stripHeight - (stripHeight ? 8 : 0));
      const stripLayout = calculateLayout({ width, height: stripHeight, cards: others, strip: true, page: pageState.fallback });
      return { ...stripLayout, pages: cinema ? 1 : stripLayout.pages, tiles: [
        { id: focusedCardId, x: 0, y: 0, width, height: cinema ? height : mainHeight },
        ...stripLayout.tiles.map(t => ({ ...t, y: t.y + mainHeight + 8 })),
      ] };
    }
    const input = { width, height, cards, strip };
    const { capacity } = calculateLayout(input);
    const page = pageForAnchor(cards.map((c) => c.id), capacity, pageState.anchor, pageState.fallback);
    return calculateLayout({ ...input, page });
  }, [modelKey, width, height, strip, pageState, focus, focusedCardId, cinema]);
  const changePage = (page: number) => setPageState({
    anchor: participantCards[page * layout.capacity]?.id ?? null, fallback: page,
  });
  const cardsById = new Map(participantCards.map((card) => [card.id, card]));

  return (
    <div ref={ref} className={`${styles["adaptive-grid"]} ${strip ? styles["adaptive-strip"] : ""}`} data-call-grid data-capacity={layout.capacity}>
      <div className={styles["adaptive-surface"]}>
        {layout.tiles.map((tile) => {
          const card = cardsById.get(tile.id)!;
          return <CallParticipantTile
            key={card.id}
            cardId={card.id}
            onAspectRatio={onAspectRatio}
            style={{ position: "absolute", left: tile.x, top: tile.y, width: tile.width, height: tile.height,
              visibility: cinema && card.id !== focusedCardId ? "hidden" : undefined }}
            className={styles["adaptive-tile"]}
            participant={card.participant}
            videoTrack={card.videoTrack}
            avatarUrl={card.avatarUrl}
            displayName={card.displayName}
            isScreenShareCard={card.isScreenShareCard}
            isFocused={card.id === focusedCardId}
            onOpenFocus={() => onOpenCard(card)}
            onContextMenu={onOpenContextMenu ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenContextMenu(card, {
                left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
                width: rect.width, height: rect.height, preferAbove: preferContextMenuAbove,
              });
            } : undefined}
          />;
        })}
      </div>
      {layout.pages > 1 && <div className={styles["pagination-controls"]}>
        <button type="button" className={styles["pagination-button"]} onClick={() => changePage(layout.page - 1)} disabled={layout.page === 0} aria-label="Предыдущая страница участников"><ChevronLeft size={20} /></button>
        <span className={styles["pagination-info"]} aria-live="polite">{layout.page + 1} / {layout.pages}</span>
        <button type="button" className={styles["pagination-button"]} onClick={() => changePage(layout.page + 1)} disabled={layout.page >= layout.pages - 1} aria-label="Следующая страница участников"><ChevronRight size={20} /></button>
      </div>}
    </div>
  );
});
