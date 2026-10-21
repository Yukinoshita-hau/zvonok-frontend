import type { TrackReference } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import type { CSSProperties, MouseEvent } from "react";

export interface CallParticipantTileProps {
	participant: Participant;
	videoTrack?: TrackReference;
	avatarUrl?: string | null;
	displayName?: string;
	className: string;
	style?: CSSProperties;
	cardId?: string;
	onVideoDimensions?: (width: number, height: number) => void;
	onAspectRatio?: (id: string, ratio: number) => void;
	/** Карточка отображает трансляцию экрана (отдельная плитка). */
	isScreenShareCard?: boolean;
	/** Карточка в данный момент выбрана как главный фокус. */
	isFocused?: boolean;
	/** Клик по карточке (если есть видео, открывает её в фокус-режиме). */
	onOpenFocus?: () => void;
	onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
}
