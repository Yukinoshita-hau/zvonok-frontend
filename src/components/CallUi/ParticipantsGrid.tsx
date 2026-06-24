import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CallParticipantTile } from "./CallParticipantTile";
import styles from "./CallUi.module.css";
import type { ParticipantCard } from "./hooks/useCallParticipants";

export interface ParticipantContextMenuAnchor {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
	preferAbove?: boolean;
}

interface ParticipantsGridProps {
	participantCards: ParticipantCard[];
	extraTiles?: React.ReactNode[];
	focusedCardId: string | null;
	onOpenCard: (card: ParticipantCard) => void;
	onOpenContextMenu?: (card: ParticipantCard, anchor: ParticipantContextMenuAnchor) => void;
	itemsPerPage?: number;
	className?: string;
	tileClassName?: string;
	disablePagination?: boolean;
	preferContextMenuAbove?: boolean;
}

export const ParticipantsGrid = React.memo(function ParticipantsGrid({
	participantCards,
	extraTiles = [],
	focusedCardId,
	onOpenCard,
	onOpenContextMenu,
	itemsPerPage = 8,
	className,
	tileClassName,
	disablePagination = false,
	preferContextMenuAbove = false,
}: ParticipantsGridProps) {
	const [currentPage, setCurrentPage] = useState(0);
	const [animationKey, setAnimationKey] = useState(0);
	const previousPageRef = useRef(0);

	const totalItems = participantCards.length + extraTiles.length;
	const totalPages = disablePagination
		? 1
		: Math.max(1, Math.ceil(totalItems / itemsPerPage));
	const safePage = Math.min(currentPage, totalPages - 1);

	const currentItems = useMemo(() => {
		const items = [
			...participantCards.map((card) => ({ type: "participant" as const, card })),
			...extraTiles.map((tile, index) => ({ type: "extra" as const, tile, key: `extra-${index}` })),
		];

		if (disablePagination) return items;
		const start = safePage * itemsPerPage;
		return items.slice(start, start + itemsPerPage);
	}, [disablePagination, extraTiles, itemsPerPage, participantCards, safePage]);

	useEffect(() => {
		if (currentPage !== safePage) {
			setCurrentPage(safePage);
		}
	}, [currentPage, safePage]);

	useEffect(() => {
		if (previousPageRef.current === safePage) return;
		previousPageRef.current = safePage;
		setAnimationKey((key) => key + 1);
	}, [safePage]);

	return (
		<>
			<div key={animationKey} className={className || styles["participants-grid"]}>
				{currentItems.map((item) => {
					if (item.type === "extra") {
						return <React.Fragment key={item.key}>{item.tile}</React.Fragment>;
					}

					const card = item.card;
					return (
						<CallParticipantTile
							key={card.id}
							className={[
								tileClassName || styles["tile"],
								styles["tile-animated"],
							].join(" ")}
							participant={card.participant}
							videoTrack={card.videoTrack}
							avatarUrl={card.avatarUrl}
							displayName={card.displayName}
							isScreenShareCard={card.isScreenShareCard}
							isFocused={card.id === focusedCardId}
							onOpenFocus={card.videoTrack ? () => onOpenCard(card) : undefined}
							onContextMenu={onOpenContextMenu ? (event) => {
								event.preventDefault();
								event.stopPropagation();
								const rect = event.currentTarget.getBoundingClientRect();
								onOpenContextMenu(card, {
									left: rect.left,
									top: rect.top,
									right: rect.right,
									bottom: rect.bottom,
									width: rect.width,
									height: rect.height,
									preferAbove: preferContextMenuAbove,
								});
							} : undefined}
						/>
					);
				})}
			</div>

			{!disablePagination && totalPages > 1 && (
				<div className={styles["pagination-controls"]}>
					<button
						type="button"
						className={styles["pagination-button"]}
						onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
						disabled={safePage === 0}
						aria-label="Предыдущая страница участников"
					>
						<ChevronLeft size={20} />
					</button>
					<span className={styles["pagination-info"]}>
						{safePage + 1} / {totalPages}
					</span>
					<button
						type="button"
						className={styles["pagination-button"]}
						onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
						disabled={safePage >= totalPages - 1}
						aria-label="Следующая страница участников"
					>
						<ChevronRight size={20} />
					</button>
				</div>
			)}
		</>
	);
});
